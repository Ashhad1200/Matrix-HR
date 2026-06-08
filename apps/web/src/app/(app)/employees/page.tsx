'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any>({ data: [], total: 0 });
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ employeeCode: '', firstName: '', lastName: '', email: '' });

  function load() {
    api.employees.list({ search, limit: '50' }).then(setEmployees).catch(console.error);
  }

  useEffect(() => { load(); }, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.employees.create(form);
    setShowAdd(false);
    setForm({ employeeCode: '', firstName: '', lastName: '', email: '' });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-[hsl(var(--muted-foreground))]">{employees.total} total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/employees/org-chart">
            <Button variant="secondary">Org Chart</Button>
          </Link>
          <Button onClick={() => setShowAdd(!showAdd)}>Add Employee</Button>
        </div>
      </div>

      <Input placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {showAdd && (
        <Card>
          <CardHeader><CardTitle>New Employee</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <Input placeholder="Employee Code" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} required />
              <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              <Input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              <Button type="submit">Create</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
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
              {employees.data.map((emp: any) => (
                <tr key={emp.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]">
                  <td className="p-4 font-mono text-sm">{emp.employeeCode}</td>
                  <td className="p-4">
                    <Link href={`/employees/${emp.id}`} className="font-medium hover:text-brand-600">
                      {emp.firstName} {emp.lastName}
                    </Link>
                  </td>
                  <td className="p-4 text-sm">{emp.department?.name || '—'}</td>
                  <td className="p-4 text-sm">{emp.designation?.name || '—'}</td>
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
    </div>
  );
}
