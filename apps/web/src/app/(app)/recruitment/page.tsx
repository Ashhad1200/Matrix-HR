'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RecruitmentPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api.recruitment.jobs(), api.recruitment.applications()])
      .then(([j, a]) => { setJobs(j); setApplications(a); })
      .catch(console.error);
  }, []);

  const stages = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Recruitment</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Open Positions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {jobs.map((j) => (
              <div key={j.id} className="rounded-lg border border-[hsl(var(--border))] p-4">
                <p className="font-medium">{j.title}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{j._count?.applications} applications</p>
              </div>
            ))}
            {jobs.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No open positions</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pipeline ({applications.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {stages.map((stage) => {
                const count = applications.filter((a) => a.status === stage).length;
                return (
                  <div key={stage} className="min-w-[100px] rounded-lg bg-[hsl(var(--muted))] p-3 text-center">
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{stage}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Applications</CardTitle></CardHeader>
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
        </CardContent>
      </Card>
    </div>
  );
}
