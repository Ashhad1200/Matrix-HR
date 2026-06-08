'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export default function PreboardingPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.recruitment.preboarding()
      .then((data) => setCandidates(Array.isArray(data) ? data : data?.data ?? []))
      .catch((err) => setError(err.message || 'Failed to load pre-boarding'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/recruitment" className="text-sm text-brand-600 hover:underline">← Recruitment</Link>
        <h1 className="text-2xl font-bold">Pre-boarding</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Incoming hires completing Day 1 paperwork</p>
      </div>

      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
      ) : error ? (
        <Card><CardContent className="p-6"><p className="text-red-600">{error}</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.length === 0 ? (
            <Card className="col-span-full"><CardContent className="p-6 text-[hsl(var(--muted-foreground))]">No pre-boarding candidates</CardContent></Card>
          ) : candidates.map((c) => (
            <Card key={c.id}>
              <CardHeader><CardTitle className="text-base">{c.firstName} {c.lastName}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{c.job?.title ?? c.position ?? '—'}</p>
                {c.startDate && (
                  <p className="mt-2 text-sm">Start: {formatDate(c.startDate)}</p>
                )}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span>Documents</span>
                    <span>{c.completedDocs ?? 0}/{c.totalDocs ?? 0}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[hsl(var(--muted))]">
                    <div
                      className="h-2 rounded-full bg-brand-600"
                      style={{ width: `${((c.completedDocs ?? 0) / Math.max(c.totalDocs ?? 1, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
