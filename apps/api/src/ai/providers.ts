export type Provider = 'openai' | 'anthropic' | 'gemini';

export interface ToolSpec { name: string; description: string; parameters: Record<string, unknown> }
export interface ToolCall { id: string; name: string; args: Record<string, unknown> }
export interface LlmMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  images?: { mime: string; base64: string }[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
}
export interface LlmRequest { apiKey: string; model: string; system: string; messages: LlmMessage[]; tools: ToolSpec[]; maxTokens: number }
export interface LlmResult { text: string; toolCalls: ToolCall[]; inputTokens: number; outputTokens: number }

export class ProviderError extends Error {}

const base = (envName: string, dflt: string) => (process.env[envName] || dflt).replace(/\/$/, '');

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new ProviderError(`provider returned ${res.status}`); // the body can echo request details, so it is not forwarded
  return res.json();
}

const parseArgs = (s: unknown): Record<string, unknown> => {
  if (s && typeof s === 'object') return s as Record<string, unknown>;
  try { const v = JSON.parse(String(s || '{}')); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
};

async function openai(r: LlmRequest): Promise<LlmResult> {
  const messages: any[] = [{ role: 'system', content: r.system }];
  for (const m of r.messages) {
    if (m.role === 'tool') messages.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    else if (m.role === 'assistant') messages.push({ role: 'assistant', content: m.content || null, ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}) });
    else messages.push({ role: 'user', content: m.images?.length ? [{ type: 'text', text: m.content }, ...m.images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.base64}` } }))] : m.content });
  }
  const d = await post(`${base('AI_OPENAI_BASE_URL', 'https://api.openai.com/v1')}/chat/completions`, { authorization: `Bearer ${r.apiKey}` }, {
    model: r.model, messages, max_tokens: r.maxTokens, temperature: 0.3,
    ...(r.tools.length ? { tools: r.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) } : {}),
  });
  const msg = d?.choices?.[0]?.message ?? {};
  return {
    text: typeof msg.content === 'string' ? msg.content : '',
    toolCalls: (msg.tool_calls ?? []).map((c: any) => ({ id: String(c.id), name: String(c.function?.name), args: parseArgs(c.function?.arguments) })),
    inputTokens: Number(d?.usage?.prompt_tokens ?? 0), outputTokens: Number(d?.usage?.completion_tokens ?? 0),
  };
}

async function anthropic(r: LlmRequest): Promise<LlmResult> {
  const messages: any[] = [];
  for (const m of r.messages) {
    if (m.role === 'tool') messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }] });
    else if (m.role === 'assistant') messages.push({ role: 'assistant', content: [...(m.content ? [{ type: 'text', text: m.content }] : []), ...(m.toolCalls ?? []).map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.args }))] });
    else messages.push({ role: 'user', content: m.images?.length ? [...m.images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.base64 } })), { type: 'text', text: m.content }] : m.content });
  }
  const d = await post(`${base('AI_ANTHROPIC_BASE_URL', 'https://api.anthropic.com')}/v1/messages`, { 'x-api-key': r.apiKey, 'anthropic-version': '2023-06-01' }, {
    model: r.model, system: r.system, messages, max_tokens: r.maxTokens, temperature: 0.3,
    ...(r.tools.length ? { tools: r.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
  });
  const blocks: any[] = d?.content ?? [];
  return {
    text: blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
    toolCalls: blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: String(b.id), name: String(b.name), args: parseArgs(b.input) })),
    inputTokens: Number(d?.usage?.input_tokens ?? 0), outputTokens: Number(d?.usage?.output_tokens ?? 0),
  };
}

async function gemini(r: LlmRequest): Promise<LlmResult> {
  const contents: any[] = [];
  for (const m of r.messages) {
    if (m.role === 'tool') contents.push({ role: 'user', parts: [{ functionResponse: { name: m.toolName, response: { result: m.content } } }] });
    else if (m.role === 'assistant') contents.push({ role: 'model', parts: [...(m.content ? [{ text: m.content }] : []), ...(m.toolCalls ?? []).map((c) => ({ functionCall: { name: c.name, args: c.args } }))] });
    else contents.push({ role: 'user', parts: [{ text: m.content }, ...(m.images ?? []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.base64 } }))] });
  }
  const d = await post(`${base('AI_GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com')}/v1beta/models/${encodeURIComponent(r.model)}:generateContent`, { 'x-goog-api-key': r.apiKey }, {
    systemInstruction: { parts: [{ text: r.system }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: r.maxTokens },
    ...(r.tools.length ? { tools: [{ functionDeclarations: r.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }] } : {}),
  });
  const parts: any[] = d?.candidates?.[0]?.content?.parts ?? [];
  return {
    text: parts.filter((p) => typeof p.text === 'string').map((p) => p.text).join(''),
    toolCalls: parts.filter((p) => p.functionCall).map((p, i) => ({ id: `g${i}_${p.functionCall.name}`, name: String(p.functionCall.name), args: parseArgs(p.functionCall.args) })),
    inputTokens: Number(d?.usageMetadata?.promptTokenCount ?? 0), outputTokens: Number(d?.usageMetadata?.candidatesTokenCount ?? 0),
  };
}

export const PROVIDERS: Record<Provider, (r: LlmRequest) => Promise<LlmResult>> = { openai, anthropic, gemini };
