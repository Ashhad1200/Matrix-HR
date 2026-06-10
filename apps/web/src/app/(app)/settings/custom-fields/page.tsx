'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.settings.customFields()
      .then((data) => setFields(Array.isArray(data) ? data : data?.data ?? []))
      .catch((err) => setError(err.message || 'Failed to load custom fields'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/settings" className="text-sm text-brand-600 hover:underline">← Settings</Link>
          <h1 className="text-2xl font-bold">Custom Fields</h1>
          <p className="text-[hsl(var(--muted-foreground))]">Extend employee records with custom data</p>
        </div>
        <Button disabled>Add Field</Button>
      </div>

      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
      ) : error ? (
        <Card><CardContent className="p-6"><p className="text-red-600">{error}</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Field Definitions</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-[hsl(var(--muted-foreground))]">
                  <th className="p-4">Name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Required</th>
                </tr>
              </thead>
              <tbody>
                {fields.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-[hsl(var(--muted-foreground))]">No custom fields configured</td></tr>
                ) : fields.map((f) => (
                  <tr key={f.id} className="border-b hover:bg-[hsl(var(--muted))]">
                    <td className="p-4 font-medium">{f.label ?? f.key}</td>
                    <td className="p-4 text-sm">{f.fieldType ?? f.type ?? 'text'}</td>
                    <td className="p-4 text-sm">{f.entity ?? 'Employee'}</td>
                    <td className="p-4 text-sm">{f.required ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
