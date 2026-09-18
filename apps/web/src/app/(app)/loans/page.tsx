'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';

type LoanStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
type LoanType = 'LOAN' | 'ADVANCE';
type Approval = { action: 'APPROVE' | 'REJECT'; actorRole: string; comment?: string | null; createdAt: string };
type LoanRequest = {
  id: string; type: LoanType; amount: string | number; installments: number | null; firstDeductionPeriod: string;
  reason: string | null; status: LoanStatus; decidedAt: string | null;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string; baseSalary?: string | number };
  schedule?: Array<{ period: string; amount: string | number; deducted: boolean }>;
  outstanding?: string | number;
  approvals?: { status: 'pending' | 'approved' | 'rejected'; awaitingRole: 'HR_MANAGER' | 'COMPANY_ADMIN' | null; history: Approval[] } | null;
};

const INPUT_CLASS = 'h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm';
const TEXTAREA_CLASS = 'min-h-20 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm';
const STATUSES: LoanStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'];

function monthOptions() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { value, label: date.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' }) };
  });
}

function label(value: string | null | undefined) {
  return value ? value.toLowerCase().replaceAll('_', ' ') : '—';
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function RequestsTable({ requests, onView, onCancel, busy }: { requests: LoanRequest[]; onView: (id: string) => void; onCancel?: (id: string) => void; busy: boolean }) {
  if (!requests.length) return <p className="py-4 text-sm text-[hsl(var(--muted-foreground))]">No requests found.</p>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left text-[hsl(var(--muted-foreground))]"><th className="p-3">Type</th><th className="p-3">Amount</th><th className="p-3">Instalments</th><th className="p-3">First month</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id} data-testid="loan-row" className="border-b border-[hsl(var(--border))]"><td className="p-3 font-medium">{request.type === 'ADVANCE' ? 'Salary advance' : 'Loan'}</td><td className="p-3">{formatCurrency(Number(request.amount))}</td><td className="p-3">{request.type === 'ADVANCE' ? 1 : request.installments}</td><td className="p-3 font-mono">{request.firstDeductionPeriod}</td><td className="p-3"><Badge variant={statusVariant(request.status)}>{label(request.status)}</Badge></td><td className="p-3"><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => onView(request.id)}>View</Button>{request.status === 'PENDING' && onCancel && <Button size="sm" variant="danger" disabled={busy} onClick={() => onCancel(request.id)}>Cancel</Button>}</div></td></tr>)}</tbody></table></div>;
}

export default function LoansPage() {
  const { user } = useAuth();
  const isAdmin = user?.permissions.portal === 'admin';
  const months = useMemo(monthOptions, []);
  const [form, setForm] = useState({ type: 'LOAN' as LoanType, amount: '', installments: '2', firstDeductionPeriod: months[0]?.value ?? '', reason: '' });
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [inbox, setInbox] = useState<LoanRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LoanRequest[]>([]);
  const [selected, setSelected] = useState<LoanRequest | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setRequests(await api.loans.list() as LoanRequest[]);
      if (isAdmin) {
        const [inboxData, allData] = await Promise.all([
          api.loans.inbox() as Promise<LoanRequest[]>,
          api.loans.list(statusFilter ? { status: statusFilter } : undefined) as Promise<LoanRequest[]>,
        ]);
        setInbox(inboxData); setAllRequests(allData);
      }
    } catch (err) { setError(message(err)); } finally { setLoading(false); }
  }, [isAdmin, statusFilter, user]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function viewRequest(id: string) {
    setError('');
    try { setSelected(await api.loans.get(id) as LoanRequest); } catch (err) { setError(message(err)); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const created = await api.loans.create({
        type: form.type,
        amount: Number(form.amount),
        ...(form.type === 'LOAN' ? { installments: Number(form.installments) } : {}),
        firstDeductionPeriod: form.firstDeductionPeriod,
        reason: form.reason.trim() || undefined,
      }) as LoanRequest;
      setSelected(created);
      setForm({ type: 'LOAN', amount: '', installments: '2', firstDeductionPeriod: months[0]?.value ?? '', reason: '' });
      await loadData();
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }

  async function act(id: string, action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try {
      const result = await action();
      if (result && typeof result === 'object' && 'id' in result) setSelected(result as LoanRequest);
      await loadData();
      if (selected?.id === id) await viewRequest(id);
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }

  const selectedInInbox = selected ? inbox.some((request) => request.id === selected.id) : false;

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Loans &amp; advances</h1><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Requests are approved by HR, then an administrator. Approved loans are deducted in equal monthly instalments from payroll.</p></div>
    {error && <p data-testid="loan-error" className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

    <Card><CardHeader><CardTitle>Request a loan or advance</CardTitle></CardHeader><CardContent className="space-y-5">
      <form data-testid="loan-form" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
        <label className="space-y-1 text-sm font-medium">Type<select data-testid="loan-type" className={INPUT_CLASS} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as LoanType })}><option value="LOAN">Loan</option><option value="ADVANCE">Salary advance</option></select></label>
        <label className="space-y-1 text-sm font-medium">Amount<Input data-testid="loan-amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label>
        {form.type === 'LOAN' && <label className="space-y-1 text-sm font-medium">Instalments<Input data-testid="loan-installments" type="number" min="2" max="36" step="1" value={form.installments} onChange={(event) => setForm({ ...form, installments: event.target.value })} required /></label>}
        <label className="space-y-1 text-sm font-medium">First deduction month<select data-testid="loan-period" className={INPUT_CLASS} value={form.firstDeductionPeriod} onChange={(event) => setForm({ ...form, firstDeductionPeriod: event.target.value })}>{months.map((month) => <option key={month.value} value={month.value}>{month.label} ({month.value})</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium sm:col-span-2 lg:col-span-4">Reason (optional)<textarea className={TEXTAREA_CLASS} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
        <div className="lg:col-span-4"><Button data-testid="loan-submit" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</Button></div>
      </form>
      <p className="rounded-lg bg-[hsl(var(--muted))] p-3 text-sm text-[hsl(var(--muted-foreground))]">Policy defaults: loans up to 6× monthly salary; salary advances up to 1× monthly salary; no instalment above half of monthly salary; one open loan or advance at a time. The server confirms eligibility.</p>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>My requests</CardTitle></CardHeader><CardContent>{loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading requests…</p> : <RequestsTable requests={requests} onView={(id) => void viewRequest(id)} onCancel={(id) => { if (window.confirm('Cancel this pending request?')) void act(id, () => api.loans.cancel(id)); }} busy={busy} />}</CardContent></Card>

    {isAdmin && <Card><CardHeader><CardTitle>Awaiting approval</CardTitle></CardHeader><CardContent><RequestsTable requests={inbox} onView={(id) => void viewRequest(id)} busy={busy} /></CardContent></Card>}

    {selected && <Card><CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between"><div><CardTitle>{selected.type === 'ADVANCE' ? 'Salary advance' : 'Loan'} · {formatCurrency(Number(selected.amount))}</CardTitle><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{selected.employee.firstName} {selected.employee.lastName} · {selected.employee.employeeCode}</p></div><Badge data-testid="loan-status" variant={statusVariant(selected.status)}>{label(selected.status)}</Badge></CardHeader><CardContent className="space-y-5">
      <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-[hsl(var(--muted-foreground))]">First deduction</dt><dd className="font-mono font-medium">{selected.firstDeductionPeriod}</dd></div><div><dt className="text-[hsl(var(--muted-foreground))]">Instalments</dt><dd className="font-medium">{selected.type === 'ADVANCE' ? 1 : selected.installments}</dd></div><div><dt className="text-[hsl(var(--muted-foreground))]">Outstanding</dt><dd className="font-medium">{selected.outstanding !== undefined ? formatCurrency(Number(selected.outstanding)) : '—'}</dd></div>{selected.reason && <div className="sm:col-span-3"><dt className="text-[hsl(var(--muted-foreground))]">Reason</dt><dd>{selected.reason}</dd></div>}</dl>
      {selected.schedule && <section className="space-y-3"><h2 className="font-semibold">Deduction schedule</h2><div className="overflow-x-auto"><table className="w-full min-w-[440px] text-sm"><thead><tr className="border-b text-left text-[hsl(var(--muted-foreground))]"><th className="p-3">Period</th><th className="p-3">Amount</th><th className="p-3">Status</th></tr></thead><tbody>{selected.schedule.map((entry) => <tr key={entry.period} data-testid="loan-schedule-row" className="border-b border-[hsl(var(--border))]"><td className="p-3 font-mono">{entry.period}</td><td className="p-3">{formatCurrency(Number(entry.amount))}</td><td className="p-3"><Badge variant={entry.deducted ? 'success' : 'neutral'}>{entry.deducted ? 'Deducted' : 'Upcoming'}</Badge></td></tr>)}</tbody></table></div></section>}
      {selected.approvals && <section className="space-y-3"><div><h2 className="font-semibold">Approval history</h2>{selected.approvals.awaitingRole && <p className="text-sm text-[hsl(var(--muted-foreground))]">Waiting for: {label(selected.approvals.awaitingRole)}</p>}</div>{selected.approvals.history.length ? <ul className="space-y-2 text-sm">{selected.approvals.history.map((entry, index) => <li key={`${entry.createdAt}-${index}`} className="rounded-lg border border-[hsl(var(--border))] p-3"><span className="font-medium">{label(entry.actorRole)} · {label(entry.action)}</span><span className="ml-2 text-[hsl(var(--muted-foreground))]">{formatDate(entry.createdAt)}</span>{entry.comment && <p className="mt-1">{entry.comment}</p>}</li>)}</ul> : <p className="text-sm text-[hsl(var(--muted-foreground))]">No decisions recorded yet.</p>}</section>}
      {selectedInInbox && <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] p-4"><label className="block space-y-1 text-sm font-medium">Comment (optional)<Input value={decisionComment} onChange={(event) => setDecisionComment(event.target.value)} /></label><div className="flex gap-2"><Button data-testid="loan-approve" disabled={busy} onClick={() => void act(selected.id, () => api.loans.decide(selected.id, 'APPROVE', decisionComment.trim() || undefined))}>Approve</Button><Button data-testid="loan-reject" variant="danger" disabled={busy} onClick={() => void act(selected.id, () => api.loans.decide(selected.id, 'REJECT', decisionComment.trim() || undefined))}>Reject</Button></div></div>}
    </CardContent></Card>}

    {isAdmin && <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle>All requests</CardTitle><label className="text-sm font-medium">Status<select className={`${INPUT_CLASS} mt-1 sm:w-48`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label></div></CardHeader><CardContent><RequestsTable requests={allRequests} onView={(id) => void viewRequest(id)} busy={busy} /></CardContent></Card>}
  </div>;
}
