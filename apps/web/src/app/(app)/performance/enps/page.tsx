'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  const score = data?.score ?? data?.enps ?? null;
  const responses = data?.responses ?? data?.recent ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/performance" className="text-sm text-brand-600 hover:underline">← Performance</Link>
        <h1 className="text-2xl font-bold">Employee Net Promoter Score</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Anonymous sentiment survey results</p>
      </div>

      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
      ) : error ? (
        <Card><CardContent className="p-6"><p className="text-red-600">{error}</p></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">eNPS Score</p>
                <p className="text-4xl font-bold text-brand-600">{score ?? '—'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Promoters</p>
                <p className="text-4xl font-bold">{data?.promoters ?? '—'}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Detractors</p>
                <p className="text-4xl font-bold">{data?.detractors ?? '—'}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Recent Feedback Themes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(Array.isArray(responses) ? responses : []).length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No survey responses yet</p>
              ) : responses.map((r: any, i: number) => (
                <div key={r.id ?? i} className="rounded-lg border border-[hsl(var(--border))] p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Score: {r.score ?? r.rating ?? '—'}</span>
                    {r.theme && <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">{r.theme}</span>}
                  </div>
                  {r.comment && (
                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{r.comment}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
