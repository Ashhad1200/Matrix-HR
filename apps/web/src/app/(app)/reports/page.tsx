'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

export default function ReportsPage() {
  const [headcount, setHeadcount] = useState<any[]>([]);
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [payrollCost, setPayrollCost] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.reports.headcount(),
      api.reports.leaveConsumption(),
      api.reports.payrollCost(),
    ]).then(([h, l, p]) => {
      setHeadcount(h);
      setLeaveData(l);
      setPayrollCost(p);
    }).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports & Analytics</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Headcount by Department</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {headcount.map((d) => (
              <div key={d.department} className="flex justify-between">
                <span>{d.department}</span>
                <span className="font-medium">{d.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payroll Cost by Department</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payrollCost.map((d) => (
              <div key={d.department} className="flex justify-between">
                <span>{d.department}</span>
                <span className="font-medium">{formatCurrency(d.totalSalary)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Leave Consumption</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                <th className="p-2">Employee</th>
                <th className="p-2">Policy</th>
                <th className="p-2">Used</th>
                <th className="p-2">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {leaveData.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{r.employee}</td>
                  <td className="p-2">{r.policy}</td>
                  <td className="p-2">{r.used}</td>
                  <td className="p-2">{r.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
