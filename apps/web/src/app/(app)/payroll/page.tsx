'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

export default function PayrollPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  function load() {
    api.payroll.runs().then(setRuns).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function createRun() {
    const period = new Date().toISOString().slice(0, 7);
    await api.payroll.createRun(period);
    load();
  }

  async function viewRun(id: string) {
    setSelected(await api.payroll.getRun(id));
  }

  async function approveRun(id: string) {
    await api.payroll.approve(id);
    load();
    setSelected(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payroll</h1>
        <Button onClick={createRun}>Run Payroll</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Payroll Runs</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-[hsl(var(--muted-foreground))]">
                <th className="p-3">Period</th>
                <th className="p-3">Status</th>
                <th className="p-3">Employees</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-3 font-mono">{r.period}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">{r._count?.items}</td>
                  <td className="p-3">
                    <Button size="sm" variant="secondary" onClick={() => viewRun(r.id)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payroll {selected.period}</CardTitle>
            {selected.status === 'DRAFT' && (
              <Button onClick={() => approveRun(selected.id)}>Approve & Lock</Button>
            )}
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                  <th className="p-2">Employee</th>
                  <th className="p-2">Gross</th>
                  <th className="p-2">Tax</th>
                  <th className="p-2">EOBI</th>
                  <th className="p-2">PF</th>
                  <th className="p-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {selected.items?.map((item: any) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-2">{item.employee.firstName} {item.employee.lastName}</td>
                    <td className="p-2">{formatCurrency(Number(item.grossSalary))}</td>
                    <td className="p-2">{formatCurrency(Number(item.taxAmount))}</td>
                    <td className="p-2">{formatCurrency(Number(item.eobiAmount))}</td>
                    <td className="p-2">{formatCurrency(Number(item.pfAmount))}</td>
                    <td className="p-2 font-medium">{formatCurrency(Number(item.netSalary))}</td>
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
