'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Badge, statusVariant } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/ui/avatar';
import { Timer, ChevronLeft, ChevronRight, Plus, Check, X, FolderKanban } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';

function mondayOf(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function TimesheetsPage() {
  const { user } = useAuth();
  const portal = user?.permissions.portal ?? 'ess';
  const canApprove = portal !== 'ess';

  const [tab, setTab] = useState<'my' | 'approvals'>('my');
  const [weekStart, setWeekStart] = useState(() => iso(mondayOf(new Date())));
  const [week, setWeek] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ date: iso(new Date()), hours: '8', projectId: '', note: '' });
  const [projectModal, setProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({ key: '', name: '' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.timesheets.entries(weekStart),
      api.timesheets.projects(),
      canApprove ? api.timesheets.pending() : Promise.resolve([]),
    ])
      .then(([w, p, pend]) => {
        setWeek(w);
        setProjects(Array.isArray(p) ? p : []);
        setPending(Array.isArray(pend) ? pend : []);
        setError('');
      })
      .catch((err) => setError(err.message || 'Failed to load timesheets'))
      .finally(() => setLoading(false));
  }, [weekStart, canApprove]);

  useEffect(load, [load]);

  const shiftWeek = (days: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + days);
    setWeekStart(iso(mondayOf(d)));
  };

  const days = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of week?.entries ?? []) {
      const key = String(e.date).slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [week]);

  const addEntry = async () => {
    try {
      await api.timesheets.createEntry({
        date: form.date,
        hours: Number(form.hours),
        projectId: form.projectId || undefined,
        note: form.note || undefined,
      });
      setModalOpen(false);
      setForm({ date: iso(new Date()), hours: '8', projectId: '', note: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addProject = async () => {
    try {
      await api.timesheets.createProject(projectForm);
      setProjectModal(false);
      setProjectForm({ key: '', name: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading && !week) return <PageSkeleton />;

  const hasDraft = (week?.entries ?? []).some((e: any) => e.status === 'draft');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets"
        description="Log hours against project keys and submit weekly sheets for sign-off"
        actions={
          <>
            {portal === 'admin' && (
              <Button variant="secondary" onClick={() => setProjectModal(true)}>
                <FolderKanban className="mr-2 h-4 w-4" /> New Project
              </Button>
            )}
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Log Hours
            </Button>
          </>
        }
      />

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      {canApprove && (
        <div className="flex gap-1 rounded-xl bg-[hsl(var(--muted))] p-1 w-fit">
          {(['my', 'approvals'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
                tab === t ? 'bg-[hsl(var(--card))] shadow-soft' : 'text-[hsl(var(--muted-foreground))]',
              )}
            >
              {t === 'my' ? 'My Week' : `Approvals${pending.length ? ` (${pending.length})` : ''}`}
            </button>
          ))}
        </div>
      )}

      {tab === 'my' ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => shiftWeek(-7)} aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm font-semibold tabular-nums">
                Week of {formatDate(weekStart)}
              </p>
              <Button variant="ghost" size="sm" onClick={() => shiftWeek(7)} aria-label="Next week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Total: <span className="font-display text-lg font-bold tabular-nums text-[hsl(var(--foreground))]">{week?.totalHours ?? 0}h</span>
              </p>
              <Button
                size="sm"
                disabled={!hasDraft}
                onClick={async () => {
                  await api.timesheets.submitWeek(weekStart);
                  load();
                }}
              >
                Submit Week
              </Button>
            </div>
          </div>

          <div className="stagger grid gap-3 md:grid-cols-7">
            {days.map((d) => {
              const key = iso(d);
              const entries = entriesByDay.get(key) ?? [];
              const total = entries.reduce((s, e) => s + Number(e.hours), 0);
              const isToday = key === iso(new Date());
              return (
                <Card key={key} className={cn('min-h-[120px]', isToday && 'border-brand-400 shadow-glow')}>
                  <CardContent className="p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        {d.toLocaleDateString('en', { weekday: 'short' })} {d.getDate()}
                      </p>
                      {total > 0 && <span className="text-xs font-bold tabular-nums text-brand-600 dark:text-brand-400">{total}h</span>}
                    </div>
                    <div className="space-y-1.5">
                      {entries.map((e) => (
                        <div key={e.id} className="group rounded-lg border border-[hsl(var(--border))] p-2 text-xs">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate font-semibold">{e.project?.key ?? 'GEN'}</span>
                            <span className="tabular-nums">{Number(e.hours)}h</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-1">
                            <Badge variant={statusVariant(e.status)} className="px-1.5 py-0 text-[10px]">{e.status}</Badge>
                            {e.status === 'draft' && (
                              <button
                                type="button"
                                onClick={async () => { await api.timesheets.deleteEntry(e.id); load(); }}
                                className="hidden text-rose-500 group-hover:block"
                                aria-label="Delete entry"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card>
          <CardHeader><CardTitle>Submitted entries awaiting your approval</CardTitle></CardHeader>
          <CardContent className="p-0">
            {pending.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={Timer} title="Nothing to approve" description="Submitted timesheet entries from your reports will appear here." />
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th><th>Date</th><th>Project</th><th>Hours</th><th>Note</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar name={`${e.employee?.firstName} ${e.employee?.lastName}`} size="xs" />
                          <span className="font-medium">{e.employee?.firstName} {e.employee?.lastName}</span>
                        </div>
                      </td>
                      <td className="tabular-nums">{formatDate(e.date)}</td>
                      <td>{e.project?.key ?? '—'}</td>
                      <td className="tabular-nums">{Number(e.hours)}h</td>
                      <td className="max-w-[200px] truncate text-[hsl(var(--muted-foreground))]">{e.note ?? '—'}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={async () => { await api.timesheets.approve(e.id); load(); }}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="danger" onClick={async () => { await api.timesheets.reject(e.id); load(); }}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Hours" description="Record time against a project key">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Date</label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Hours</label>
              <Input type="number" min="0.25" max="24" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Project</label>
            <select
              className="input-base"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">General (no project)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Note</label>
            <Input placeholder="What did you work on?" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={addEntry}>Save Entry</Button>
          </div>
        </div>
      </Modal>

      <Modal open={projectModal} onClose={() => setProjectModal(false)} title="New Project" description="Create a project key for time allocation">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Key</label>
              <Input placeholder="MTX" value={projectForm.key} onChange={(e) => setProjectForm({ ...projectForm, key: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Name</label>
              <Input placeholder="Matrix Platform" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setProjectModal(false)}>Cancel</Button>
            <Button onClick={addProject} disabled={!projectForm.key || !projectForm.name}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
