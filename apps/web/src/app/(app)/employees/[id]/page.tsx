'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.employees.get(id)
      .then(setEmployee)
      .catch((e) => setError(e.message || 'Failed to load employee'));
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/employees"><Button variant="secondary">← Back</Button></Link>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!employee) {
    return <p className="text-[hsl(var(--muted-foreground))]">Loading employee...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/employees"><Button variant="secondary">← Back</Button></Link>
        <div>
          <h1 className="text-2xl font-bold">{employee.firstName} {employee.lastName}</h1>
          <p className="text-[hsl(var(--muted-foreground))]">{employee.employeeCode} · {employee.designation?.name || '—'}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Email</span><span>{employee.email || '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Phone</span><span>{employee.phone || '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">CNIC</span><span>{employee.cnic || '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Department</span><span>{employee.department?.name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Manager</span><span>{employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Joined</span><span>{employee.dateOfJoining ? formatDate(employee.dateOfJoining) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Status</span><span>{employee.status}</span></div>
            {employee.baseSalary && (
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Base Salary</span><span>{formatCurrency(employee.baseSalary)}</span></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Direct Reports ({employee.directReports?.length || 0})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(employee.directReports || []).map((r: any) => (
              <Link key={r.id} href={`/employees/${r.id}`} className="block rounded-lg border border-[hsl(var(--border))] p-3 hover:bg-[hsl(var(--muted))]">
                {r.firstName} {r.lastName}
              </Link>
            ))}
            {!employee.directReports?.length && <p className="text-sm text-[hsl(var(--muted-foreground))]">No direct reports</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Documents ({employee.documents?.length || 0})</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                  <th className="p-2">Type</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Verified</th>
                </tr>
              </thead>
              <tbody>
                {(employee.documents || []).map((d: any) => (
                  <tr key={d.id} className="border-b">
                    <td className="p-2">{d.type}</td>
                    <td className="p-2">{d.name}</td>
                    <td className="p-2">{d.verified ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
