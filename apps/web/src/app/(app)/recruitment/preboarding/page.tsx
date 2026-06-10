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
            <Card className="col-span-full">
              <CardContent className="p-6 text-[hsl(var(--muted-foreground))]">
                No pre-boarding invites yet. Create one from the recruitment pipeline.
              </CardContent>
            </Card>
          ) : candidates.map((c) => {
            const docs = (c.documents as Record<string, boolean> | null) ?? {};
            const docKeys = Object.keys(docs);
            const completedDocs = docKeys.filter((k) => docs[k]).length;
            const totalDocs = docKeys.length || 1;

            return (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle className="text-base">{c.email}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm capitalize text-[hsl(var(--muted-foreground))]">Status: {c.status}</p>
                  <p className="mt-1 text-sm">Expires: {formatDate(c.expiresAt)}</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span>Documents</span>
                      <span>{completedDocs}/{totalDocs}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-[hsl(var(--muted))]">
                      <div
                        className="h-2 rounded-full bg-brand-600"
                        style={{ width: `${(completedDocs / totalDocs) * 100}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
