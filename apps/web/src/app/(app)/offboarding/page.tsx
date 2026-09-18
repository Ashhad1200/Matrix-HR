'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';

type OffboardingStatus =
  | 'PENDING_APPROVAL'
  | 'CLEARANCE'
  | 'EXIT_INTERVIEW'
  | 'SETTLEMENT'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

type ClearanceItem = {
  id: string;
  title: string;
  department: string;
  assignedRole: 'MANAGER' | 'HR_MANAGER' | 'COMPANY_ADMIN';
  status: 'PENDING' | 'CLEARED';
  clearedAt: string | null;
  notes: string | null;
};

type ExitInterview = {
  primaryReason: string;
  feedback?: string | null;
  rating: number;
  wouldRecommend: boolean;
};

type Settlement = {
  period: string;
  lastWorkingDay: string;
  baseSalary: number | string;
  workedDays: number;
  daysInMonth: number;
  leaveEncashmentDays: number;
  leaveEncashmentAmount: number | string;
  otherEarnings: number | string;
  recoveries: number | string;
  loanRecovery?: number | string;
  reimbursements?: number | string;
  gross: number | string;
  tax: number | string;
  eobi: number | string;
  pf: number | string;
  net: number | string;
  validated: false;
  notes: string[];
  finalisedAt?: string;
};

type OffboardingCase = {
  id: string;
  employeeId: string;
  type: 'RESIGNATION' | 'TERMINATION';
  reason: string | null;
  noticeDate: string;
  lastWorkingDay: string;
  status: OffboardingStatus;
  initiatedByUserId: string;
  exitInterview: ExitInterview | null;
  exitInterviewAt: string | null;
  completedAt: string | null;
  settlement: Settlement | null;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string; managerId: string | null };
  clearanceItems: ClearanceItem[];
  approvals?: {
    status: 'pending' | 'approved' | 'rejected';
    currentStep: number;
    awaitingRole: 'MANAGER' | 'HR_MANAGER' | null;
    history: Array<{
      action: 'APPROVE' | 'REJECT';
      actorRole: string;
      comment?: string | null;
      createdAt: string;
    }>;
  } | null;
};

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
};

const OPEN_STATUSES: OffboardingStatus[] = ['PENDING_APPROVAL', 'CLEARANCE', 'EXIT_INTERVIEW', 'SETTLEMENT'];
const STATUS_OPTIONS: OffboardingStatus[] = [
  'PENDING_APPROVAL', 'CLEARANCE', 'EXIT_INTERVIEW', 'SETTLEMENT', 'COMPLETED', 'REJECTED', 'CANCELLED',
];
const STEPS = ['Approval', 'Clearance', 'Exit interview', 'Settlement', 'Completed'];
const INPUT_CLASS = 'h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm';
const TEXTAREA_CLASS = 'min-h-24 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm';

function localToday() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function label(value: string | null | undefined) {
  return value ? value.toLowerCase().replaceAll('_', ' ') : '—';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function statusBadgeVariant(status: OffboardingStatus) {
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger' as const;
  if (status === 'PENDING_APPROVAL') return 'warning' as const;
  return 'info' as const;
}

function CaseRows({ cases, onView }: { cases: OffboardingCase[]; onView: (id: string) => void }) {
  if (!cases.length) {
    return <p className="py-4 text-sm text-[hsl(var(--muted-foreground))]">No cases found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
            <th className="p-3">Employee</th>
            <th className="p-3">Type</th>
            <th className="p-3">Last working day</th>
            <th className="p-3">Status</th>
            <th className="p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => (
            <tr key={item.id} data-testid="offboarding-case-row" className="border-b border-[hsl(var(--border))]">
              <td className="p-3 font-medium">{item.employee.firstName} {item.employee.lastName} <span className="text-[hsl(var(--muted-foreground))]">({item.employee.employeeCode})</span></td>
              <td className="p-3"><Badge variant="outline">{label(item.type)}</Badge></td>
              <td className="p-3">{formatDate(item.lastWorkingDay)}</td>
              <td className="p-3"><Badge variant={statusBadgeVariant(item.status)}>{label(item.status)}</Badge></td>
              <td className="p-3"><Button size="sm" variant="secondary" onClick={() => onView(item.id)}>View</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OffboardingPage() {
  const { user } = useAuth();
  const portal = user?.permissions.portal;
  const isAdminPortal = portal === 'admin';
  const canAct = portal === 'manager' || isAdminPortal;
  const isAdminLevel = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [mine, setMine] = useState<OffboardingCase[]>([]);
  const [inbox, setInbox] = useState<OffboardingCase[]>([]);
  const [allCases, setAllCases] = useState<OffboardingCase[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState<OffboardingCase | null>(null);
  const selectedId = useRef<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [decisionComment, setDecisionComment] = useState('');
  const [clearanceNotes, setClearanceNotes] = useState<Record<string, string>>({});
  const [resignForm, setResignForm] = useState({ lastWorkingDay: '', reason: '' });
  const [startForm, setStartForm] = useState({ employeeId: '', type: 'RESIGNATION' as 'RESIGNATION' | 'TERMINATION', lastWorkingDay: '', reason: '' });
  const [exitForm, setExitForm] = useState({ primaryReason: '', feedback: '', rating: 5, wouldRecommend: false });

  const loadData = useCallback(async (autoSelect = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const myCases = await api.offboarding.mine() as OffboardingCase[];
      setMine(myCases);

      if (portal === 'manager') {
        setInbox(await api.offboarding.inbox() as OffboardingCase[]);
      }

      if (portal === 'admin') {
        const [cases, employeeResponse] = await Promise.all([
          api.offboarding.list(statusFilter || undefined),
          api.employees.list({ status: 'ACTIVE', limit: '100' }),
        ]) as [OffboardingCase[], { data: EmployeeOption[] }];
        setAllCases(cases);
        setEmployees(employeeResponse.data);
      }

      if (autoSelect && !selectedId.current) {
        const ownOpenCase = myCases.find((item) => OPEN_STATUSES.includes(item.status));
        if (ownOpenCase) {
          const detail = await api.offboarding.get(ownOpenCase.id) as OffboardingCase;
          selectedId.current = detail.id;
          setSelected(detail);
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [portal, statusFilter, user]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  async function viewCase(id: string) {
    setError('');
    try {
      const detail = await api.offboarding.get(id) as OffboardingCase;
      selectedId.current = id;
      setSelected(detail);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function runAction(caseId: string, action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      const detail = await api.offboarding.get(caseId) as OffboardingCase;
      selectedId.current = caseId;
      setSelected(detail);
      await loadData(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResignation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(`Submit your resignation with ${resignForm.lastWorkingDay} as your last working day?`)) return;
    setBusy(true);
    setError('');
    try {
      const created = await api.offboarding.initiate({
        type: 'RESIGNATION',
        lastWorkingDay: resignForm.lastWorkingDay,
        reason: resignForm.reason.trim() || undefined,
      }) as OffboardingCase;
      await viewCase(created.id);
      setResignForm({ lastWorkingDay: '', reason: '' });
      await loadData(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm('Start this offboarding case?')) return;
    setBusy(true);
    setError('');
    try {
      const created = await api.offboarding.initiate({
        employeeId: startForm.employeeId,
        type: startForm.type,
        lastWorkingDay: startForm.lastWorkingDay,
        reason: startForm.reason.trim() || undefined,
      }) as OffboardingCase;
      await viewCase(created.id);
      setStartForm({ employeeId: '', type: 'RESIGNATION', lastWorkingDay: '', reason: '' });
      await loadData(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const ownOpenCase = mine.find((item) => OPEN_STATUSES.includes(item.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Offboarding</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Manage exit approvals, clearance, interviews and final settlements.</p>
      </div>

      {error && <p data-testid="offboarding-error" role="alert" className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      {isAdminPortal ? (
        <>
          <Card>
            <CardHeader><CardTitle>Start offboarding</CardTitle></CardHeader>
            <CardContent>
              <form data-testid="offboarding-start-form" onSubmit={handleStart} className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">Employee
                  <select className={INPUT_CLASS} value={startForm.employeeId} onChange={(event) => setStartForm({ ...startForm, employeeId: event.target.value })} required>
                    <option value="">Select an active employee</option>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} ({employee.employeeCode})</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">Type
                  <select className={INPUT_CLASS} value={startForm.type} onChange={(event) => setStartForm({ ...startForm, type: event.target.value as 'RESIGNATION' | 'TERMINATION' })}>
                    <option value="RESIGNATION">Resignation</option>
                    <option value="TERMINATION">Termination</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">Last working day
                  <input className={INPUT_CLASS} type="date" min={localToday()} value={startForm.lastWorkingDay} onChange={(event) => setStartForm({ ...startForm, lastWorkingDay: event.target.value })} required />
                </label>
                <label className="space-y-1 text-sm font-medium md:col-span-2">Reason (optional)
                  <textarea className={TEXTAREA_CLASS} value={startForm.reason} onChange={(event) => setStartForm({ ...startForm, reason: event.target.value })} />
                </label>
                <Button type="submit" disabled={busy}>{busy ? 'Starting…' : 'Start offboarding'}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>All cases</CardTitle>
              <label className="flex items-center gap-2 text-sm">Status
                <select className={`${INPUT_CLASS} w-auto min-w-44`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{label(status)}</option>)}
                </select>
              </label>
            </CardHeader>
            <CardContent>{loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading cases…</p> : <CaseRows cases={allCases} onView={viewCase} />}</CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader><CardTitle>My exit request</CardTitle></CardHeader>
          <CardContent>
            {!loading && !ownOpenCase && (
              <form data-testid="offboarding-resign-form" onSubmit={handleResignation} className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">Last working day
                  <input className={INPUT_CLASS} type="date" min={localToday()} value={resignForm.lastWorkingDay} onChange={(event) => setResignForm({ ...resignForm, lastWorkingDay: event.target.value })} required />
                </label>
                <label className="space-y-1 text-sm font-medium sm:col-span-2">Reason (optional)
                  <textarea className={TEXTAREA_CLASS} value={resignForm.reason} onChange={(event) => setResignForm({ ...resignForm, reason: event.target.value })} />
                </label>
                <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit resignation'}</Button>
              </form>
            )}
            {loading && <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading your request…</p>}
            {!loading && ownOpenCase && <p className="text-sm text-[hsl(var(--muted-foreground))]">Your open case is shown below.</p>}
          </CardContent>
        </Card>
      )}

      {portal === 'manager' && (
        <Card>
          <CardHeader><CardTitle>Awaiting my action</CardTitle></CardHeader>
          <CardContent><CaseRows cases={inbox} onView={viewCase} /></CardContent>
        </Card>
      )}

      {selected && (
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>{selected.employee.firstName} {selected.employee.lastName} <span className="font-mono text-sm font-normal text-[hsl(var(--muted-foreground))]">{selected.employee.employeeCode}</span></CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{label(selected.type)}</Badge>
                <Badge data-testid="offboarding-status" variant={statusBadgeVariant(selected.status)}>{label(selected.status)}</Badge>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Last working day: {formatDate(selected.lastWorkingDay)}</p>
              <p className="text-sm">Reason: {selected.reason || '—'}</p>
            </div>
            {isAdminPortal && OPEN_STATUSES.includes(selected.status) && (
              <Button variant="danger" disabled={busy} onClick={() => {
                if (window.confirm('Cancel this offboarding case?')) void runAction(selected.id, () => api.offboarding.cancel(selected.id));
              }}>{busy ? 'Working…' : 'Cancel case'}</Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <CaseStepper status={selected.status} />

            {selected.status === 'PENDING_APPROVAL' && (
              <section className="space-y-4">
                <div>
                  <h2 className="font-semibold">Approval</h2>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Waiting for: {label(selected.approvals?.awaitingRole)}</p>
                </div>
                {selected.approvals?.history.length ? (
                  <ul className="space-y-2 text-sm">
                    {selected.approvals.history.map((entry, index) => (
                      <li key={`${entry.createdAt}-${index}`} className="rounded-lg border border-[hsl(var(--border))] p-3">
                        <span className="font-medium">{label(entry.actorRole)} · {label(entry.action)}</span>
                        <span className="ml-2 text-[hsl(var(--muted-foreground))]">{formatDate(entry.createdAt)}</span>
                        {entry.comment && <p className="mt-1">{entry.comment}</p>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-[hsl(var(--muted-foreground))]">No decisions recorded yet.</p>}
                {canAct && (
                  <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] p-4">
                    <label className="block space-y-1 text-sm font-medium">Comment (optional)
                      <input className={INPUT_CLASS} value={decisionComment} onChange={(event) => setDecisionComment(event.target.value)} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button data-testid="offboarding-approve" disabled={busy} onClick={() => void runAction(selected.id, () => api.offboarding.decide(selected.id, 'APPROVE', decisionComment.trim() || undefined))}>{busy ? 'Working…' : 'Approve'}</Button>
                      <Button data-testid="offboarding-reject" variant="danger" disabled={busy} onClick={() => void runAction(selected.id, () => api.offboarding.decide(selected.id, 'REJECT', decisionComment.trim() || undefined))}>{busy ? 'Working…' : 'Reject'}</Button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {selected.status === 'CLEARANCE' && (
              <section className="space-y-3">
                <h2 className="font-semibold">Clearance checklist</h2>
                {selected.clearanceItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[hsl(var(--border))] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{item.department} · Requires: {label(item.assignedRole)}</p>
                        {item.notes && <p className="mt-1 text-sm">Notes: {item.notes}</p>}
                      </div>
                      <Badge variant={item.status === 'CLEARED' ? 'success' : 'warning'}>{label(item.status)}</Badge>
                    </div>
                    {item.status === 'PENDING' && canAct && (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <label className="flex-1"><span className="sr-only">Notes for {item.title}</span>
                          <input className={INPUT_CLASS} placeholder="Notes (optional)" value={clearanceNotes[item.id] ?? ''} onChange={(event) => setClearanceNotes({ ...clearanceNotes, [item.id]: event.target.value })} />
                        </label>
                        <Button data-testid="offboarding-clear-item" size="sm" disabled={busy} onClick={() => void runAction(selected.id, () => api.offboarding.clearItem(selected.id, item.id, clearanceNotes[item.id]?.trim() || undefined))}>{busy ? 'Working…' : 'Mark cleared'}</Button>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {selected.status === 'EXIT_INTERVIEW' && (selected.employeeId === user?.employeeId || isAdminPortal) && (
              <section>
                <h2 className="mb-3 font-semibold">Exit interview</h2>
                <form data-testid="offboarding-exit-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => {
                  event.preventDefault();
                  void runAction(selected.id, () => api.offboarding.submitExitInterview(selected.id, {
                    primaryReason: exitForm.primaryReason,
                    feedback: exitForm.feedback.trim() || undefined,
                    rating: exitForm.rating,
                    wouldRecommend: exitForm.wouldRecommend,
                  }));
                }}>
                  <label className="space-y-1 text-sm font-medium sm:col-span-2">Primary reason
                    <input className={INPUT_CLASS} value={exitForm.primaryReason} onChange={(event) => setExitForm({ ...exitForm, primaryReason: event.target.value })} required />
                  </label>
                  <label className="space-y-1 text-sm font-medium sm:col-span-2">Feedback (optional)
                    <textarea className={TEXTAREA_CLASS} value={exitForm.feedback} onChange={(event) => setExitForm({ ...exitForm, feedback: event.target.value })} />
                  </label>
                  <label className="space-y-1 text-sm font-medium">Rating
                    <select className={INPUT_CLASS} value={exitForm.rating} onChange={(event) => setExitForm({ ...exitForm, rating: Number(event.target.value) })}>
                      {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
                    <input type="checkbox" checked={exitForm.wouldRecommend} onChange={(event) => setExitForm({ ...exitForm, wouldRecommend: event.target.checked })} />
                    I would recommend this company
                  </label>
                  <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit exit interview'}</Button>
                </form>
              </section>
            )}

            {selected.exitInterview && <ExitInterviewSummary interview={selected.exitInterview} submittedAt={selected.exitInterviewAt} />}

            {(selected.status === 'SETTLEMENT' || selected.status === 'COMPLETED') && selected.settlement && (
              <SettlementSection settlement={selected.settlement} />
            )}

            {selected.status === 'SETTLEMENT' && (
              <div className="flex flex-wrap gap-2">
                {isAdminPortal && <Button variant="secondary" disabled={busy} onClick={() => void runAction(selected.id, () => api.offboarding.recalculateSettlement(selected.id))}>{busy ? 'Working…' : 'Recalculate'}</Button>}
                {isAdminLevel && <Button data-testid="offboarding-complete" disabled={busy} onClick={() => {
                  if (window.confirm('Complete offboarding? This closes the employee record and removes their access.')) void runAction(selected.id, () => api.offboarding.complete(selected.id));
                }}>{busy ? 'Working…' : 'Complete offboarding'}</Button>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CaseStepper({ status }: { status: OffboardingStatus }) {
  const stepByStatus: Partial<Record<OffboardingStatus, number>> = {
    PENDING_APPROVAL: 0, CLEARANCE: 1, EXIT_INTERVIEW: 2, SETTLEMENT: 3, COMPLETED: 4,
  };
  const currentStep = stepByStatus[status];
  const terminal = status === 'REJECTED' || status === 'CANCELLED';

  return (
    <div aria-label="Offboarding progress" className="overflow-x-auto pb-1">
      <ol className="flex min-w-[620px] items-center">
        {STEPS.map((step, index) => (
          <li key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${terminal ? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]' : currentStep !== undefined && index <= currentStep ? 'bg-brand-600 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{index + 1}</span>
              <span className="whitespace-nowrap text-xs">{step}</span>
            </div>
            {index < STEPS.length - 1 && <span className={`mx-2 h-0.5 flex-1 ${!terminal && currentStep !== undefined && index < currentStep ? 'bg-brand-600' : 'bg-[hsl(var(--border))]'}`} />}
          </li>
        ))}
      </ol>
      {terminal && <p className={`mt-3 text-sm font-medium ${status === 'REJECTED' ? 'text-rose-600 dark:text-rose-300' : 'text-[hsl(var(--muted-foreground))]'}`}>Case {label(status)}</p>}
    </div>
  );
}

function ExitInterviewSummary({ interview, submittedAt }: { interview: ExitInterview; submittedAt: string | null }) {
  return (
    <section className="space-y-2 rounded-lg border border-[hsl(var(--border))] p-4">
      <h2 className="font-semibold">Exit interview responses</h2>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-[hsl(var(--muted-foreground))]">Primary reason</dt><dd>{interview.primaryReason}</dd></div>
        <div><dt className="text-[hsl(var(--muted-foreground))]">Rating</dt><dd>{interview.rating}/5</dd></div>
        <div><dt className="text-[hsl(var(--muted-foreground))]">Would recommend</dt><dd>{interview.wouldRecommend ? 'Yes' : 'No'}</dd></div>
        {submittedAt && <div><dt className="text-[hsl(var(--muted-foreground))]">Submitted</dt><dd>{formatDate(submittedAt)}</dd></div>}
        <div className="sm:col-span-2"><dt className="text-[hsl(var(--muted-foreground))]">Feedback</dt><dd>{interview.feedback || '—'}</dd></div>
      </dl>
    </section>
  );
}

function SettlementSection({ settlement }: { settlement: Settlement }) {
  const rows: Array<[string, string]> = [
    ['Period', settlement.period],
    ['Base salary', formatCurrency(Number(settlement.baseSalary))],
    ['Worked days', `${settlement.workedDays} / ${settlement.daysInMonth}`],
    ['Leave encashment', `${settlement.leaveEncashmentDays} days · ${formatCurrency(Number(settlement.leaveEncashmentAmount))}`],
    ['Other earnings', formatCurrency(Number(settlement.otherEarnings))],
    ['Gross', formatCurrency(Number(settlement.gross))],
    ['Tax', formatCurrency(Number(settlement.tax))],
    ['EOBI', formatCurrency(Number(settlement.eobi))],
    ['PF', formatCurrency(Number(settlement.pf))],
    ['Recoveries', formatCurrency(Number(settlement.recoveries))],
    ...(Number(settlement.loanRecovery) > 0 ? [['Loan/advance recovery (instalments still due)', formatCurrency(Number(settlement.loanRecovery))] as [string, string]] : []),
    ...(Number(settlement.reimbursements) > 0 ? [['Expense reimbursements (approved claims)', formatCurrency(Number(settlement.reimbursements))] as [string, string]] : []),
  ];

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">Final settlement</h2>
      {settlement.validated === false && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">Draft figure — not validated by a payroll practitioner</p>
          {!!settlement.notes?.length && <ul className="mt-2 list-disc space-y-1 pl-5">{settlement.notes.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ul>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <tbody>
            {rows.map(([name, value]) => <tr key={name} className="border-b border-[hsl(var(--border))]"><th className="p-3 text-left font-medium">{name}</th><td className="p-3 text-right">{value}</td></tr>)}
            <tr className="border-t-2 border-[hsl(var(--border))] text-base font-bold"><th className="p-3 text-left">NET</th><td className="p-3 text-right">{formatCurrency(Number(settlement.net))}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
