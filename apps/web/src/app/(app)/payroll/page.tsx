'use client';

import Link from 'next/link';
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

type BankFileResult = {
  content: string;
  period: string;
  summary: { included: number; excluded: number; totalAmount: number };
  excluded: Array<{ employeeCode: string; name: string; problem: string }>;
};

type JournalResult = {
  filename: string;
  content: string;
  balanced: boolean;
  totals: Record<string, number>;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function downloadCsv(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function PayrollPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopen, setShowReopen] = useState(false);
  const [bank, setBank] = useState('generic');
  const [bankResult, setBankResult] = useState<BankFileResult | null>(null);
  const [journalResult, setJournalResult] = useState<JournalResult | null>(null);
  const [exportError, setExportError] = useState('');
  const [exportBusy, setExportBusy] = useState<'bank' | 'journal' | null>(null);
  const showReimbursements = Boolean(selected?.items?.some((item: any) => Number(item.breakdown?.reimbursements) > 0));

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
    setBankResult(null);
    setJournalResult(null);
    setExportError('');
    try {
      setSelected(await api.payroll.getRun(id));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load payroll run'));
    }
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

  async function generateBankFile() {
    if (!selected) return;
    setExportBusy('bank');
    setExportError('');
    setBankResult(null);
    try {
      setBankResult(await api.payroll.bankFile(selected.id, bank));
    } catch (err) {
      setExportError(errorMessage(err, 'Failed to generate bank file'));
    } finally {
      setExportBusy(null);
    }
  }

  async function exportJournal() {
    if (!selected) return;
    setExportBusy('journal');
    setExportError('');
    setJournalResult(null);
    try {
      const result: JournalResult = await api.payroll.journal(selected.id);
      setJournalResult(result);
      downloadCsv(result.content, result.filename);
    } catch (err) {
      setExportError(errorMessage(err, 'Failed to export accounting journal'));
    } finally {
      setExportBusy(null);
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
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
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
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Payroll {selected.period}</CardTitle>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{STATUS_HELP[selected.status]}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.status === 'DRAFT' && (
                <>
                  <Button data-testid="payroll-recalculate" variant="secondary" disabled={busy} onClick={() => act(() => api.payroll.recalculate(selected.id))}>Recalculate</Button>
                  <Button disabled={busy} onClick={() => act(() => api.payroll.submit(selected.id))}>Submit for Review</Button>
                </>
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
            {selected.status === 'DRAFT' && <p className="text-sm text-[hsl(var(--muted-foreground))]">Recalculate after approving loans or expense claims so this draft picks them up.</p>}
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

            <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                  <th className="p-2">Employee</th>
                  <th className="p-2">Gross</th>
                  <th className="p-2">Tax</th>
                  <th className="p-2">EOBI</th>
                  <th className="p-2">PF</th>
                  {showReimbursements && <th className="p-2">Reimbursements</th>}
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
                    {showReimbursements && <td className="p-2">{Number(item.breakdown?.reimbursements) > 0 ? formatCurrency(Number(item.breakdown.reimbursements)) : '—'}</td>}
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
            </div>
            {showReimbursements && <p className="text-xs text-[hsl(var(--muted-foreground))]">Net includes non-taxable expense reimbursements.</p>}

            {(selected.status === 'APPROVED' || selected.status === 'LOCKED') && (
              <section className="space-y-4 border-t border-[hsl(var(--border))] pt-6">
                <div>
                  <h2 className="text-lg font-semibold">Exports</h2>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Generate payment and accounting files for this approved payroll run.</p>
                </div>

                {exportError && (
                  <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    {exportError}
                    {/quickbooks|marketplace|plan|included|connect/i.test(exportError) && <> · <Link className="font-medium underline" href="/marketplace">Open Marketplace</Link></>}
                  </p>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-4 rounded-xl border border-[hsl(var(--border))] p-4">
                    <div>
                      <h3 className="font-semibold">Bank file</h3>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">Validate employee bank details and prepare a CSV.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="flex-1 space-y-1 text-sm font-medium">Bank
                        <select className="h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm" value={bank} onChange={(event) => { setBank(event.target.value); setBankResult(null); }}>
                          <option value="generic">Generic</option>
                          <option value="meezan">Meezan</option>
                          <option value="hbl">HBL</option>
                        </select>
                      </label>
                      <Button data-testid="bank-file-generate" disabled={exportBusy !== null} onClick={() => void generateBankFile()}>{exportBusy === 'bank' ? 'Generating…' : 'Generate bank file'}</Button>
                    </div>
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      Column layout not yet confirmed with the bank (validated: false) — confirm with your bank before uploading.
                    </div>
                    {bankResult && (
                      <div className="space-y-3">
                        <dl className="grid grid-cols-3 gap-2 text-sm">
                          <div><dt className="text-[hsl(var(--muted-foreground))]">Included</dt><dd className="font-semibold">{bankResult.summary.included}</dd></div>
                          <div><dt className="text-[hsl(var(--muted-foreground))]">Excluded</dt><dd className="font-semibold">{bankResult.summary.excluded}</dd></div>
                          <div><dt className="text-[hsl(var(--muted-foreground))]">Total</dt><dd className="font-semibold">{formatCurrency(bankResult.summary.totalAmount)}</dd></div>
                        </dl>
                        {!!bankResult.excluded.length && (
                          <div data-testid="bank-file-excluded" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                            <p className="font-semibold">Excluded from file — fix and regenerate</p>
                            <ul className="mt-2 space-y-2">{bankResult.excluded.map((item) => <li key={`${item.employeeCode}-${item.problem}`}><span className="font-mono">{item.employeeCode}</span> · {item.name}<br /><span className="text-amber-800 dark:text-amber-200">{item.problem}</span></li>)}</ul>
                          </div>
                        )}
                        <Button variant="secondary" onClick={() => downloadCsv(bankResult.content, `bank-${bank}-${bankResult.period}.csv`)}>Download CSV</Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 rounded-xl border border-[hsl(var(--border))] p-4">
                    <div>
                      <h3 className="font-semibold">Accounting journal (QuickBooks) <Badge variant="warning" className="ml-1">Beta</Badge></h3>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">Download a balanced journal ready for QuickBooks CSV import.</p>
                    </div>
                    <Button data-testid="journal-export" disabled={exportBusy !== null} onClick={() => void exportJournal()}>{exportBusy === 'journal' ? 'Exporting…' : 'Export journal CSV'}</Button>
                    {journalResult && (
                      <div className="space-y-3 rounded-lg bg-[hsl(var(--muted))] p-3 text-sm">
                        <p><span className="font-medium">Balanced:</span> <Badge variant={journalResult.balanced ? 'success' : 'danger'}>{journalResult.balanced ? 'Yes' : 'No'}</Badge></p>
                        <dl className="grid grid-cols-2 gap-2">{Object.entries(journalResult.totals).map(([name, value]) => <div key={name}><dt className="capitalize text-[hsl(var(--muted-foreground))]">{name}</dt><dd className="font-semibold">{formatCurrency(Number(value))}</dd></div>)}</dl>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
