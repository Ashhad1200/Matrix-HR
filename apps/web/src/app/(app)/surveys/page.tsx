'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorAlert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { TEXTAREA_CLASS } from '@/components/ui/field';
import { useAction } from '@/hooks/use-action';
import { cn, formatDate } from '@/lib/utils';

function SurveyCard({ survey, onDone }: { survey: any; onDone: () => void }) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const action = useAction();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (score === null) return;
    if (await action.run(() => api.performance.respondSurvey(survey.id, { score, comment: comment.trim() || undefined }))) onDone();
  }
  return (
    <Card data-testid="survey-card">
      <CardHeader><CardTitle>{survey.title}</CardTitle></CardHeader>
      <CardContent>
        {survey.answered ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Thank you, you have answered this survey.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{survey.question}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Score from 0 (not likely) to 10 (very likely)">
                {Array.from({ length: 11 }, (_, i) => (
                  <button key={i} type="button" role="radio" aria-checked={score === i} onClick={() => setScore(i)}
                    className={cn('h-10 w-10 cursor-pointer rounded-lg border text-sm font-medium tabular-nums transition-colors', score === i ? 'border-brand-600 bg-brand-600 text-white' : 'border-[hsl(var(--border))] hover:border-brand-400')}>{i}</button>
                ))}
              </div>
              <p className="mt-1 flex justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>Not at all likely</span><span>Extremely likely</span></p>
            </fieldset>
            <div>
              <label htmlFor={`c-${survey.id}`} className="mb-1.5 block text-sm font-medium">Anything you want to add? (optional)</label>
              <textarea id={`c-${survey.id}`} rows={3} maxLength={2000} className={TEXTAREA_CLASS} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Your answer is anonymous: we record that you answered, never what you answered.</p>
            <ErrorAlert message={action.error} />
            <Button type="submit" disabled={score === null}>Submit answer</Button>
          </form>
        )}
        {survey.closesAt && !survey.answered && <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Closes {formatDate(survey.closesAt)}</p>}
      </CardContent>
    </Card>
  );
}

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<any[] | null>(null);
  const load = useCallback(() => api.performance.activeSurveys().then(setSurveys).catch(() => setSurveys([])), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-6">
      <PageHeader title="Surveys" description="Short, anonymous questions from your company" />
      {surveys === null ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p> : surveys.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">No surveys are open right now.</p>
      ) : surveys.map((s) => <SurveyCard key={s.id} survey={s} onDone={load} />)}
    </div>
  );
}
