'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

const blank = { name: '', code: '', daysPerYear: '14', carryForwardMax: '', allowHalfDay: true, genderRestriction: '' };

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>{children}{hint && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}</div>;
}

export default function LeaveSetupPage() {
  const year = new Date().getFullYear();
  const [policies, setPolicies] = useState<any[] | null>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [edit, setEdit] = useState<any>(null); // policy being edited, or {} for a new one
  const [form, setForm] = useState<any>(blank);
  const [hol, setHol] = useState({ name: '', date: '', isOptional: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const [p, h] = await Promise.all([api.leaveSetup.policies(), api.leaveSetup.holidays(year)]); setPolicies(p); setHolidays(h); }
    catch (e: any) { setError(e.message); }
  }, [year]);
  useEffect(() => { load(); }, [load]);

  function open(p?: any) {
    setError('');
    setEdit(p ?? {});
    setForm(p ? { name: p.name, code: p.code, daysPerYear: String(Number(p.daysPerYear)), carryForwardMax: p.carryForwardMax == null ? '' : String(Number(p.carryForwardMax)), allowHalfDay: p.allowHalfDay, genderRestriction: p.genderRestriction ?? '' } : blank);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const body: any = { name: form.name, daysPerYear: Number(form.daysPerYear), allowHalfDay: form.allowHalfDay };
      if (edit.id) {
        body.carryForwardMax = form.carryForwardMax === '' ? null : Number(form.carryForwardMax);
        body.genderRestriction = form.genderRestriction || null;
        const r = await api.leaveSetup.updatePolicy(edit.id, body);
        setNotice(r.balancesAdjusted ? `Saved. ${r.balancesAdjusted} people's ${year} balances were updated.` : 'Saved.');
      } else {
        body.code = form.code;
        if (form.carryForwardMax !== '') body.carryForwardMax = Number(form.carryForwardMax);
        if (form.genderRestriction) body.genderRestriction = form.genderRestriction;
        const r = await api.leaveSetup.createPolicy(body);
        setNotice(`Created. ${r.balancesCreated} ${r.balancesCreated === 1 ? 'person' : 'people'} now have a ${year} balance.`);
      }
      setEdit(null); await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try { await api.leaveSetup.createHoliday({ name: hol.name, date: hol.date, isOptional: hol.isOptional }); setHol({ name: '', date: '', isOptional: false }); await load(); }
    catch (err: any) { setError(err.message); }
  }

  if (!policies) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Leave setup" description="Define the leave types your company offers and the holiday calendar. Every employee gets a balance for each leave type automatically."
        backHref="/settings" backLabel="Settings"
        actions={<>
          <Button variant="secondary" disabled={busy} onClick={async () => { setBusy(true); try { const r = await api.leaveSetup.rebuild(); setNotice(r.created ? `Created ${r.created} missing ${year} balances.` : 'Everyone already has their balances.'); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Create missing balances</Button>
          <Button onClick={() => open()}><Plus className="h-4 w-4" aria-hidden="true" /> New leave type</Button>
        </>} />
      {error && !edit && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}

      <Card>
        <CardHeader><CardTitle>Leave types</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {policies.length === 0 ? <EmptyState title="No leave types yet" description="Add annual, sick or casual leave. People get a balance as soon as you save." /> : (
            <table className="data-table">
              <thead><tr><th>Name</th><th className="text-right">Days a year</th><th className="text-right">Carries over</th><th>Notes</th><th /></tr></thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td><span className="font-medium">{p.name}</span> <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{p.code}</span>{!p.isActive && <Badge className="ml-2" variant="neutral">Not offered</Badge>}</td>
                    <td className="text-right tabular-nums">{Number(p.daysPerYear)}</td>
                    <td className="text-right tabular-nums">{p.carryForwardMax == null ? 'Nothing' : `Up to ${Number(p.carryForwardMax)}`}</td>
                    <td className="text-sm text-[hsl(var(--muted-foreground))]">{[p.genderRestriction && `${p.genderRestriction} only`, !p.allowHalfDay && 'No half days'].filter(Boolean).join(', ') || '—'}</td>
                    <td className="whitespace-nowrap text-right">
                      <Button size="sm" variant="secondary" onClick={() => open(p)}>Edit</Button>{' '}
                      <Button size="sm" variant="ghost" onClick={async () => { try { await api.leaveSetup.updatePolicy(p.id, { isActive: !p.isActive }); load(); } catch (e: any) { setError(e.message); } }}>{p.isActive ? 'Stop offering' : 'Offer again'}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Holidays in {year}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addHoliday} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1"><Field id="h-name" label="Holiday"><Input id="h-name" required value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} /></Field></div>
            <div><Field id="h-date" label="Date"><Input id="h-date" type="date" required value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} /></Field></div>
            <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={hol.isOptional} onChange={(e) => setHol({ ...hol, isOptional: e.target.checked })} /> Optional</label>
            <Button type="submit"><Plus className="h-4 w-4" aria-hidden="true" /> Add</Button>
          </form>
          {holidays.length === 0 ? <p className="text-sm text-[hsl(var(--muted-foreground))]">No holidays added for {year}.</p> : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {holidays.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span><span className="font-medium">{h.name}</span> {h.isOptional && <Badge variant="neutral">Optional</Badge>}<span className="block text-sm text-[hsl(var(--muted-foreground))]">{formatDate(h.date)}</span></span>
                  <button type="button" aria-label={`Delete ${h.name}`} className="cursor-pointer rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-rose-700" onClick={async () => { try { await api.leaveSetup.deleteHoliday(h.id); load(); } catch (e: any) { setError(e.message); } }}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? `Edit ${edit.name}` : 'New leave type'} description="Each person gets this many days at the start of the year.">
          <form onSubmit={save} className="space-y-3">
            <Field id="lp-name" label="Name"><Input id="lp-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            {!edit.id && <Field id="lp-code" label="Short code" hint="Lowercase, for example annual or sick. Cannot be changed later."><Input id="lp-code" required pattern="[a-z][a-z0-9_\-]{1,30}" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>}
            <div className="grid grid-cols-2 gap-3">
              <Field id="lp-days" label="Days a year"><Input id="lp-days" inputMode="decimal" required value={form.daysPerYear} onChange={(e) => setForm({ ...form, daysPerYear: e.target.value })} /></Field>
              <Field id="lp-carry" label="Carry over up to" hint="Empty = unused days expire"><Input id="lp-carry" inputMode="decimal" value={form.carryForwardMax} onChange={(e) => setForm({ ...form, carryForwardMax: e.target.value })} /></Field>
            </div>
            <Field id="lp-gender" label="Only for (optional)" hint="For example Female for maternity leave. Everyone else will not get this leave type."><Input id="lp-gender" value={form.genderRestriction} onChange={(e) => setForm({ ...form, genderRestriction: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowHalfDay} onChange={(e) => setForm({ ...form, allowHalfDay: e.target.checked })} /> Allow half days</label>
            {edit.id && <p className="text-xs text-[hsl(var(--muted-foreground))]">Changing the days a year updates everyone&rsquo;s balance for {year}. Days already taken are kept.</p>}
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
