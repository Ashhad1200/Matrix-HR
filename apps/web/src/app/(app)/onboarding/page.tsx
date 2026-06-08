'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function OnboardingPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);

  function load() {
    Promise.all([
      api.onboarding.templates(),
      api.onboarding.progress(),
      api.onboarding.dashboard(),
    ]).then(([t, p, d]) => {
      setTemplates(t);
      setProgress(p);
      setDashboard(d);
    }).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function completeNextTask(p: any) {
    const pending = p.tasks?.find((t: any) => t.status !== 'COMPLETED');
    if (!pending) return;
    await api.onboarding.completeTask(p.id, pending.taskId);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Onboarding</h1>

      {dashboard && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <p className="text-3xl font-bold">{dashboard.inProgress}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-3xl font-bold">{dashboard.completed}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Completed</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-[hsl(var(--border))] p-4">
              <p className="font-medium">{t.name}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{t.tasks?.length} tasks · {t.role}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active Onboardings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {progress.map((p) => (
            <div key={p.id} className="rounded-lg border border-[hsl(var(--border))] p-4">
              <p className="font-medium">{p.employee?.firstName} {p.employee?.lastName}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{p.template?.name}</p>
              <div className="mt-2 h-2 rounded-full bg-[hsl(var(--muted))]">
                <div
                  className="h-2 rounded-full bg-brand-600"
                  style={{
                    width: `${(p.tasks?.filter((t: any) => t.status === 'COMPLETED').length / (p.tasks?.length || 1)) * 100}%`,
                  }}
                />
              </div>
              {p.status !== 'completed' && (
                <Button size="sm" className="mt-2" onClick={() => completeNextTask(p)}>Complete Next Task</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
