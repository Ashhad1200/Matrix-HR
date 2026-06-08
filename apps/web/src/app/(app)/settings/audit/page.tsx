'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.audit.logs({ limit: '50' })
      .then((data) => setLogs(Array.isArray(data) ? data : data?.data ?? []))
      .catch((err) => setError(err.message || 'Failed to load audit log'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-brand-600 hover:underline">← Settings</Link>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-[hsl(var(--muted-foreground))]">System activity and data change history</p>
      </div>

      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
      ) : error ? (
        <Card><CardContent className="p-6"><p className="text-red-600">{error}</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                  <th className="p-4">Time</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">User</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-[hsl(var(--muted-foreground))]">No audit entries</td></tr>
                ) : logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-[hsl(var(--muted))]">
                    <td className="p-4">{formatDate(log.createdAt)}</td>
                    <td className="p-4 font-medium">{log.action}</td>
                    <td className="p-4">{log.entity}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}</td>
                    <td className="p-4">{log.user?.email ?? log.userId ?? '—'}</td>
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
