'use client';

import { useBrand } from '@/lib/brand-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Paperclip, Plus, Send, Sparkles, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface Msg { id?: string; role: 'user' | 'assistant'; content: string; meta?: { actions?: { id: string; summary: string }[]; credits?: number } | null }

const SUGGESTED = ['What is my leave balance?', 'Which public holidays are coming up?', 'How do I invite an employee to log in?'];

export default function AiPage() {
  const brand = useBrand();
  const { user } = useAuth();
  const canManage = user?.role === 'COMPANY_ADMIN' || user?.role === 'HR_MANAGER';
  const [status, setStatus] = useState<any>(null);
  const [convos, setConvos] = useState<any[]>([]);
  const [current, setCurrent] = useState<string | undefined>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Record<string, string>>({});
  const [companyOn, setCompanyOn] = useState<boolean | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadMeta = useCallback(async () => {
    const [s, c] = await Promise.all([api.ai.status().catch(() => null), api.ai.conversations().catch(() => [])]);
    setStatus(s); setConvos(c);
    if (canManage) api.ai.tenant().then((t) => setCompanyOn(t.aiEnabled)).catch(() => undefined);
  }, [canManage]);
  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  async function open(id: string) {
    setError('');
    const c = await api.ai.conversation(id);
    setCurrent(id); setMsgs(c.messages);
  }

  async function send(message: string) {
    if ((!message.trim() && !file) || busy) return;
    setBusy(true); setError('');
    setMsgs((m) => [...m, { role: 'user', content: message || `(attached ${file?.name})` }]);
    setText('');
    try {
      const r = await api.ai.chat(message, current, file);
      setCurrent(r.conversationId); setFile(null);
      setMsgs((m) => [...m, r.message]);
      loadMeta();
    } catch (e: any) { setError(e.message || 'Something went wrong'); loadMeta(); }
    finally { setBusy(false); }
  }

  async function act(id: string, ok: boolean) {
    try {
      const r = ok ? await api.ai.confirm(id) : await api.ai.cancel(id).then(() => ({ message: 'Cancelled.' }));
      setDone((d) => ({ ...d, [id]: r.message }));
    } catch (e: any) { setDone((d) => ({ ...d, [id]: e.message })); }
  }

  async function toggleCompany() {
    const next = !companyOn;
    await api.ai.setTenant(next);
    setCompanyOn(next); loadMeta();
  }

  const unavailable = status && !status.available;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ask {brand.name}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Ask about your leave, policies and company data, or have me prepare a request for you to confirm.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {status && !status.unlimited && <span data-testid="ai-credits" className="rounded-full border px-3 py-1 tabular-nums">{Number(status.credits).toLocaleString('en-US', { maximumFractionDigits: 1 })} credits</span>}
          {canManage && !status?.unlimited && <Link href="/billing" className="font-medium text-[hsl(var(--primary))] underline-offset-2 hover:underline">Buy credits</Link>}
        </div>
      </div>

      {canManage && companyOn !== null && (
        <Card className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="font-medium">AI assistant for your company</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{companyOn ? 'On: everyone in your company can use it.' : 'Off: nobody in your company can use it.'}</p>
          </div>
          <Button variant="secondary" onClick={toggleCompany} data-testid="ai-company-toggle">{companyOn ? 'Turn off' : 'Turn on'}</Button>
        </Card>
      )}

      {unavailable && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">{status.message}</p>}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2" aria-label="Your chats">
          <Button variant="secondary" className="w-full" onClick={() => { setCurrent(undefined); setMsgs([]); setError(''); }}><Plus className="mr-1 h-4 w-4" />New chat</Button>
          <ul className="space-y-1">
            {convos.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <button onClick={() => open(c.id)} className={cn('min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-[hsl(var(--muted))]', current === c.id && 'bg-[hsl(var(--muted))] font-medium')}>{c.title || 'Chat'}</button>
                <button aria-label="Delete chat" className="rounded p-1 opacity-60 hover:opacity-100" onClick={async () => { await api.ai.deleteConversation(c.id); if (current === c.id) { setCurrent(undefined); setMsgs([]); } loadMeta(); }}><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        </aside>

        <Card className="flex min-h-[420px] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" data-testid="ai-thread">
            {msgs.length === 0 && (
              <div className="space-y-3 py-8 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-[hsl(var(--primary))]" aria-hidden />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Try one of these:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED.map((q) => <button key={q} disabled={unavailable} onClick={() => send(q)} className="rounded-full border px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50">{q}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={m.id ?? i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm', m.role === 'user' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))]')}>
                  {m.content}
                  {m.meta?.actions?.map((a) => (
                    <div key={a.id} className="mt-3 rounded-lg border bg-[hsl(var(--card))] p-3 text-[hsl(var(--foreground))]" data-testid="ai-action">
                      <p className="font-medium">{a.summary}</p>
                      {done[a.id] ? <p className="mt-1 text-sm" data-testid="ai-action-result">{done[a.id]}</p> : (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={() => act(a.id, true)} data-testid="ai-confirm">Confirm</Button>
                          <Button size="sm" variant="secondary" onClick={() => act(a.id, false)}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {busy && <p className="text-sm text-[hsl(var(--muted-foreground))]">Thinking…</p>}
            <div ref={bottom} />
          </div>
          {error && <p role="alert" className="mx-4 mb-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}{/credits/i.test(error) && canManage && <> <Link href="/billing" className="font-medium underline">Buy credits</Link></>}</p>}
          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2 border-t p-3">
            <input ref={fileInput} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="ai-file" />
            <Button type="button" variant="ghost" size="sm" aria-label="Attach a file" onClick={() => fileInput.current?.click()} disabled={unavailable}><Paperclip className="h-4 w-4" /></Button>
            <div className="min-w-0 flex-1">
              {file && <p className="mb-1 flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]"><span className="truncate">{file.name}</span><button type="button" aria-label="Remove file" onClick={() => setFile(null)}><X className="h-3 w-3" /></button></p>}
              <label htmlFor="ai-input" className="sr-only">Message</label>
              <textarea id="ai-input" rows={1} value={text} disabled={unavailable} maxLength={4000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} placeholder="Ask anything about your HR…" className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]" />
            </div>
            <Button type="submit" disabled={busy || unavailable || (!text.trim() && !file)} aria-label="Send"><Send className="h-4 w-4" /></Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
