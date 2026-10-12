'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorAlert } from '@/components/ui/alert';
import { Field, TEXTAREA_CLASS } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useAction } from '@/hooks/use-action';
import { useAuth } from '@/hooks/use-auth';

const EMPTY = { title: '', description: '', isMandatory: false };

export default function LmsPage() {
  const { user } = useAuth();
  const isHr = user?.role === 'HR_MANAGER' || user?.role === 'COMPANY_ADMIN';
  const [courses, setCourses] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const action = useAction();

  const load = useCallback(() => Promise.all([api.lms.courses(), api.lms.myEnrollments()])
    .then(([c, m]) => { setCourses(c); setMine(m); }).catch(console.error), []);
  useEffect(() => { load(); }, [load]);

  const enrolment = (courseId: string) => mine.find((m) => m.courseId === courseId);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { id, ...data } = form;
    if (await action.run(() => (id ? api.lms.updateCourse(id, data) : api.lms.createCourse(data)))) { setForm(null); load(); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Learning</h1>
        {isHr && <Button onClick={() => { action.clear(); setForm(EMPTY); }}><Plus className="mr-2 h-4 w-4" />New course</Button>}
      </div>
      <ErrorAlert message={!form ? action.error : ''} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => {
          const en = enrolment(c.id);
          return (
            <Card key={c.id} data-testid="course-card">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle>{c.title}</CardTitle>
                {c.isMandatory && <Badge variant="warning">Mandatory</Badge>}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{c.description || 'No description.'}</p>
                <p className="text-xs">{c._count?.enrollments ?? 0} enrolled</p>
                {en ? (
                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-[hsl(var(--muted))]"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${en.progress}%` }} /></div>
                    <div className="flex items-center gap-2">
                      <Input aria-label={`Progress in ${c.title}`} type="number" min={0} max={100} className="w-24" value={progress[en.id] ?? String(en.progress)} onChange={(e) => setProgress({ ...progress, [en.id]: e.target.value })} />
                      <Button size="sm" variant="secondary" disabled={progress[en.id] === undefined} onClick={async () => { if (await action.run(() => api.lms.setProgress(en.id, Number(progress[en.id])))) { setProgress((p) => { const n = { ...p }; delete n[en.id]; return n; }); load(); } }}>Save progress</Button>
                      {en.completedAt && <Badge variant="success">Completed</Badge>}
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={async () => { if (await action.run(() => api.lms.enroll(c.id))) load(); }} disabled={!user?.employeeId}>Enrol</Button>
                )}
                {isHr && <Button size="sm" variant="ghost" onClick={() => { action.clear(); setForm({ id: c.id, title: c.title, description: c.description ?? '', isMandatory: c.isMandatory }); }}>Edit course</Button>}
              </CardContent>
            </Card>
          );
        })}
        {courses.length === 0 && <p className="text-[hsl(var(--muted-foreground))]">No courses published yet.{isHr ? ' Use “New course” to add the first one.' : ''}</p>}
      </div>

      {form && (
        <Modal open onClose={() => setForm(null)} title={form.id ? 'Edit course' : 'New course'}>
          <form onSubmit={save} className="space-y-3">
            <Field id="course-title" label="Title"><Input id="course-title" required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field id="course-desc" label="Description"><textarea id="course-desc" rows={4} className={TEXTAREA_CLASS} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isMandatory} onChange={(e) => setForm({ ...form, isMandatory: e.target.checked })} /> Mandatory for everyone</label>
            <ErrorAlert message={action.error} />
            <div className="flex justify-end gap-2">
              {form.id && <Button type="button" variant="danger" onClick={async () => { if (window.confirm('Archive this course? It will no longer be listed.') && await action.run(() => api.lms.updateCourse(form.id, { status: 'ARCHIVED' }))) { setForm(null); load(); } }}>Archive</Button>}
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button type="submit">Save course</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
