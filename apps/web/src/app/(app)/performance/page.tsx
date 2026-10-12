'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Heart, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorAlert } from '@/components/ui/alert';
import { Field, SELECT_CLASS, TEXTAREA_CLASS } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { useAction } from '@/hooks/use-action';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/utils';

const day = (v: string) => v.slice(0, 10);
const CYCLE_EMPTY = { name: '', type: 'quarterly', startDate: '', endDate: '', status: 'ACTIVE' };
const GOAL_EMPTY = { title: '', description: '', dueDate: '', cycleId: '' };

export default function PerformancePage() {
  const { user } = useAuth();
  const isHr = user?.role === 'HR_MANAGER' || user?.role === 'COMPANY_ADMIN';
  const [goals, setGoals] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [cycleForm, setCycleForm] = useState<any | null>(null);
  const [goalForm, setGoalForm] = useState<any | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const action = useAction();

  const load = useCallback(() => Promise.all([api.performance.goals(), api.performance.cycles()])
    .then(([g, c]) => { setGoals(g); setCycles(c); }).catch(console.error), []);
  useEffect(() => { load(); }, [load]);

  async function saveCycle(e: React.FormEvent) {
    e.preventDefault();
    const { id, ...data } = cycleForm;
    if (await action.run(() => (id ? api.performance.updateCycle(id, data) : api.performance.createCycle(data)))) { setCycleForm(null); load(); }
  }
  async function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    const { id, ...data } = goalForm;
    const body: any = { title: data.title, description: data.description || undefined, dueDate: data.dueDate || undefined };
    if (!id && data.cycleId) body.cycleId = data.cycleId;
    if (await action.run(() => (id ? api.performance.updateGoal(id, body) : api.performance.createGoal(body)))) { setGoalForm(null); load(); }
  }
  async function saveProgress(g: any) {
    const v = Number(progress[g.id]);
    if (await action.run(() => api.performance.updateGoalProgress(g.id, v))) { setProgress((p) => { const n = { ...p }; delete n[g.id]; return n; }); load(); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Goals, review cycles, and continuous feedback"
        actions={
          <>
            <Link href="/performance/reviews"><Button variant="secondary"><ClipboardCheck className="mr-2 h-4 w-4" />Reviews &amp; 360s</Button></Link>
            <Link href="/performance/enps"><Button variant="secondary"><Heart className="mr-2 h-4 w-4" />eNPS</Button></Link>
          </>
        }
      />
      <ErrorAlert message={!cycleForm && !goalForm ? action.error : ''} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Review cycles</CardTitle>
          {isHr && <Button size="sm" onClick={() => { action.clear(); setCycleForm(CYCLE_EMPTY); }}><Plus className="mr-1 h-4 w-4" />New cycle</Button>}
        </CardHeader>
        <CardContent className="space-y-3">
          {cycles.map((c) => (
            <div key={c.id} data-testid="cycle-row" className="flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] p-4">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{formatDate(c.startDate)} – {formatDate(c.endDate)} · {c.type}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.status === 'ACTIVE' ? 'success' : 'neutral'}>{c.status}</Badge>
                {isHr && <Button size="sm" variant="secondary" onClick={() => { action.clear(); setCycleForm({ id: c.id, name: c.name, type: c.type, startDate: day(c.startDate), endDate: day(c.endDate), status: c.status }); }}>Edit</Button>}
              </div>
            </div>
          ))}
          {cycles.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No review cycles yet.{isHr ? ' Use “New cycle” to start one.' : ''}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Goals</CardTitle>
          <Button size="sm" onClick={() => { action.clear(); setGoalForm(GOAL_EMPTY); }}><Plus className="mr-1 h-4 w-4" />New goal</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {goals.map((g) => (
            <div key={g.id} data-testid="goal-row" className="rounded-lg border border-[hsl(var(--border))] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{g.title}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{g.employee ? `${g.employee.firstName} ${g.employee.lastName}` : ''}{g.dueDate ? ` · due ${formatDate(g.dueDate)}` : ''}</p>
                </div>
                <span className="text-sm tabular-nums">{g.progress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[hsl(var(--muted))]"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${g.progress}%` }} /></div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input aria-label={`Progress for ${g.title}`} type="number" min={0} max={100} className="w-24" value={progress[g.id] ?? String(g.progress)} onChange={(e) => setProgress({ ...progress, [g.id]: e.target.value })} />
                <Button size="sm" variant="secondary" disabled={progress[g.id] === undefined} onClick={() => saveProgress(g)}>Update progress</Button>
                <Button size="sm" variant="ghost" onClick={() => { action.clear(); setGoalForm({ id: g.id, title: g.title, description: g.description ?? '', dueDate: g.dueDate ? day(g.dueDate) : '', cycleId: g.cycleId ?? '' }); }}>Edit</Button>
              </div>
            </div>
          ))}
          {goals.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No goals yet. Use “New goal” to add your first.</p>}
        </CardContent>
      </Card>

      {cycleForm && (
        <Modal open onClose={() => setCycleForm(null)} title={cycleForm.id ? 'Edit review cycle' : 'New review cycle'}>
          <form onSubmit={saveCycle} className="space-y-3">
            <Field id="cy-name" label="Name"><Input id="cy-name" required maxLength={120} value={cycleForm.name} onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })} /></Field>
            <Field id="cy-type" label="Type"><select id="cy-type" className={SELECT_CLASS} value={cycleForm.type} onChange={(e) => setCycleForm({ ...cycleForm, type: e.target.value })}>{['monthly', 'quarterly', 'half-yearly', 'annual'].map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="cy-start" label="Start date"><Input id="cy-start" type="date" required value={cycleForm.startDate} onChange={(e) => setCycleForm({ ...cycleForm, startDate: e.target.value })} /></Field>
              <Field id="cy-end" label="End date"><Input id="cy-end" type="date" required value={cycleForm.endDate} onChange={(e) => setCycleForm({ ...cycleForm, endDate: e.target.value })} /></Field>
            </div>
            {cycleForm.id && <Field id="cy-status" label="Status"><select id="cy-status" className={SELECT_CLASS} value={cycleForm.status} onChange={(e) => setCycleForm({ ...cycleForm, status: e.target.value })}>{['DRAFT', 'ACTIVE', 'COMPLETED'].map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>}
            <ErrorAlert message={action.error} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCycleForm(null)}>Cancel</Button><Button type="submit">Save cycle</Button></div>
          </form>
        </Modal>
      )}

      {goalForm && (
        <Modal open onClose={() => setGoalForm(null)} title={goalForm.id ? 'Edit goal' : 'New goal'}>
          <form onSubmit={saveGoal} className="space-y-3">
            <Field id="goal-title" label="Goal"><Input id="goal-title" required maxLength={200} value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} /></Field>
            <Field id="goal-desc" label="Details (optional)"><textarea id="goal-desc" rows={3} className={TEXTAREA_CLASS} value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} /></Field>
            <Field id="goal-due" label="Due date (optional)"><Input id="goal-due" type="date" value={goalForm.dueDate} onChange={(e) => setGoalForm({ ...goalForm, dueDate: e.target.value })} /></Field>
            {!goalForm.id && cycles.length > 0 && <Field id="goal-cycle" label="Review cycle (optional)"><select id="goal-cycle" className={SELECT_CLASS} value={goalForm.cycleId} onChange={(e) => setGoalForm({ ...goalForm, cycleId: e.target.value })}><option value="">None</option>{cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
            <ErrorAlert message={action.error} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setGoalForm(null)}>Cancel</Button><Button type="submit">Save goal</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
