'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.settings.workflows()
      .then((data) => setWorkflows(Array.isArray(data) ? data : data?.data ?? []))
      .catch((err) => setError(err.message || 'Failed to load workflows'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/settings" className="text-sm text-brand-600 hover:underline">← Settings</Link>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-[hsl(var(--muted-foreground))]">Automated approval chains for profile changes</p>
        </div>
        <Button disabled>Create Workflow</Button>
      </div>

      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
      ) : error ? (
        <Card><CardContent className="p-6"><p className="text-red-600">{error}</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workflows.length === 0 ? (
            <Card><CardContent className="p-6 text-[hsl(var(--muted-foreground))]">No workflows configured</CardContent></Card>
          ) : workflows.map((w) => (
            <Card key={w.id}>
              <CardHeader><CardTitle className="text-base">{w.name}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{w.description ?? w.trigger ?? '—'}</p>
                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {w.steps?.length ?? w.approvers?.length ?? 0} approval step(s)
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
