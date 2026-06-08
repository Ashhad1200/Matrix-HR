'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import { PermissionGate } from '@/components/permission-gate';

export default function LeavePage() {
  const [balances, setBalances] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [whosOut, setWhosOut] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ policyId: '', startDate: '', endDate: '', reason: '' });

  useEffect(() => {
    Promise.all([
      api.leave.balances(),
      api.leave.requests(),
      api.leave.policies(),
      api.leave.whosOut(),
    ]).then(([b, r, p, w]) => {
      setBalances(b);
      setRequests(r);
      setPolicies(p);
      setWhosOut(w);
    }).catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await api.leave.createRequest(form);
    setShowForm(false);
    const r = await api.leave.requests();
    setRequests(r);
  }

  async function handleApprove(id: string) {
    await api.leave.approve(id);
    setRequests(await api.leave.requests());
    setBalances(await api.leave.balances());
  }

  async function handleReject(id: string) {
    await api.leave.reject(id, 'Not approved at this time');
    setRequests(await api.leave.requests());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leave Management</h1>
        <Button onClick={() => setShowForm(!showForm)}>Apply for Leave</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {balances.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-6">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{b.policy.name}</p>
              <p className="text-3xl font-bold">{Number(b.entitled) - Number(b.used) - Number(b.pending)}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">days remaining</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Leave Request</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <select
                className="h-10 rounded-lg border border-[hsl(var(--border))] px-3"
                value={form.policyId}
                onChange={(e) => setForm({ ...form, policyId: e.target.value })}
                required
              >
                <option value="">Select policy</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
              <Input placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <Button type="submit">Submit</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Leave Requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] p-3">
                <div>
                  <p className="font-medium">{r.employee?.firstName} {r.employee?.lastName}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {r.policy.name} · {formatDate(r.startDate)} – {formatDate(r.endDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${
                    r.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    r.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>{r.status}</span>
                  {r.status === 'PENDING' && (
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
