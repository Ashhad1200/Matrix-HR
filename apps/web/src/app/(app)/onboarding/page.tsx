'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAction } from '@/hooks/use-action';
import { ErrorAlert } from '@/components/ui/alert';
import { Field, SELECT_CLASS } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Plus, Trash2 } from 'lucide-react';

const PHASES = ['pre_joining', 'day1', 'week1', 'month1', 'month3'];
const ASSIGNEES = ['employee', 'hr', 'manager', 'it'];
const NEW_TASK = { title: '', phase: 'day1', assignee: 'employee' };

export default function OnboardingPage() {
  const action = useAction();
  const [templates, setTemplates] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [tplForm, setTplForm] = useState<any | null>(null);
  const [startForm, setStartForm] = useState<{ employeeId: string; templateId: string } | null>(null);
  const [people, setPeople] = useState<any[]>([]);

  function load() {
    Promise.all([
      api.onboarding.templates(),
      api.onboarding.progress(),
      api.onboarding.dashboard(),
    ]).then(([t, p, d]) => {
      setTemplates(t);
      setProgress(p);
      setDashboard(d);
    }).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    const { id, ...data } = tplForm;
    const tasks = data.tasks.filter((t: any) => t.title.trim());
    if (await action.run(() => (id ? api.onboarding.updateTemplate(id, { name: data.name, description: data.description || undefined, tasks }) : api.onboarding.createTemplate({ name: data.name, description: data.description || undefined, tasks })))) { setTplForm(null); load(); }
  }
  async function openStart() {
    action.clear();
    if (people.length === 0) setPeople((await api.employees.list({ limit: '100' }))?.data ?? []);
    setStartForm({ employeeId: '', templateId: templates[0]?.id ?? '' });
  }
  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (await action.run(() => api.onboarding.start(startForm!))) { setStartForm(null); load(); }
  }

  async function completeNextTask(p: any) {
    const pending = p.tasks?.find((t: any) => t.status !== 'COMPLETED');
    if (!pending) return;
    if (await action.run(() => api.onboarding.completeTask(p.id, pending.taskId))) load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Onboarding</h1>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={templates.length === 0} onClick={openStart}>Start onboarding</Button>
          <Button onClick={() => { action.clear(); setTplForm({ name: '', description: '', tasks: [{ ...NEW_TASK }] }); }}><Plus className="mr-2 h-4 w-4" />New template</Button>
        </div>
      </div>
      <ErrorAlert message={!tplForm && !startForm ? action.error : ''} />

      {dashboard && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <p className="text-3xl font-bold">{dashboard.inProgress}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-3xl font-bold">{dashboard.completed}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Completed</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} data-testid="template-row" className="flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] p-4">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{t.tasks?.length} tasks{t.role ? ` · ${t.role}` : ''}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => { action.clear(); setTplForm({ id: t.id, name: t.name, description: t.description ?? '', tasks: t.tasks.map((x: any) => ({ title: x.title, phase: x.phase, assignee: x.assignee })) }); }}>Edit</Button>
            </div>
          ))}
          {templates.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No checklists yet. Use “New template” to create one.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active Onboardings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {progress.map((p) => (
            <div key={p.id} className="rounded-lg border border-[hsl(var(--border))] p-4">
              <p className="font-medium">{p.employee?.firstName} {p.employee?.lastName}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{p.template?.name}</p>
              <div className="mt-2 h-2 rounded-full bg-[hsl(var(--muted))]">
                <div
                  className="h-2 rounded-full bg-brand-600"
                  style={{
                    width: `${(p.tasks?.filter((t: any) => t.status === 'COMPLETED').length / (p.tasks?.length || 1)) * 100}%`,
                  }}
                />
              </div>
              {p.status !== 'completed' && (
                <Button size="sm" className="mt-2" onClick={() => completeNextTask(p)}>Complete Next Task</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {tplForm && (
        <Modal open onClose={() => setTplForm(null)} title={tplForm.id ? 'Edit checklist' : 'New onboarding checklist'}>
          <form onSubmit={saveTemplate} className="space-y-3">
            <Field id="tpl-name" label="Name"><Input id="tpl-name" required maxLength={120} value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} /></Field>
            <Field id="tpl-desc" label="Description (optional)"><Input id="tpl-desc" maxLength={1000} value={tplForm.description} onChange={(e) => setTplForm({ ...tplForm, description: e.target.value })} /></Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Tasks</legend>
              {tplForm.tasks.map((t: any, i: number) => (
                <div key={i} data-testid="tpl-task" className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                  <Input aria-label={`Task ${i + 1} title`} placeholder="e.g. Sign the contract" maxLength={200} value={t.title} onChange={(e) => setTplForm({ ...tplForm, tasks: tplForm.tasks.map((x: any, j: number) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                  <select aria-label={`Task ${i + 1} phase`} className={SELECT_CLASS} value={t.phase} onChange={(e) => setTplForm({ ...tplForm, tasks: tplForm.tasks.map((x: any, j: number) => (j === i ? { ...x, phase: e.target.value } : x)) })}>{PHASES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                  <select aria-label={`Task ${i + 1} owner`} className={SELECT_CLASS} value={t.assignee} onChange={(e) => setTplForm({ ...tplForm, tasks: tplForm.tasks.map((x: any, j: number) => (j === i ? { ...x, assignee: e.target.value } : x)) })}>{ASSIGNEES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                  <button type="button" aria-label={`Remove task ${i + 1}`} className="rounded p-2 text-[hsl(var(--muted-foreground))] hover:text-rose-700" onClick={() => setTplForm({ ...tplForm, tasks: tplForm.tasks.filter((_: any, j: number) => j !== i) })}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              ))}
              <Button type="button" size="sm" variant="secondary" onClick={() => setTplForm({ ...tplForm, tasks: [...tplForm.tasks, { ...NEW_TASK }] })}><Plus className="mr-1 h-4 w-4" />Add task</Button>
            </fieldset>
            <ErrorAlert message={action.error} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setTplForm(null)}>Cancel</Button><Button type="submit">Save checklist</Button></div>
          </form>
        </Modal>
      )}

      {startForm && (
        <Modal open onClose={() => setStartForm(null)} title="Start onboarding">
          <form onSubmit={start} className="space-y-3">
            <Field id="st-emp" label="Employee"><select id="st-emp" required className={SELECT_CLASS} value={startForm.employeeId} onChange={(e) => setStartForm({ ...startForm, employeeId: e.target.value })}><option value="">Select an employee</option>{people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select></Field>
            <Field id="st-tpl" label="Checklist"><select id="st-tpl" required className={SELECT_CLASS} value={startForm.templateId} onChange={(e) => setStartForm({ ...startForm, templateId: e.target.value })}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <ErrorAlert message={action.error} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setStartForm(null)}>Cancel</Button><Button type="submit">Start</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
