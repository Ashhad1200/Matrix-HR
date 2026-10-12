'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorAlert } from '@/components/ui/alert';
import { Field, SELECT_CLASS, TEXTAREA_CLASS } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useAction } from '@/hooks/use-action';

const STAGES = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];
const JOB_EMPTY = { title: '', department: '', description: '', requirements: '', status: 'open' };
const CAND_EMPTY = { jobId: '', firstName: '', lastName: '', email: '', phone: '', resumeUrl: '' };

export default function RecruitmentPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [jobForm, setJobForm] = useState<any | null>(null); // null = closed; {id?} = open
  const [candForm, setCandForm] = useState<typeof CAND_EMPTY | null>(null);
  const action = useAction();

  const load = useCallback(() => Promise.all([api.recruitment.jobs(), api.recruitment.applications()])
    .then(([j, a]) => { setJobs(j); setApplications(a); }).catch(console.error), []);
  useEffect(() => { load(); }, [load]);

  async function saveJob(e: React.FormEvent) {
    e.preventDefault();
    const { id, ...data } = jobForm;
    const ok = await action.run(() => (id ? api.recruitment.updateJob(id, data) : api.recruitment.createJob(data)));
    if (ok) { setJobForm(null); load(); }
  }
  async function toggleStatus(j: any) {
    if (await action.run(() => api.recruitment.updateJob(j.id, { status: j.status === 'open' ? 'closed' : 'open' }))) load();
  }
  async function saveCandidate(e: React.FormEvent) {
    e.preventDefault();
    const data: any = { ...candForm };
    for (const k of ['phone', 'resumeUrl']) if (!data[k]) delete data[k];
    if (await action.run(() => api.recruitment.createApplication(data))) { setCandForm(null); load(); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Recruitment</h1>
        <div className="flex gap-2">
          <Link href="/recruitment/kanban"><Button variant="secondary">Applicant board</Button></Link>
          <Button variant="secondary" onClick={() => { action.clear(); setCandForm({ ...CAND_EMPTY, jobId: jobs.find((j) => j.status === 'open')?.id ?? '' }); }} disabled={jobs.length === 0}><UserPlus className="mr-2 h-4 w-4" />Add candidate</Button>
          <Button onClick={() => { action.clear(); setJobForm(JOB_EMPTY); }}><Plus className="mr-2 h-4 w-4" />New job</Button>
        </div>
      </div>
      <ErrorAlert message={!jobForm && !candForm ? action.error : ''} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Job postings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {jobs.map((j) => (
              <div key={j.id} data-testid="job-row" className="rounded-lg border border-[hsl(var(--border))] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{j.title}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{j.department ? `${j.department} · ` : ''}{j._count?.applications ?? 0} applications</p>
                  </div>
                  <Badge variant={j.status === 'open' ? 'success' : 'neutral'}>{j.status}</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { action.clear(); setJobForm({ id: j.id, title: j.title, department: j.department ?? '', description: j.description ?? '', requirements: j.requirements ?? '', status: j.status }); }}>Edit</Button>
                  <Button size="sm" variant="secondary" onClick={() => toggleStatus(j)}>{j.status === 'open' ? 'Close job' : 'Reopen job'}</Button>
                </div>
              </div>
            ))}
            {jobs.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No job postings yet. Use &ldquo;New job&rdquo; to add the first one.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pipeline ({applications.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {STAGES.map((stage) => (
                <div key={stage} className="min-w-[100px] rounded-lg bg-[hsl(var(--muted))] p-3 text-center">
                  <p className="text-lg font-bold">{applications.filter((a) => a.status === stage).length}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{stage}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent applications</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {applications.slice(0, 25).map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] p-3 text-sm">
              <div>
                <p className="font-medium">{a.firstName} {a.lastName}</p>
                <p className="text-[hsl(var(--muted-foreground))]">{a.job?.title || '—'} · Score: {a.score ?? '—'}</p>
              </div>
              <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-1 text-xs">{a.status}</span>
            </div>
          ))}
          {applications.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No applications yet.</p>}
        </CardContent>
      </Card>

      {jobForm && (
        <Modal open onClose={() => setJobForm(null)} title={jobForm.id ? 'Edit job' : 'New job'}>
          <form onSubmit={saveJob} className="space-y-3">
            <Field id="job-title" label="Job title"><Input id="job-title" required maxLength={200} value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} /></Field>
            <Field id="job-dept" label="Department (optional)"><Input id="job-dept" maxLength={120} value={jobForm.department} onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })} /></Field>
            <Field id="job-desc" label="Description"><textarea id="job-desc" rows={4} className={TEXTAREA_CLASS} value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} /></Field>
            <Field id="job-req" label="Requirements"><textarea id="job-req" rows={3} className={TEXTAREA_CLASS} value={jobForm.requirements} onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })} /></Field>
            <Field id="job-status" label="Status"><select id="job-status" className={SELECT_CLASS} value={jobForm.status} onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}><option value="open">Open</option><option value="draft">Draft</option><option value="closed">Closed</option></select></Field>
            <ErrorAlert message={action.error} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setJobForm(null)}>Cancel</Button><Button type="submit">Save job</Button></div>
          </form>
        </Modal>
      )}

      {candForm && (
        <Modal open onClose={() => setCandForm(null)} title="Add candidate">
          <form onSubmit={saveCandidate} className="space-y-3">
            <Field id="cand-job" label="Job"><select id="cand-job" required className={SELECT_CLASS} value={candForm.jobId} onChange={(e) => setCandForm({ ...candForm, jobId: e.target.value })}><option value="">Select a job</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="cand-first" label="First name"><Input id="cand-first" required maxLength={100} value={candForm.firstName} onChange={(e) => setCandForm({ ...candForm, firstName: e.target.value })} /></Field>
              <Field id="cand-last" label="Last name"><Input id="cand-last" required maxLength={100} value={candForm.lastName} onChange={(e) => setCandForm({ ...candForm, lastName: e.target.value })} /></Field>
            </div>
            <Field id="cand-email" label="Email"><Input id="cand-email" type="email" required value={candForm.email} onChange={(e) => setCandForm({ ...candForm, email: e.target.value })} /></Field>
            <Field id="cand-phone" label="Phone (optional)"><Input id="cand-phone" maxLength={40} value={candForm.phone} onChange={(e) => setCandForm({ ...candForm, phone: e.target.value })} /></Field>
            <Field id="cand-cv" label="Resume link (optional)" hint="A full link, e.g. https://..."><Input id="cand-cv" value={candForm.resumeUrl} onChange={(e) => setCandForm({ ...candForm, resumeUrl: e.target.value })} /></Field>
            <ErrorAlert message={action.error} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCandForm(null)}>Cancel</Button><Button type="submit">Add candidate</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
