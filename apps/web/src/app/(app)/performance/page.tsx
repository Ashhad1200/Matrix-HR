'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Heart } from 'lucide-react';

export default function PerformancePage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api.performance.goals(), api.performance.cycles()])
      .then(([g, c]) => { setGoals(g); setCycles(c); })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Goals, review cycles, and continuous feedback"
        actions={
          <>
            <Link href="/performance/reviews">
              <Button variant="secondary"><ClipboardCheck className="mr-2 h-4 w-4" />Reviews & 360s</Button>
            </Link>
            <Link href="/performance/enps">
              <Button variant="secondary"><Heart className="mr-2 h-4 w-4" />eNPS</Button>
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader><CardTitle>Review Cycles</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {cycles.map((c) => (
            <div key={c.id} className="rounded-lg border border-[hsl(var(--border))] p-4">
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{c.status} · {c.type}</p>
            </div>
          ))}
          {cycles.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No active review cycles</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Goals</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {goals.map((g) => (
            <div key={g.id} className="rounded-lg border border-[hsl(var(--border))] p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{g.title}</p>
                <span className="text-sm">{g.progress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[hsl(var(--muted))]">
                <div className="h-2 rounded-full bg-brand-600" style={{ width: `${g.progress}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
