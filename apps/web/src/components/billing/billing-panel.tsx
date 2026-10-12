'use client';

import { useBrand } from '@/lib/brand-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, FileText, Printer, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageSkeleton } from '@/components/ui/skeleton';
import { cn, formatDate } from '@/lib/utils';
import { describeRequest, money, REQUEST_STATUS } from './money';

type Purpose = 'plan' | 'credit_pack';

function CopyField({ label, value }: { label: string; value?: string | null }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
        <p className="break-all font-medium tabular-nums">{value}</p>
      </div>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-2.5 text-xs font-medium transition-colors hover:bg-[hsl(var(--muted))]"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch { /* clipboard blocked: the value is still on screen */ }
        }}
      >
        {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function ProofViewer({ id, onClose }: { id: string; onClose: () => void }) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let url = '';
    api.billing.proof(id).then((f) => { url = f.url; setFile(f); }).catch((e) => setError(e.message));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return (
    <Modal open onClose={onClose} title="Payment proof" className="max-w-3xl">
      {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : !file ? <p className="text-sm">Loading…</p> : file.type === 'application/pdf'
        ? <iframe title="Payment proof" src={file.url} sandbox="" className="h-[70vh] w-full rounded-lg border" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={file.url} alt="Payment proof" className="max-h-[70vh] w-full rounded-lg object-contain" />}
    </Modal>
  );
}

/**
 * The whole customer billing experience: where the plan stands, a three-step pay flow (choose, transfer, upload proof), and the
 * history of requests with receipts. Shown on /billing, and on its own as the lapsed (billing-only) screen.
 */
export function BillingPanel({ onChanged }: { onChanged?: () => void }) {
  const brand = useBrand();
  const [state, setState] = useState<any>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [purpose, setPurpose] = useState<Purpose>('plan');
  const [planCode, setPlanCode] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [packCode, setPackCode] = useState('');
  const [accountId, setAccountId] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState('');
  const [busy, setBusy] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [declared, setDeclared] = useState('');
  const [declaredCurrency, setDeclaredCurrency] = useState('');
  const [note, setNote] = useState('');
  const [proofFor, setProofFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [s, c, r] = await Promise.all([api.billing.state(), api.billing.catalog(), api.billing.requests()]);
      setState(s); setCatalog(c); setRequests(r);
      // Preselect the current plan only when it is still offered; customers on a retired plan (old PKR plans, Enterprise) start from the first offered one.
      setPlanCode((p) => p || (c.plans.some((x: any) => x.code === s.subscription?.planCode) ? s.subscription.planCode : c.plans[0]?.code) || '');
      setPackCode((p) => p || c.creditPacks[0]?.code || '');
      setAccountId((a) => a || c.accounts[0]?.id || '');
    } catch (e: any) {
      setError(e.message || 'Could not load billing');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // The open request (if any) decides which step to show.
  const open = requests.find((r) => r.status === 'AWAITING_PROOF');
  const pending = requests.find((r) => r.status === 'PENDING');

  // Live server-side quote for the current choice. The amount is never typed or computed in the browser.
  useEffect(() => {
    if (open || pending || !catalog) return;
    const body = purpose === 'plan' ? { purpose, planCode, period } : { purpose, packCode };
    if ((purpose === 'plan' && !planCode) || (purpose === 'credit_pack' && !packCode)) return;
    let live = true;
    setQuoteError('');
    api.billing.quote(body).then((q) => live && setQuote(q)).catch((e) => { if (live) { setQuote(null); setQuoteError(e.message); } });
    return () => { live = false; };
  }, [purpose, planCode, period, packCode, catalog, open, pending]);

  async function startPayment() {
    setBusy(true); setError('');
    try {
      await api.billing.createRequest(purpose === 'plan' ? { purpose, planCode, period, accountId } : { purpose, packCode, accountId });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function sendProof() {
    if (!open || !file) return;
    setBusy(true); setError('');
    try {
      await api.billing.uploadProof(open.id, file, { declaredAmount: declared || undefined, declaredCurrency: declaredCurrency || undefined, note: note || undefined });
      setFile(null); setDeclared(''); setDeclaredCurrency(''); setNote('');
      await load();
      onChanged?.();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function cancel(id: string) {
    setBusy(true); setError('');
    try { await api.billing.cancel(id); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  if (loading) return <PageSkeleton />;
  const account = open && catalog?.accounts.find((a: any) => a.id === open.accountId);
  const noAccounts = !catalog?.accounts?.length;
  const differs = !!open && ((declared !== '' && Number(declared).toFixed(2) !== Number(open.expectedAmount).toFixed(2)) || (declaredCurrency !== '' && declaredCurrency.toUpperCase() !== open.currency));

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}

      {/* Where things stand */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Current plan</p>
            <p className="font-display text-xl font-bold">{state?.subscription?.planName ?? 'No plan yet'}
              {state?.subscription?.status === 'trialing' && <Badge variant="info" className="ml-2 align-middle">Free trial</Badge>}
            </p>
          </div>
          <div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{state?.periodEnd ? (state.state === 'lapsed' ? 'Ended on' : 'Paid until') : 'Renewal'}</p>
            <p className="font-medium tabular-nums">{state?.periodEnd ? formatDate(state.periodEnd) : 'Managed by your account manager'}</p>
          </div>
          <div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Status</p>
            <Badge variant={state?.blocked ? 'danger' : state?.state === 'grace' ? 'warning' : state?.state === 'provisional' ? 'warning' : 'success'}>
              {{ none: 'Active', ok: 'Active', due_soon: 'Renews soon', grace: 'In grace period', lapsed: 'Ended', provisional: 'Temporary access' }[state?.state as string] ?? 'Active'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Waiting for the operator */}
      {pending && (
        <Card>
          <CardHeader><CardTitle>We are checking your payment</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{describeRequest(pending)}: <strong className="tabular-nums">{money(pending.expectedAmount, pending.currency)}</strong>, reference <strong>{pending.reference}</strong>.</p>
            <p className="text-[hsl(var(--muted-foreground))]">We review proofs on business days and email you the moment it is approved. You cannot start another payment until this one is decided.</p>
            <Button variant="secondary" size="sm" onClick={() => setProofFor(pending.id)}><FileText className="h-4 w-4" aria-hidden="true" /> View my proof</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 and 3: transfer details, then proof */}
      {open && (
        <Card>
          <CardHeader><CardTitle>Pay {money(open.expectedAmount, open.currency)} by bank transfer</CardTitle></CardHeader>
          <CardContent className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-semibold">1. Send the transfer</p>
              <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">{describeRequest(open)}. Put the reference in the transfer note so we can match it.</p>
              <div className="rounded-xl border border-[hsl(var(--border))] px-4">
                <CopyField label="Payment reference (required in the note)" value={open.reference} />
                <CopyField label="Amount" value={Number(open.expectedAmount).toFixed(2)} />
                <CopyField label="Currency" value={open.currency} />
                <CopyField label="Bank" value={account?.bankName} />
                <CopyField label="Account title" value={account?.accountTitle} />
                <CopyField label="IBAN" value={account?.iban} />
                <CopyField label="Account number" value={account?.accountNumber} />
                <CopyField label="SWIFT" value={account?.swift} />
              </div>
              {account?.instructions && <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{account.instructions}</p>}
              <ul className="mt-3 space-y-1 text-sm">
                {(open.lineItems as any[]).map((l, i) => (<li key={i} className="flex justify-between gap-3"><span>{l.label}</span><span className="tabular-nums">{money(l.amount, open.currency)}</span></li>))}
              </ul>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); sendProof(); }} className="space-y-3">
              <p className="text-sm font-semibold">2. Upload your proof</p>
              <div>
                <label htmlFor="proof-file" className="mb-1.5 block text-sm font-medium">Screenshot or PDF of the transfer</label>
                <input ref={fileRef} id="proof-file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-800" />
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">PNG, JPG, WEBP or PDF, up to 5 MB.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="paid-amount" className="mb-1.5 block text-sm font-medium">Amount you paid <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label>
                  <Input id="paid-amount" inputMode="decimal" placeholder={Number(open.expectedAmount).toFixed(2)} value={declared} onChange={(e) => setDeclared(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="paid-currency" className="mb-1.5 block text-sm font-medium">Currency</label>
                  <Input id="paid-currency" maxLength={3} placeholder={open.currency} value={declaredCurrency} onChange={(e) => setDeclaredCurrency(e.target.value.toUpperCase())} />
                </div>
              </div>
              {differs && (
                <div>
                  <label htmlFor="paid-note" className="mb-1.5 block text-sm font-medium">Why is it different? <span className="text-rose-700">(required)</span></label>
                  <Input id="paid-note" required minLength={5} placeholder="For example: bank fees were deducted" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" disabled={busy || !file}><Upload className="h-4 w-4" aria-hidden="true" /> {busy ? 'Sending…' : 'Send proof'}</Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => cancel(open.id)}>Cancel this payment</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 1: choose */}
      {!open && !pending && (
        <Card>
          <CardHeader><CardTitle>{state?.blocked ? 'Renew to continue' : 'Renew or buy AI credits'}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {noAccounts ? (
              <EmptyState title="Payment details are not set up yet" description={`Bank details for transfers have not been added. Please contact ${brand.supportEmail || 'support'} and we will help you pay.`} />
            ) : (
              <>
                <div role="tablist" aria-label="What to pay for" className="inline-flex rounded-lg border border-[hsl(var(--border))] p-1">
                  {([['plan', 'Plan'], ['credit_pack', 'AI credits']] as const).map(([v, l]) => (
                    <button key={v} role="tab" type="button" aria-selected={purpose === v} onClick={() => setPurpose(v)}
                      className={cn('cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors', purpose === v ? 'bg-brand-700 text-white dark:bg-brand-600' : 'hover:bg-[hsl(var(--muted))]')}>{l}</button>
                  ))}
                </div>

                {purpose === 'plan' ? (
                  <>
                    <div role="radiogroup" aria-label="Billing period" className="flex gap-2">
                      {(['monthly', 'yearly'] as const).map((p) => (
                        <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
                          className={cn('cursor-pointer rounded-lg border px-4 py-1.5 text-sm font-medium', period === p ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/40' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]')}>
                          {p === 'monthly' ? 'Monthly' : 'Yearly (2 months free)'}
                        </button>
                      ))}
                    </div>
                    <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-3">
                      {catalog.plans.map((p: any) => (
                        <button key={p.code} type="button" role="radio" aria-checked={planCode === p.code} onClick={() => setPlanCode(p.code)}
                          className={cn('cursor-pointer rounded-xl border p-4 text-left transition-colors', planCode === p.code ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:bg-brand-900/30' : 'border-[hsl(var(--border))] hover:border-brand-400')}>
                          <p className="font-display text-lg font-bold">{p.name}</p>
                          <p className="mt-1 tabular-nums"><span className="text-xl font-semibold">{money(period === 'yearly' ? p.yearly : p.monthly, p.currency)}</span> <span className="text-sm text-[hsl(var(--muted-foreground))]">{period === 'yearly' ? 'a year' : 'a month'}</span></p>
                          <ul className="mt-2 space-y-0.5 text-sm text-[hsl(var(--muted-foreground))]">
                            <li>Up to {p.maxEmployees} employees{p.overagePerEmployee ? `, then ${money(p.overagePerEmployee, p.currency)} each` : ''}</li>
                            <li>{p.maxAdminUsers} admin users</li>
                            <li>{Number(p.aiCreditsMonthly).toLocaleString('en-US')} AI credits a month</li>
                          </ul>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div role="radiogroup" aria-label="Credit pack" className="grid gap-3 sm:grid-cols-3">
                    {catalog.creditPacks.map((p: any) => (
                      <button key={p.code} type="button" role="radio" aria-checked={packCode === p.code} onClick={() => setPackCode(p.code)}
                        className={cn('cursor-pointer rounded-xl border p-4 text-left transition-colors', packCode === p.code ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:bg-brand-900/30' : 'border-[hsl(var(--border))] hover:border-brand-400')}>
                        <p className="font-display text-lg font-bold">{p.name}</p>
                        <p className="mt-1 tabular-nums text-xl font-semibold">{money(p.price, p.currency)}</p>
                        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{Number(p.credits).toLocaleString('en-US')} credits that never expire</p>
                      </button>
                    ))}
                  </div>
                )}

                {catalog.accounts.length > 1 && (
                  <div>
                    <label htmlFor="acct" className="mb-1.5 block text-sm font-medium">Pay into</label>
                    <select id="acct" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-10 w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                      {catalog.accounts.map((a: any) => <option key={a.id} value={a.id}>{a.label} ({a.currency})</option>)}
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[hsl(var(--border))] pt-4">
                  <div aria-live="polite">
                    {quoteError ? <p className="text-sm text-rose-700">{quoteError}</p> : quote ? (
                      <>
                        {quote.lineItems.map((l: any, i: number) => (<p key={i} className="flex max-w-md justify-between gap-6 text-sm"><span>{l.label}</span><span className="tabular-nums">{money(l.amount, quote.currency)}</span></p>))}
                        <p className="mt-1 flex max-w-md justify-between gap-6 font-semibold"><span>You pay</span><span className="tabular-nums">{money(quote.expectedAmount, quote.currency)}</span></p>
                      </>
                    ) : <p className="text-sm text-[hsl(var(--muted-foreground))]">Pick an option to see the price.</p>}
                  </div>
                  <Button size="lg" disabled={busy || !quote || !accountId} onClick={startPayment}>Continue to payment details</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? <p className="py-4 text-sm text-[hsl(var(--muted-foreground))]">No payments yet.</p> : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Date</th><th>For</th><th>Reference</th><th className="text-right">Amount</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">{formatDate(r.createdAt)}</td>
                      <td>{describeRequest(r)}</td>
                      <td className="font-mono text-xs">{r.reference}</td>
                      <td className="text-right tabular-nums">{money(r.expectedAmount, r.currency)}</td>
                      <td>
                        <Badge variant={REQUEST_STATUS[r.status]?.variant}>{REQUEST_STATUS[r.status]?.label ?? r.status}</Badge>
                        {r.status === 'REJECTED' && r.rejectReason && <p className="mt-1 max-w-xs text-xs text-rose-700">{r.rejectReason}</p>}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        {r.proof && <button type="button" className="mr-3 text-brand-700 hover:underline dark:text-brand-300" onClick={() => setProofFor(r.id)}>Proof</button>}
                        {r.receipt && <a href={`/receipt/${r.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300"><Printer className="h-3.5 w-3.5" aria-hidden="true" /> {r.receipt.number}</a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {proofFor && <ProofViewer id={proofFor} onClose={() => setProofFor(null)} />}
    </div>
  );
}
