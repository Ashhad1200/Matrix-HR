'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STAGES = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const;

export default function RecruitmentKanbanPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.recruitment.applications()
      .then(setApplications)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function moveCard(id: string, status: string) {
    await api.recruitment.updateApplicationStatus(id, status);
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/recruitment" className="text-sm text-brand-600 hover:underline">← Recruitment</Link>
        <h1 className="text-2xl font-bold">ATS Board</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Drag candidates through the hiring pipeline</p>
      </div>

      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading board...</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const cards = applications.filter((a) => a.status === stage);
            return (
              <div key={stage} className="min-w-[220px] flex-shrink-0">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{stage}</h3>
                  <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((a) => (
                    <Card key={a.id} className="shadow-sm">
                      <CardContent className="p-3">
                        <p className="font-medium text-sm">{a.firstName} {a.lastName}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{a.job?.title ?? '—'}</p>
                        {a.score != null && (
                          <p className="mt-1 text-xs text-brand-600">Score: {a.score}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {STAGES.filter((s) => s !== stage).slice(0, 3).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => moveCard(a.id, s)}
                              className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] hover:bg-brand-600/10"
                            >
                              → {s.slice(0, 4)}
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
