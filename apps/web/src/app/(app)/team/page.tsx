'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TeamPage() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.employees.team()
      .then((data) => setTeam(Array.isArray(data) ? data : data?.data ?? []))
      .catch((err) => setError(err.message || 'Failed to load team'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Team</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Direct and indirect reports</p>
      </div>

      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading team...</p>
      ) : error ? (
        <Card><CardContent className="p-6"><p className="text-red-600">{error}</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{team.length} Team Member{team.length !== 1 ? 's' : ''}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] text-left text-sm text-[hsl(var(--muted-foreground))]">
                  <th className="p-4">Code</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Designation</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {team.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-[hsl(var(--muted-foreground))]">
                      No team members found
                    </td>
                  </tr>
                ) : team.map((emp) => (
                  <tr key={emp.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]">
                    <td className="p-4 font-mono text-sm">{emp.employeeCode}</td>
                    <td className="p-4">
                      <Link href={`/employees/${emp.id}`} className="font-medium hover:text-brand-600">
                        {emp.firstName} {emp.lastName}
                      </Link>
                    </td>
                    <td className="p-4 text-sm">{emp.department?.name ?? '—'}</td>
                    <td className="p-4 text-sm">{emp.designation?.name ?? '—'}</td>
                    <td className="p-4">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
                        {emp.status}
                      </span>
                    </td>
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
