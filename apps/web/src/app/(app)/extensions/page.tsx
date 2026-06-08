'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Puzzle } from 'lucide-react';

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.extensions.list()
      .then((data) => setExtensions(Array.isArray(data) ? data : data?.data ?? []))
      .catch((err) => setError(err.message || 'Failed to load extensions'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Extensions</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Custom panels and specialized access views</p>
      </div>

      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
      ) : error ? (
        <Card><CardContent className="p-6"><p className="text-red-600">{error}</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {extensions.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center p-8 text-center">
                <Puzzle className="mb-3 h-10 w-10 text-[hsl(var(--muted-foreground))]" />
                <p className="text-[hsl(var(--muted-foreground))]">No custom extensions configured</p>
                <Button className="mt-4" disabled>Create Extension</Button>
              </CardContent>
            </Card>
          ) : extensions.map((ext) => (
            <Card key={ext.id}>
              <CardHeader>
                <CardTitle className="text-base">{ext.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{ext.description ?? '—'}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {(ext.modules ?? ext.scopes ?? []).map((m: string) => (
                    <span key={m} className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">{m}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
