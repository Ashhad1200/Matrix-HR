// A tiny OpenAI-compatible stand-in for browser/e2e tests. Never calls a real provider.
//   node scripts/mock-llm.mjs [port]     then run the API with AI_OPENAI_BASE_URL=http://127.0.0.1:<port>/v1
// Behaviour is keyed off the last user message so tests are deterministic.
import { createServer } from 'http';
const port = Number(process.argv[2] || 9100);
const reply = (res, message) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 900, completion_tokens: 120 } })); };
createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => {
    const body = JSON.parse(b || '{}'); const msgs = body.messages || [];
    const last = msgs[msgs.length - 1] || {};
    const user = [...msgs].reverse().find((m) => m.role === 'user');
    const text = typeof user?.content === 'string' ? user.content : (user?.content || []).map((p) => p.text || '').join(' ');
    if (last.role === 'tool') return reply(res, { content: last.content.includes('remaining') ? `You have ${JSON.parse(last.content)[0]?.remaining ?? '?'} days of ${JSON.parse(last.content)[0]?.leaveType ?? 'leave'} left.` : 'Done.' });
    if (/leave balance|days.*left/i.test(text)) return reply(res, { content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'my_leave_balances', arguments: '{}' } }] });
    if (/book leave|apply for leave/i.test(text)) return reply(res, { content: 'I can submit that for you.', tool_calls: [{ id: 'c2', type: 'function', function: { name: 'request_leave', arguments: JSON.stringify({ policyId: (text.match(/policy:(\S+)/) || [])[1] || 'x', startDate: '2026-12-21', endDate: '2026-12-22', reason: 'Mock trip' }) } }] });
    if (/echo system prompt/i.test(text)) return reply(res, { content: msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n') });
    if (/attached file/i.test(text)) return reply(res, { content: `I read the attachment (${text.length} chars).` });
    reply(res, { content: 'Hello! I am the mock assistant.' });
  });
}).listen(port, '127.0.0.1', () => console.log(`mock llm on ${port}`));
