'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    api.performance.enps()
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load eNPS data'))
      .finally(() => setLoading(false));
  }, []);

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
