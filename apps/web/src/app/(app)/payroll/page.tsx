'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { PermissionGate } from '@/components/permission-gate';

const STATUS_HELP: Record<string, string> = {
  DRAFT: 'Being prepared. Submit for review when ready.',
  REVIEW: 'Awaiting approval from someone other than the preparer.',
  APPROVED: 'Approved — lock to generate and archive payslips.',
  LOCKED: 'Locked. Payslips are generated. Reopening requires a reason and admin approval.',
};

export default function PayrollPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopen, setShowReopen] = useState(false);

  function load() {
    api.payroll.runs().then(setRuns).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function createRun() {
    setError('');
    const period = new Date().toISOString().slice(0, 7);
    try {
      await api.payroll.createRun(period);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function viewRun(id: string) {
    setError('');
    setShowReopen(false);
    setSelected(await api.payroll.getRun(id));
  }

  async function act(action: () => Promise<any>) {
    setBusy(true);
    setError('');
    try {
      await action();
      load();
      if (selected) setSelected(await api.payroll.getRun(selected.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payroll</h1>
        <PermissionGate action="payroll" subAction="run">
          <Button onClick={createRun}>Run Payroll</Button>
        </PermissionGate>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      <Card>
        <CardHeader><CardTitle>Payroll Runs</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-[hsl(var(--muted-foreground))]">
                <th className="p-3">Period</th>
                <th className="p-3">Status</th>
                <th className="p-3">Employees</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-3 font-mono">{r.period}</td>
                  <td className="p-3"><Badge variant={statusVariant(r.status)}>{r.status}</Badge></td>
                  <td className="p-3">{r._count?.items}</td>
                  <td className="p-3">
                    <Button size="sm" variant="secondary" onClick={() => viewRun(r.id)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Payroll {selected.period}</CardTitle>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{STATUS_HELP[selected.status]}</p>
            </div>
            <div className="flex gap-2">
              {selected.status === 'DRAFT' && (
                <Button disabled={busy} onClick={() => act(() => api.payroll.submit(selected.id))}>Submit for Review</Button>
              )}
              {selected.status === 'REVIEW' && (
                <PermissionGate action="payroll" subAction="approve">
                  <Button disabled={busy} onClick={() => act(() => api.payroll.approve(selected.id))}>Approve</Button>
                </PermissionGate>
              )}
              {selected.status === 'APPROVED' && (
                <PermissionGate action="payroll" subAction="approve">
                  <Button disabled={busy} onClick={() => act(() => api.payroll.lock(selected.id))}>Lock &amp; Generate Payslips</Button>
                </PermissionGate>
              )}
              {selected.status === 'LOCKED' && !showReopen && (
                <Button variant="secondary" disabled={busy} onClick={() => setShowReopen(true)}>Reopen</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showReopen && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                <input
                  className="h-9 flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                  placeholder="Reason for reopening (required)"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={busy || !reopenReason.trim()}
                  onClick={() => act(() => api.payroll.reopen(selected.id, reopenReason)).then(() => { setShowReopen(false); setReopenReason(''); })}
                >
                  Confirm Reopen
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowReopen(false)}>Cancel</Button>
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                  <th className="p-2">Employee</th>
                  <th className="p-2">Gross</th>
                  <th className="p-2">Tax</th>
                  <th className="p-2">EOBI</th>
                  <th className="p-2">PF</th>
                  <th className="p-2">Net</th>
                  {selected.status === 'LOCKED' && <th className="p-2">Payslip</th>}
                </tr>
              </thead>
              <tbody>
                {selected.items?.map((item: any) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-2">{item.employee.firstName} {item.employee.lastName}</td>
                    <td className="p-2">{formatCurrency(Number(item.grossSalary))}</td>
                    <td className="p-2">{formatCurrency(Number(item.taxAmount))}</td>
                    <td className="p-2">{formatCurrency(Number(item.eobiAmount))}</td>
                    <td className="p-2">{formatCurrency(Number(item.pfAmount))}</td>
                    <td className="p-2 font-medium">{formatCurrency(Number(item.netSalary))}</td>
                    {selected.status === 'LOCKED' && (
                      <td className="p-2">
                        <button
                          type="button"
                          className="text-brand-600 hover:underline"
                          onClick={async () => {
                            const { url } = await api.payroll.payslipUrl(selected.id, item.id);
                            window.open(url, '_blank');
                          }}
                        >
                          View PDF
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
