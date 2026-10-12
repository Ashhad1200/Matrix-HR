'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Heart } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ErrorAlert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { useAction } from '@/hooks/use-action';
import { Plus } from 'lucide-react';

/** Create, publish, close and delete surveys. Employees answer them on the Surveys page. */
function SurveyManager({ onChanged }: { onChanged: () => void }) {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const action = useAction();
  const load = () => api.performance.enpsSurveys().then(setSurveys).catch(console.error);
  useEffect(() => { load(); }, []);
  const set = async (id: string, status: string) => { if (await action.run(() => api.performance.updateSurvey(id, { status }))) { load(); onChanged(); } };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { id, ...data } = form;
    const body: any = { title: data.title, question: data.question || undefined, closesAt: data.closesAt ? new Date(`${data.closesAt}T23:59:59`).toISOString() : undefined };
    if (await action.run(() => (id ? api.performance.updateSurvey(id, body) : api.performance.createSurvey(body)))) { setForm(null); load(); onChanged(); }
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Surveys</CardTitle>
        <Button size="sm" onClick={() => { action.clear(); setForm({ title: '', question: '', closesAt: '' }); }}><Plus className="mr-1 h-4 w-4" />New survey</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <ErrorAlert message={!form ? action.error : ''} />
        {surveys.map((sv) => (
          <div key={sv.id} data-testid="survey-row" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] p-4">
            <div className="min-w-0">
              <p className="font-medium">{sv.title}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{sv._count?.responses ?? 0} responses{sv.closesAt ? ` · closes ${formatDate(sv.closesAt)}` : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={sv.status === 'active' ? 'success' : 'neutral'}>{sv.status}</Badge>
              {sv.status === 'draft' && <Button size="sm" onClick={() => set(sv.id, 'active')}>Publish</Button>}
              {sv.status === 'active' && <Button size="sm" variant="secondary" onClick={() => set(sv.id, 'closed')}>Close</Button>}
              {sv.status === 'closed' && <Button size="sm" variant="secondary" onClick={() => set(sv.id, 'active')}>Reopen</Button>}
              <Button size="sm" variant="ghost" onClick={() => { action.clear(); setForm({ id: sv.id, title: sv.title, question: sv.question ?? '', closesAt: sv.closesAt ? sv.closesAt.slice(0, 10) : '' }); }}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (window.confirm('Delete this survey and its answers?') && await action.run(() => api.performance.deleteSurvey(sv.id))) { load(); onChanged(); } }}>Delete</Button>
            </div>
          </div>
        ))}
        {surveys.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No surveys yet. Use “New survey”, then Publish it so employees can answer.</p>}
      </CardContent>
      {form && (
        <Modal open onClose={() => setForm(null)} title={form.id ? 'Edit survey' : 'New survey'}>
          <form onSubmit={save} className="space-y-3">
            <Field id="sv-title" label="Title"><Input id="sv-title" required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field id="sv-q" label="Question" hint="Leave empty for the standard “How likely are you to recommend this company?”"><Input id="sv-q" maxLength={500} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></Field>
            <Field id="sv-close" label="Closes on (optional)"><Input id="sv-close" type="date" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} /></Field>
            <ErrorAlert message={action.error} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button type="submit">Save survey</Button></div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

function scoreColor(score: number | null) {
  if (score == null) return 'text-[hsl(var(--muted-foreground))]';
  if (score >= 30) return 'text-brand-600 dark:text-brand-400';
  if (score >= 0) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default function EnpsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = () => api.performance.enps().then(setData).catch((err) => setError(err.message || 'Failed to load eNPS data')).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  if (loading) return <PageSkeleton />;

  const score = data?.score ?? null;
  const responses = data?.responses ?? [];
  const themes = data?.themes ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Net Promoter Score"
        backHref="/performance"
        backLabel="Performance"
        description="Anonymous sentiment surveys with open-text responses grouped into actionable themes"
      />

      {error ? (
        <EmptyState icon={Heart} title="eNPS unavailable" description={error} />
      ) : (
        <>
          <SurveyManager onChanged={reload} />
          <div className="stagger grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">eNPS Score</p>
                <p className={cn('font-display text-5xl font-bold tabular-nums', scoreColor(score))}>
                  {score ?? '—'}
                </p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">−100 to +100</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Promoters (9–10)</p>
                <p className="font-display text-5xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
                  {data?.promoters ?? '—'}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Detractors (0–6)</p>
                <p className="font-display text-5xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {data?.detractors ?? '—'}%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Sentiment Themes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {themes.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Open-text comments are clustered into themes (compensation, work-life balance, management…) once responses arrive.
                  </p>
                ) : (
                  themes.map((t: any) => (
                    <div key={t.theme} className="rounded-xl border border-[hsl(var(--border))] p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{t.theme}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 tabular-nums">{t.count} mention{t.count > 1 ? 's' : ''}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 font-semibold tabular-nums',
                              t.avgScore >= 7
                                ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200'
                                : t.avgScore >= 5
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
                            )}
                          >
                            avg {t.avgScore}
                          </span>
                        </div>
                      </div>
                      {t.samples?.[0] && (
                        <p className="mt-2 text-sm italic text-[hsl(var(--muted-foreground))]">&ldquo;{t.samples[0]}&rdquo;</p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Recent Responses</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {responses.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No survey responses yet</p>
                ) : (
                  responses.slice(0, 10).map((r: any, i: number) => (
                    <div key={r.id ?? i} className="flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3">
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                          r.score >= 9
                            ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200'
                            : r.score >= 7
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
                        )}
                      >
                        {r.score}
                      </span>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">{r.comment || 'No comment left'}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
