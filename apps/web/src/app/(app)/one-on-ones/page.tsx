'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Badge, statusVariant } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/ui/avatar';
import { MessagesSquare, Plus, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatWhen(date: string) {
  return new Date(date).toLocaleString('en-PK', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function OneOnOnesPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [newPoint, setNewPoint] = useState('');
  const [form, setForm] = useState({ employeeId: '', scheduledAt: '', points: '' });

  const load = useCallback(() => {
    Promise.all([api.oneOnOnes.list(), api.employees.team().catch(() => [])])
      .then(([m, t]) => {
        setMeetings(Array.isArray(m) ? m : []);
        setTeam(Array.isArray(t) ? t : (t as any)?.data ?? []);
        setError('');
      })
      .catch((err) => setError(err.message || 'Failed to load 1-on-1s'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const create = async () => {
    try {
      await api.oneOnOnes.create({
        employeeId: form.employeeId,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        talkingPoints: form.points
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean)
          .map((text) => ({ text, done: false })),
      });
      setModalOpen(false);
      setForm({ employeeId: '', scheduledAt: '', points: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const togglePoint = async (meeting: any, idx: number) => {
    const points = [...(meeting.talkingPoints ?? [])];
    points[idx] = { ...points[idx], done: !points[idx].done };
    const updated = await api.oneOnOnes.update(meeting.id, { talkingPoints: points });
    setMeetings((ms) => ms.map((m) => (m.id === meeting.id ? updated : m)));
    if (active?.id === meeting.id) setActive(updated);
  };

  const saveNotes = async () => {
    if (!active) return;
    const updated = await api.oneOnOnes.update(active.id, { notes });
    setMeetings((ms) => ms.map((m) => (m.id === active.id ? updated : m)));
    setActive(updated);
  };

  const complete = async (meeting: any) => {
    const updated = await api.oneOnOnes.update(meeting.id, { status: 'completed' });
    setMeetings((ms) => ms.map((m) => (m.id === meeting.id ? updated : m)));
    if (active?.id === meeting.id) setActive(updated);
  };

  const addPoint = async () => {
    if (!active || !newPoint.trim()) return;
    const points = [...(active.talkingPoints ?? []), { text: newPoint.trim(), done: false }];
    const updated = await api.oneOnOnes.update(active.id, { talkingPoints: points });
    setMeetings((ms) => ms.map((m) => (m.id === active.id ? updated : m)));
    setActive(updated);
    setNewPoint('');
  };

  if (loading) return <PageSkeleton />;

  const myEmployeeId = user?.employee?.id;
  const upcoming = meetings.filter((m) => m.status === 'scheduled');
  const past = meetings.filter((m) => m.status !== 'scheduled');

  return (
    <div className="space-y-6">
      <PageHeader
        title="1-on-1s"
        description="Continuous development conversations with talking points and shared notes"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Schedule 1-on-1
          </Button>
        }
      />

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      {meetings.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No 1-on-1s yet"
          description="Schedule your first development conversation with a direct report."
          action={<Button onClick={() => setModalOpen(true)}><Plus className="mr-2 h-4 w-4" />Schedule 1-on-1</Button>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            {upcoming.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">Upcoming</h2>
                <div className="stagger space-y-2">
                  {upcoming.map((m) => {
                    const other = m.managerId === myEmployeeId ? m.employee : m.manager;
                    const done = (m.talkingPoints ?? []).filter((p: any) => p.done).length;
                    const totalPts = (m.talkingPoints ?? []).length;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setActive(m); setNotes(m.notes ?? ''); }}
                        className={cn(
                          'w-full rounded-xl border bg-[hsl(var(--card))] p-4 text-left transition-all hover:shadow-soft',
                          active?.id === m.id ? 'border-brand-500 shadow-glow' : 'border-[hsl(var(--border))]',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={`${other?.firstName} ${other?.lastName}`} src={other?.photoUrl} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{other?.firstName} {other?.lastName}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatWhen(m.scheduledAt)}</p>
                          </div>
                          {totalPts > 0 && (
                            <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">{done}/{totalPts}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">Past</h2>
                <div className="space-y-2">
                  {past.slice(0, 8).map((m) => {
                    const other = m.managerId === myEmployeeId ? m.employee : m.manager;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setActive(m); setNotes(m.notes ?? ''); }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border bg-[hsl(var(--card))] p-3 text-left opacity-80 transition-all hover:opacity-100',
                          active?.id === m.id ? 'border-brand-500' : 'border-[hsl(var(--border))]',
                        )}
                      >
                        <Avatar name={`${other?.firstName} ${other?.lastName}`} src={other?.photoUrl} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-sm">{other?.firstName} {other?.lastName}</span>
                        <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            {!active ? (
              <EmptyState icon={MessagesSquare} title="Select a meeting" description="Pick a 1-on-1 from the list to see talking points and notes." className="h-full" />
            ) : (
              <Card className="animate-rise">
                <CardContent className="space-y-5 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold">
                        {active.manager?.firstName} ↔ {active.employee?.firstName} {active.employee?.lastName}
                      </h2>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">{formatWhen(active.scheduledAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(active.status)}>{active.status}</Badge>
                      {active.status === 'scheduled' && (
                        <Button size="sm" onClick={() => complete(active)}>Mark Complete</Button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Talking Points</h3>
                    <ul className="space-y-1.5">
                      {(active.talkingPoints ?? []).map((p: any, i: number) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => togglePoint(active, i)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-[hsl(var(--muted))]"
                          >
                            {p.done ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                            )}
                            <span className={cn(p.done && 'text-[hsl(var(--muted-foreground))] line-through')}>{p.text}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      <Input
                        placeholder="Add a talking point…"
                        value={newPoint}
                        onChange={(e) => setNewPoint(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addPoint()}
                      />
                      <Button variant="secondary" onClick={addPoint}>Add</Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Shared Notes</h3>
                    <textarea
                      className="input-base min-h-[120px] resize-y py-2"
                      placeholder="Decisions, follow-ups, growth areas…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" onClick={saveNotes}>Save Notes</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule a 1-on-1" description="Set up a recurring conversation with a report">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Team member</label>
            <select className="input-base" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {team.map((t: any) => (
                <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">When</label>
            <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Talking points (one per line)</label>
            <textarea
              className="input-base min-h-[90px] resize-y py-2"
              placeholder={'Career goals check-in\nProject blockers\nFeedback both ways'}
              value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={!form.employeeId || !form.scheduledAt}>Schedule</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
