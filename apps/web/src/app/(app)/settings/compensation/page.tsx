'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';

const TYPES = [
  { value: 'ALLOWANCE', label: 'Allowance', hint: 'Added to pay' },
  { value: 'BONUS', label: 'Bonus', hint: 'Added to pay' },
  { value: 'ARREARS', label: 'Arrears', hint: 'Added to pay' },
  { value: 'DEDUCTION', label: 'Deduction', hint: 'Taken from pay' },
];
const SELECT = 'h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 text-sm';

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>{children}{hint && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}</div>;
}
const blank = { type: 'ALLOWANCE', label: '', amount: '', recurring: true, startPeriod: '', endPeriod: '' };

export default function CompensationPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>(blank);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.employees.list({ limit: '500' }).then((r: any) => { const l = r.data ?? r.items ?? r; setEmployees(l); if (l[0]) setEmployeeId((cur) => cur || new URLSearchParams(window.location.search).get('employeeId') || l[0].id); }).catch((e) => setError(e.message));
  }, []);
  const load = useCallback(async () => {
    if (!employeeId) return;
    try { setItems(await api.payroll.compensationItems(employeeId)); } catch (e: any) { setError(e.message); }
  }, [employeeId]);
  useEffect(() => { setItems(null); load(); }, [load]);

  function open(it?: any) {
    setError(''); setEdit(it ?? {});
    setForm(it ? { type: it.type, label: it.label, amount: String(Number(it.amount)), recurring: it.recurring, startPeriod: it.startPeriod ?? '', endPeriod: it.endPeriod ?? '' } : blank);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const body: any = { type: form.type, label: form.label, amount: Number(form.amount), recurring: form.recurring, startPeriod: form.startPeriod || undefined, endPeriod: form.recurring ? form.endPeriod || undefined : undefined };
      if (edit.id) { body.endPeriod = form.recurring ? form.endPeriod : ''; body.startPeriod = form.startPeriod; await api.payroll.updateCompensationItem(edit.id, body); }
      else await api.payroll.createCompensationItem({ employeeId, ...body });
      setEdit(null); await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }
  async function remove(it: any) {
    if (!window.confirm(`Remove ${it.label}?`)) return;
    try { await api.payroll.deleteCompensationItem(it.id); await load(); } catch (e: any) { setError(e.message); }
  }

  const when = (it: any) => it.recurring ? `${it.startPeriod ?? 'Always'} → ${it.endPeriod ?? 'ongoing'}` : `Once, ${it.startPeriod ?? '—'}`;
  return (
    <div className="space-y-6">
      <PageHeader title="Pay components" description="Allowances, bonuses, arrears and deductions that payroll adds to or takes from one employee's pay. Every change is recorded in the audit log."
        backHref="/settings" backLabel="Settings" actions={<Button onClick={() => open()} disabled={!employeeId}><Plus className="h-4 w-4" aria-hidden="true" /> Add component</Button>} />
      <div className="max-w-sm">
        <Field id="c-emp" label="Employee">
          <select id="c-emp" className={SELECT} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </Field>
      </div>
      {error && !edit && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {!items ? <PageSkeleton /> : (
        <Card><CardHeader><CardTitle>Components</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {items.length === 0 ? <EmptyState title="Nothing set up" description="Add an allowance, bonus, arrears or deduction." /> : (
              <table className="data-table" data-testid="comp-table">
                <thead><tr><th>Name</th><th>Type</th><th className="text-right">Amount</th><th>Applies</th><th /></tr></thead>
                <tbody>{items.map((it) => (
                  <tr key={it.id}>
                    <td className="font-medium">{it.label}</td>
                    <td><Badge variant="neutral">{it.type.charAt(0) + it.type.slice(1).toLowerCase()}</Badge></td>
                    <td className="text-right tabular-nums">{Number(it.amount).toLocaleString()}</td>
                    <td className="text-sm">{when(it)}</td>
                    <td className="whitespace-nowrap text-right">
                      {it.sourceType ? <span className="text-xs text-[hsl(var(--muted-foreground))]">Managed by loans</span> : (<>
                        <Button size="sm" variant="secondary" onClick={() => open(it)}>Edit</Button>{' '}
                        <Button size="sm" variant="ghost" onClick={() => remove(it)}>Remove</Button></>)}
                    </td>
                  </tr>))}</tbody>
              </table>
            )}
          </CardContent></Card>
      )}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Edit component' : 'Add component'} description="Payroll picks this up for every month it applies to.">
          <form onSubmit={save} className="space-y-3">
            <Field id="k-type" label="Type"><select id="k-type" className={SELECT} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} — {t.hint}</option>)}</select></Field>
            <Field id="k-label" label="Name"><Input id="k-label" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
            <Field id="k-amount" label="Amount"><Input id="k-amount" required inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} /> Repeats every month</label>
            <div className="grid grid-cols-2 gap-3">
              <Field id="k-start" label={form.recurring ? 'Start month' : 'Month'}><Input id="k-start" type="month" required={!form.recurring} value={form.startPeriod} onChange={(e) => setForm({ ...form, startPeriod: e.target.value })} /></Field>
              {form.recurring && <Field id="k-end" label="End month" hint="Empty = until removed"><Input id="k-end" type="month" value={form.endPeriod} onChange={(e) => setForm({ ...form, endPeriod: e.target.value })} /></Field>}
            </div>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
