'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileText, Plus, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { cn, formatDate } from '@/lib/utils';
import { describeRequest, money, REQUEST_STATUS } from '@/components/billing/money';

const TABS = [
  { id: 'queue', label: 'To check' },
  { id: 'history', label: 'History' },
  { id: 'accounts', label: 'Payment accounts' },
  { id: 'plans', label: 'Plans and packs' },
  { id: 'settings', label: 'Settings' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function Err({ msg }: { msg: string }) {
  return msg ? <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{msg}</p> : null;
}
function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>{children}</div>;
}

function ProofModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let url = '';
    api.platformBilling.proof(id).then((f) => { url = f.url; setFile(f); }).catch((e) => setError(e.message));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return (
    <Modal open onClose={onClose} title="Payment proof" className="max-w-3xl">
      {error ? <Err msg={error} /> : !file ? <p className="text-sm">Loading…</p> : file.type === 'application/pdf'
        ? <iframe title="Payment proof" src={file.url} sandbox="" className="h-[70vh] w-full rounded-lg border" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={file.url} alt="Payment proof" className="max-h-[70vh] w-full object-contain" />}
    </Modal>
  );
}

function ReviewModal({ r, mode, onClose, onDone }: { r: any; mode: 'approve' | 'reject'; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsReason = mode === 'reject' || (amount !== '' && Number(amount).toFixed(2) !== Number(r.expectedAmount).toFixed(2)) || periodEnd !== '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'reject') await api.platformBilling.reject(r.id, reason);
      else await api.platformBilling.approve(r.id, { ...(amount ? { approvedAmount: Number(amount) } : {}), ...(periodEnd ? { periodEnd: new Date(periodEnd).toISOString() } : {}), ...(reason ? { reason } : {}) });
      onDone(); onClose();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={mode === 'approve' ? `Approve ${r.reference}` : `Reject ${r.reference}`}
      description={mode === 'approve' ? `${r.tenant.name}: ${describeRequest(r)}, expected ${money(r.expectedAmount, r.currency)}` : 'The customer sees this reason and starts a new request. Rejection is final.'}>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'approve' && (
          <>
            <Field id="ap-amt" label={`Amount received (leave empty if it equals ${money(r.expectedAmount, r.currency)})`}>
              <Input id="ap-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            {r.purpose === 'plan' && (
              <Field id="ap-end" label="New period end (leave empty to extend by the paid period)">
                <Input id="ap-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </Field>
            )}
          </>
        )}
        <Field id="ap-reason" label={mode === 'reject' ? 'Reason (required)' : needsReason ? 'Reason (required, because something differs)' : 'Note (optional)'}>
          <Input id="ap-reason" required={needsReason} minLength={needsReason ? 5 : undefined} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Err msg={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={mode === 'reject' ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Working…' : mode === 'approve' ? 'Approve and issue receipt' : 'Reject payment'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function RequestRow({ r, onProof, onReview }: { r: any; onProof: () => void; onReview?: (m: 'approve' | 'reject') => void }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{r.tenant.name} <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">({r.tenant.subdomain})</span></p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{describeRequest(r)} · reference <span className="font-mono">{r.reference}</span> · {formatDate(r.createdAt)}</p>
        </div>
        <Badge variant={REQUEST_STATUS[r.status]?.variant}>{REQUEST_STATUS[r.status]?.label ?? r.status}</Badge>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Expected</dt><dd className="font-semibold tabular-nums">{money(r.expectedAmount, r.currency)}</dd></div>
        <div>
          <dt className="text-xs text-[hsl(var(--muted-foreground))]">Customer says they paid</dt>
          <dd className={cn('tabular-nums', r.mismatch && 'font-semibold text-amber-700 dark:text-amber-300')}>
            {r.declaredAmount != null || r.declaredCurrency ? money(r.declaredAmount ?? r.expectedAmount, r.declaredCurrency ?? r.currency) : 'Not stated'}
            {r.mismatch && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" aria-label="Differs from expected" />}
          </dd>
        </div>
        <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Paid until / plan</dt><dd className="tabular-nums">{r.currentPeriodEnd ? formatDate(r.currentPeriodEnd) : 'No clock'} · {r.currentPlan ?? 'none'}</dd></div>
        <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Into account</dt><dd>{r.account?.label}</dd></div>
      </dl>
      {r.customerNote && <p className="mt-2 rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-sm">Customer note: {r.customerNote}</p>}
      {(r.reviewReason || r.rejectReason) && <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Reviewer: {r.reviewReason ?? r.rejectReason}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.proof && <Button size="sm" variant="secondary" onClick={onProof}><FileText className="h-4 w-4" aria-hidden="true" /> View proof</Button>}
        {r.receiptNumber && <a href={`/receipt/${r.id}?platform=1`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 text-sm font-medium hover:bg-[hsl(var(--muted))]"><Printer className="h-4 w-4" aria-hidden="true" /> {r.receiptNumber}</a>}
        {onReview && <>
          <Button size="sm" onClick={() => onReview('approve')}>Approve</Button>
          <Button size="sm" variant="danger" onClick={() => onReview('reject')}>Reject</Button>
        </>}
      </div>
    </div>
  );
}

function AccountModal({ account, onClose, onSaved }: { account?: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ label: '', bankName: '', accountTitle: '', accountNumber: '', iban: '', swift: '', currency: 'USD', instructions: '', ...(account ?? {}) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p: any) => ({ ...p, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const body = { label: f.label, bankName: f.bankName, accountTitle: f.accountTitle, accountNumber: f.accountNumber || undefined, iban: f.iban || undefined, swift: f.swift || undefined, currency: f.currency, instructions: f.instructions || undefined };
    try { account ? await api.platformBilling.updateAccount(account.id, body) : await api.platformBilling.createAccount(body); onSaved(); onClose(); }
    catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={account ? 'Edit payment account' : 'New payment account'} description="Customers see these details when they pay by bank transfer.">
      <form onSubmit={submit} className="space-y-3">
        <Field id="pa-label" label="Label (what you call it)"><Input id="pa-label" required value={f.label} onChange={set('label')} /></Field>
        <Field id="pa-bank" label="Bank"><Input id="pa-bank" required value={f.bankName} onChange={set('bankName')} /></Field>
        <Field id="pa-title" label="Account title"><Input id="pa-title" required value={f.accountTitle} onChange={set('accountTitle')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="pa-iban" label="IBAN"><Input id="pa-iban" value={f.iban ?? ''} onChange={set('iban')} /></Field>
          <Field id="pa-num" label="Account number"><Input id="pa-num" value={f.accountNumber ?? ''} onChange={set('accountNumber')} /></Field>
          <Field id="pa-swift" label="SWIFT"><Input id="pa-swift" value={f.swift ?? ''} onChange={set('swift')} /></Field>
          <Field id="pa-cur" label="Currency"><Input id="pa-cur" required maxLength={3} value={f.currency} onChange={set('currency')} /></Field>
        </div>
        <Field id="pa-ins" label="Instructions shown to the customer (optional)"><Input id="pa-ins" value={f.instructions ?? ''} onChange={set('instructions')} /></Field>
        <Err msg={error} />
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save account'}</Button></div>
      </form>
    </Modal>
  );
}

function PlanEditor({ plan, onClose, onSaved }: { plan: any; onClose: () => void; onSaved: () => void }) {
  const v = plan.versions.find((x: any) => x.isCurrent) ?? plan.versions[0];
  const [f, setF] = useState({ currency: v.currency, priceMonthly: v.priceMonthly ?? '', priceYearly: v.priceYearly ?? '', aiCreditsMonthly: String(v.aiCreditsMonthly), maxEmployees: v.maxEmployees ?? '', maxAdminUsers: v.maxAdminUsers ?? '', overagePerEmployee: v.overagePerEmployee ?? '', isActive: plan.isActive, offeredToNew: v.offeredToNew });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p: any) => ({ ...p, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const n = (x: any) => (x === '' || x == null ? undefined : Number(x));
    try {
      await api.platformBilling.editPlan(plan.code, { currency: f.currency, priceMonthly: n(f.priceMonthly), priceYearly: n(f.priceYearly), aiCreditsMonthly: n(f.aiCreditsMonthly), maxEmployees: n(f.maxEmployees), maxAdminUsers: n(f.maxAdminUsers), overagePerEmployee: n(f.overagePerEmployee), isActive: f.isActive, offeredToNew: f.offeredToNew });
      onSaved(); onClose();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={`Edit ${plan.name}`} description={`Edits version ${v.version}. Customers already approved keep what they paid for; new quotes use these numbers. Every change is audited.`}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field id="pl-cur" label="Currency"><Input id="pl-cur" maxLength={3} value={f.currency} onChange={set('currency')} /></Field>
          <Field id="pl-m" label="Monthly price"><Input id="pl-m" inputMode="decimal" value={f.priceMonthly} onChange={set('priceMonthly')} /></Field>
          <Field id="pl-y" label="Yearly price"><Input id="pl-y" inputMode="decimal" value={f.priceYearly} onChange={set('priceYearly')} /></Field>
          <Field id="pl-ai" label="AI credits / month"><Input id="pl-ai" inputMode="numeric" value={f.aiCreditsMonthly} onChange={set('aiCreditsMonthly')} /></Field>
          <Field id="pl-emp" label="Employee limit"><Input id="pl-emp" inputMode="numeric" value={f.maxEmployees} onChange={set('maxEmployees')} /></Field>
          <Field id="pl-adm" label="Admin users"><Input id="pl-adm" inputMode="numeric" value={f.maxAdminUsers} onChange={set('maxAdminUsers')} /></Field>
        </div>
        <Field id="pl-over" label="Price per extra employee (empty = hard limit)"><Input id="pl-over" inputMode="decimal" value={f.overagePerEmployee} onChange={set('overagePerEmployee')} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => setF((p: any) => ({ ...p, isActive: e.target.checked }))} /> Plan is active</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.offeredToNew} onChange={(e) => setF((p: any) => ({ ...p, offeredToNew: e.target.checked }))} /> Offered to new customers in Billing</label>
        <Err msg={error} />
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
      </form>
    </Modal>
  );
}

export default function PlatformBillingPage() {
  const [tab, setTab] = useState<Tab>('queue');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [review, setReview] = useState<{ r: any; mode: 'approve' | 'reject' } | null>(null);
  const [account, setAccount] = useState<any | 'new' | null>(null);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const P = api.platformBilling;
      setData(tab === 'queue' ? await P.queue() : tab === 'history' ? await P.history() : tab === 'accounts' ? await P.accounts()
        : tab === 'settings' ? await P.settings() : { plans: await P.plans(), packs: await P.packs() });
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { setData(null); load(); }, [load]);

  const [packEdit, setPackEdit] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  useEffect(() => { if (tab === 'settings' && data) setSettings({ graceDays: String(data.graceDays), provisionalHours: String(data.provisionalHours), reminderDays: data.reminderDays }); }, [tab, data]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try { await api.platformBilling.updateSettings({ graceDays: Number(settings.graceDays), provisionalHours: Number(settings.provisionalHours), reminderDays: settings.reminderDays }); setSaved('Saved'); setTimeout(() => setSaved(''), 2000); }
    catch (err: any) { setError(err.message); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Check bank-transfer proofs, manage where customers pay, and edit plans" />
      <div role="tablist" aria-label="Billing sections" className="flex flex-wrap gap-1 border-b border-[hsl(var(--border))]">
        {TABS.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn('-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-sm font-medium transition-colors', tab === t.id ? 'border-brand-600 text-brand-800 dark:text-brand-300' : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
            {t.label}{t.id === 'queue' && tab === 'queue' && data ? ` (${data.length})` : ''}
          </button>
        ))}
      </div>
      <Err msg={error} />
      {loading && !data ? <PageSkeleton /> : null}

      {tab === 'queue' && data && (data.length === 0
        ? <EmptyState title="Nothing to check" description="New payment proofs from customers will appear here." />
        : <div className="space-y-3">{data.map((r: any) => <RequestRow key={r.id} r={r} onProof={() => setProof(r.id)} onReview={(m) => setReview({ r, mode: m })} />)}</div>)}

      {tab === 'history' && data && (data.length === 0
        ? <EmptyState title="No decisions yet" />
        : <div className="space-y-3">{data.map((r: any) => <RequestRow key={r.id} r={r} onProof={() => setProof(r.id)} />)}</div>)}

      {tab === 'accounts' && data && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => setAccount('new')}><Plus className="h-4 w-4" aria-hidden="true" /> Add account</Button></div>
          {data.length === 0 ? <EmptyState title="No payment accounts yet" description="Add the bank account customers should pay into. Until you do, they cannot start a payment." /> : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.map((a: any) => (
                <Card key={a.id}>
                  <CardContent className="space-y-1 p-5">
                    <div className="flex items-start justify-between gap-3"><p className="font-semibold">{a.label}</p><Badge variant={a.isActive ? 'success' : 'neutral'}>{a.isActive ? 'Active' : 'Inactive'}</Badge></div>
                    <p className="text-sm">{a.bankName} · {a.accountTitle}</p>
                    <p className="font-mono text-sm">{a.iban || a.accountNumber}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{a.currency}</p>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="secondary" onClick={() => setAccount(a)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={async () => { try { await api.platformBilling.updateAccount(a.id, { isActive: !a.isActive }); load(); } catch (e: any) { setError(e.message); } }}>{a.isActive ? 'Deactivate' : 'Activate'}</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'plans' && data && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            {data.plans.map((p: any) => {
              const v = p.versions.find((x: any) => x.isCurrent) ?? p.versions[0];
              return (
                <Card key={p.code}>
                  <CardContent className="space-y-1 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display text-lg font-bold">{p.name} <span className="font-mono text-xs font-normal text-[hsl(var(--muted-foreground))]">{p.code}</span></p>
                      <div className="flex gap-1">{v.offeredToNew ? <Badge variant="success">Offered</Badge> : <Badge variant="neutral">Not offered</Badge>}{!p.isActive && <Badge variant="danger">Inactive</Badge>}</div>
                    </div>
                    <p className="text-sm tabular-nums">{v.priceMonthly ? `${money(v.priceMonthly, v.currency)} / month, ${money(v.priceYearly, v.currency)} / year` : `Legacy: PKR ${v.legacyPricePkrMonthly ?? '—'} / month`}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{v.maxEmployees ? `${v.maxEmployees} employees` : 'No employee limit'}{v.overagePerEmployee ? ` + ${money(v.overagePerEmployee, v.currency)} each extra` : ''} · {v.maxAdminUsers ?? '∞'} admins · {v.aiCreditsMonthly} AI credits/mo</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{v.subscribers} tenant{v.subscribers === 1 ? '' : 's'} on this version{p.versions.length > 1 ? ` · ${p.versions.length} versions` : ''}</p>
                    <div className="pt-2"><Button size="sm" variant="secondary" onClick={() => setEditPlan(p)}>Edit</Button></div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card>
            <CardHeader><CardTitle>AI credit packs</CardTitle></CardHeader>
            <CardContent>
              <table className="data-table"><thead><tr><th>Pack</th><th>Credits</th><th>Price</th><th>Status</th><th /></tr></thead>
                <tbody>{data.packs.map((p: any) => (
                  <tr key={p.code}><td>{p.name}</td><td className="tabular-nums">{p.credits.toLocaleString('en-US')}</td><td className="tabular-nums">{money(p.price, p.currency)}</td><td><Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setPackEdit(p)}>Edit</Button></td></tr>
                ))}</tbody></table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'settings' && settings && (
        <Card className="max-w-xl"><CardContent className="p-6">
          <form onSubmit={saveSettings} className="space-y-4">
            <Field id="st-grace" label="Grace days after the period ends (full access, with a banner)"><Input id="st-grace" inputMode="numeric" value={settings.graceDays} onChange={(e) => setSettings({ ...settings, graceDays: e.target.value })} /></Field>
            <Field id="st-prov" label="Provisional access hours while a proof is under review"><Input id="st-prov" inputMode="numeric" value={settings.provisionalHours} onChange={(e) => setSettings({ ...settings, provisionalHours: e.target.value })} /></Field>
            <Field id="st-rem" label="Reminder emails, days before expiry (0 = on expiry)"><Input id="st-rem" value={settings.reminderDays} onChange={(e) => setSettings({ ...settings, reminderDays: e.target.value })} /></Field>
            <div className="flex items-center gap-3"><Button type="submit">Save settings</Button>{saved && <span role="status" className="text-sm text-emerald-700">{saved}</span>}</div>
          </form>
        </CardContent></Card>
      )}

      {proof && <ProofModal id={proof} onClose={() => setProof(null)} />}
      {review && <ReviewModal r={review.r} mode={review.mode} onClose={() => setReview(null)} onDone={load} />}
      {account && <AccountModal account={account === 'new' ? undefined : account} onClose={() => setAccount(null)} onSaved={load} />}
      {editPlan && <PlanEditor plan={editPlan} onClose={() => setEditPlan(null)} onSaved={load} />}
      {packEdit && (
        <Modal open onClose={() => setPackEdit(null)} title={`Edit ${packEdit.name} pack`}>
          <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await api.platformBilling.editPack(packEdit.code, { credits: Number(packEdit.credits), price: Number(packEdit.price), isActive: packEdit.isActive }); setPackEdit(null); load(); } catch (err: any) { setError(err.message); setPackEdit(null); } }}>
            <Field id="pk-c" label="Credits"><Input id="pk-c" inputMode="numeric" value={packEdit.credits} onChange={(e) => setPackEdit({ ...packEdit, credits: e.target.value })} /></Field>
            <Field id="pk-p" label="Price"><Input id="pk-p" inputMode="decimal" value={packEdit.price} onChange={(e) => setPackEdit({ ...packEdit, price: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={packEdit.isActive} onChange={(e) => setPackEdit({ ...packEdit, isActive: e.target.checked })} /> Active</label>
            <div className="flex justify-end"><Button type="submit">Save</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
