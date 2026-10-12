'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, RotateCw, UserPlus, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/utils';

const ROLES = [
  { value: 'EMPLOYEE', label: 'Employee', hint: 'Sees their own record, leave, time and pay' },
  { value: 'MANAGER', label: 'Manager', hint: 'Also sees their reports and approves their requests' },
  { value: 'HR_MANAGER', label: 'HR manager', hint: 'Manages people, payroll and settings' },
  { value: 'COMPANY_ADMIN', label: 'Company admin', hint: 'Everything, including billing. Only a company admin can grant this' },
];
const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  active: { label: 'Can sign in', variant: 'success' }, pending: { label: 'Invited', variant: 'info' }, expired: { label: 'Invite expired', variant: 'warning' },
  none: { label: 'No login', variant: 'neutral' }, revoked: { label: 'Revoked', variant: 'neutral' },
};

export default function LoginsPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState<any>(null);
  const [role, setRole] = useState('EMPLOYEE');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'none'>('all');

  const load = useCallback(() => api.invites.people().then(setPeople).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const done = (msg: string, r?: any) => {
    setNotice(r?.devLink ? `${msg} Development link: ${r.devLink}` : msg);
    load();
  };
  async function act(fn: () => Promise<any>, msg: string) {
    setBusy(true); setError(''); setNotice('');
    try { done(msg, await fn()); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  const roles = ROLES.filter((r) => r.value !== 'COMPANY_ADMIN' || user?.role === 'COMPANY_ADMIN');
  const rows = (people ?? []).filter((p) => filter === 'all' || p.login === 'none');

  return (
    <div className="space-y-6">
      <PageHeader title="Staff logins" description="Invite people to sign in. They get an email, choose their own password, and see only what their role allows." backHref="/settings" backLabel="Settings"
        actions={<div role="group" aria-label="Filter" className="flex gap-1">
          {(['all', 'none'] as const).map((f) => <Button key={f} size="sm" variant={filter === f ? 'primary' : 'secondary'} onClick={() => setFilter(f)}>{f === 'all' ? 'Everyone' : 'No login yet'}</Button>)}
        </div>} />
      {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
      {notice && <p role="status" className="break-all rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}

      {!people ? <TableSkeleton /> : rows.length === 0 ? <EmptyState title="Nobody to show" description="Add employees first, then invite them here." /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Work email</th><th>Role</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.employeeId}>
                  <td><span className="font-medium">{p.name}</span><span className="block text-xs text-[hsl(var(--muted-foreground))]">{p.title ?? p.code}</span></td>
                  <td>{p.email ?? <span className="text-amber-700 dark:text-amber-300">Missing: add one on the employee record</span>}</td>
                  <td>{ROLES.find((r) => r.value === p.role)?.label ?? '—'}</td>
                  <td><Badge variant={STATUS[p.login]?.variant}>{STATUS[p.login]?.label}</Badge>{p.inviteExpiresAt && p.login === 'pending' && <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">until {formatDate(p.inviteExpiresAt)}</span>}</td>
                  <td className="whitespace-nowrap text-right">
                    {(p.login === 'none' || p.login === 'expired' || p.login === 'revoked') && <Button size="sm" disabled={!p.email} onClick={() => { setTarget(p); setRole(p.role ?? 'EMPLOYEE'); }}><UserPlus className="h-4 w-4" aria-hidden="true" /> Invite</Button>}
                    {(p.login === 'pending' || p.login === 'expired') && p.inviteId && (
                      <>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => api.invites.resend(p.inviteId), `Invitation re-sent to ${p.email}.`)}><RotateCw className="h-4 w-4" aria-hidden="true" /> Resend</Button>{' '}
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => api.invites.revoke(p.inviteId), 'Invitation revoked.')}><XCircle className="h-4 w-4" aria-hidden="true" /> Revoke</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}

      {target && (
        <Modal open onClose={() => setTarget(null)} title={`Invite ${target.name}`} description={`We will email ${target.email} a link to set a password. It works once and expires in 7 days.`}>
          <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const t = target; setTarget(null); await act(() => api.invites.create({ employeeId: t.employeeId, role }), `Invitation sent to ${t.email}.`); }}>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">What can they do?</legend>
              {roles.map((r) => (
                <label key={r.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-900/30">
                  <input type="radio" name="role" className="mt-1" checked={role === r.value} onChange={() => setRole(r.value)} />
                  <span><span className="block text-sm font-medium">{r.label}</span><span className="block text-xs text-[hsl(var(--muted-foreground))]">{r.hint}</span></span>
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setTarget(null)}>Cancel</Button><Button type="submit" disabled={busy}><Mail className="h-4 w-4" aria-hidden="true" /> Send invitation</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
