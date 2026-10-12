'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import { PermissionGate } from '@/components/permission-gate';
import { useAction } from '@/hooks/use-action';
import { useAuth } from '@/hooks/use-auth';
import { ErrorAlert } from '@/components/ui/alert';

const EMPTY = { policyId: '', startDate: '', endDate: '', reason: '', isHalfDay: false };

export default function LeavePage() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [whosOut, setWhosOut] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // id of the pending request being edited
  const [preview, setPreview] = useState<number | null>(null);
  const action = useAction();
  const [form, setForm] = useState(EMPTY);

  async function reload() {
    const [b, r] = await Promise.all([api.leave.balances(), api.leave.requests()]);
    setBalances(b); setRequests(r);
  }

  useEffect(() => {
    Promise.all([api.leave.balances(), api.leave.requests(), api.leave.policies(), api.leave.whosOut()])
      .then(([b, r, p, w]) => { setBalances(b); setRequests(r); setPolicies(p); setWhosOut(w); })
      .catch(console.error);
  }, []);

  // Live "this will take N working days" so people see weekends and holidays are not deducted.
  useEffect(() => {
    setPreview(null);
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return;
    let live = true;
    api.leave.workingDays(form.startDate, form.endDate).then((r) => live && setPreview(form.isHalfDay ? 0.5 : r.days)).catch(() => undefined);
    return () => { live = false; };
  }, [form.startDate, form.endDate, form.isHalfDay]);

  function openNew() { setEditing(null); setForm(EMPTY); setShowForm(true); action.clear(); }
  function openEdit(r: any) {
    setEditing(r.id);
    setForm({ policyId: r.policyId, startDate: r.startDate.slice(0, 10), endDate: r.endDate.slice(0, 10), reason: r.reason ?? '', isHalfDay: !!r.isHalfDay });
    setShowForm(true); action.clear();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await action.run(() => (editing ? api.leave.update(editing, form) : api.leave.createRequest(form)));
    if (ok) { setShowForm(false); setEditing(null); setForm(EMPTY); await reload(); }
  }

  async function handleApprove(id: string) { if (await action.run(() => api.leave.approve(id))) await reload(); }
  async function handleReject(id: string) { if (await action.run(() => api.leave.reject(id, 'Not approved at this time'))) await reload(); }
  async function handleCancel(id: string) {
    if (!window.confirm('Cancel this leave request? The days go back to your balance.')) return;
    if (await action.run(() => api.leave.cancel(id))) await reload();
  }

  const mine = (r: any) => !!user?.employeeId && r.employeeId === user.employeeId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leave Management</h1>
        <Button onClick={() => (showForm ? setShowForm(false) : openNew())}>Apply for Leave</Button>
      </div>
      <ErrorAlert message={action.error} />

      <div className="grid gap-4 sm:grid-cols-3">
        {balances.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-6">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{b.policy.name}</p>
              <p className="text-3xl font-bold">{Number(b.entitled) + Number(b.carried ?? 0) - Number(b.used) - Number(b.pending)}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">days remaining</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>{editing ? 'Edit leave request' : 'Apply for Leave'}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-4">
              <select aria-label="Leave type" value={form.policyId} onChange={(e) => setForm({ ...form, policyId: e.target.value })} required className="h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                <option value="">Select policy</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Input aria-label="Start date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              <Input aria-label="End date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
              <Input aria-label="Reason" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isHalfDay} onChange={(e) => setForm({ ...form, isHalfDay: e.target.checked })} /> Half day</label>
              <p data-testid="leave-days-preview" className="text-sm text-[hsl(var(--muted-foreground))] sm:col-span-2" aria-live="polite">
                {preview === null ? 'Pick dates to see how many working days this takes.' : `${preview} working day${preview === 1 ? '' : 's'} (weekends and public holidays are not counted).`}
              </p>
              <div className="flex gap-2 sm:col-span-4">
                <Button type="submit">{editing ? 'Save changes' : 'Submit'}</Button>
                {editing && <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Discard</Button>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Leave Requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {requests.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No leave requests yet.</p>}
            {requests.map((r) => (
              <div key={r.id} data-testid="leave-request" className="flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] p-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.employee?.firstName} {r.employee?.lastName}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {r.policy.name} · {formatDate(r.startDate)} – {formatDate(r.endDate)} · {Number(r.days)} day{Number(r.days) === 1 ? '' : 's'}
                  </p>
                  {r.reason && <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{r.reason}</p>}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${
                    r.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    r.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    r.status === 'CANCELLED' ? 'bg-slate-100 text-slate-700' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>{r.status}</span>
                  {r.status === 'PENDING' && mine(r) && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleCancel(r.id)}>Cancel</Button>
                    </>
                  )}
                  {r.status === 'PENDING' && !mine(r) && (
                    <PermissionGate action="leave" subAction="approve">
                      <>
                        <Button size="sm" onClick={() => handleApprove(r.id)}>Approve</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleReject(r.id)}>Reject</Button>
                      </>
                    </PermissionGate>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Who&apos;s Out</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {whosOut.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Everyone is in today</p>
            ) : whosOut.map((r) => (
              <div key={r.id} className="rounded-lg border border-[hsl(var(--border))] p-3">
                <p className="font-medium">{r.employee.firstName} {r.employee.lastName}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {r.policy.name} until {formatDate(r.endDate)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
