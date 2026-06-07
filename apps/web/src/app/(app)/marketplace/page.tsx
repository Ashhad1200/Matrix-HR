'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MarketplacePage() {
  const [integrations, setIntegrations] = useState<any[]>([]);

  useEffect(() => {
    api.marketplace.integrations().then(setIntegrations).catch(console.error);
  }, []);

  const grouped = integrations.reduce((acc: Record<string, any[]>, i) => {
    if (!acc[i.category]) acc[i.category] = [];
    acc[i.category].push(i);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Marketplace & Integrations</h1>
      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(items as any[]).map((i) => (
                <div key={i.id} className="rounded-lg border border-[hsl(var(--border))] p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{i.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      i.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>{i.status === 'available' ? 'Available' : 'Coming Soon'}</span>
                  </div>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{i.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
