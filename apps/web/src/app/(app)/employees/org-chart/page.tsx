'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function OrgNode({ node }: { node: any }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-center shadow-sm">
        <p className="font-medium">{node.firstName} {node.lastName}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{node.designation?.name}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{node.department?.name}</p>
      </div>
      {node.children?.length > 0 && (
        <div className="mt-4 flex gap-8">
          {node.children.map((child: any) => (
            <div key={child.id} className="flex flex-col items-center">
              <div className="h-4 w-px bg-[hsl(var(--border))]" />
              <OrgNode node={child} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const [tree, setTree] = useState<any[]>([]);

  useEffect(() => {
    api.employees.orgChart().then(setTree).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Organization Chart</h1>
      <Card>
        <CardHeader><CardTitle>Reporting Structure</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto py-8">
          <div className="flex justify-center gap-12">
            {tree.map((node) => <OrgNode key={node.id} node={node} />)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
