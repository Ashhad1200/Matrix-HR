'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function MyPayPage() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.employees.myPayslips()
      .then((data) => setPayslips(Array.isArray(data) ? data : data?.data ?? []))
      .catch((err) => setError(err.message || 'Failed to load payslips'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pay Stubs</h1>
        <p className="text-[hsl(var(--muted-foreground))]">View your historical pay records</p>
      </div>

      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading payslips...</p>
      ) : error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : payslips.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-[hsl(var(--muted-foreground))]">No payslips available yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Payslip History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] text-left text-sm text-[hsl(var(--muted-foreground))]">
                  <th className="p-4">Period</th>
                  <th className="p-4">Gross</th>
                  <th className="p-4">Deductions</th>
                  <th className="p-4">Net Pay</th>
                  <th className="p-4">Paid On</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => (
                  <tr key={p.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]">
                    <td className="p-4 font-mono text-sm">{p.period ?? p.payrollRun?.period ?? '—'}</td>
                    <td className="p-4">{formatCurrency(Number(p.grossSalary ?? p.gross ?? 0))}</td>
                    <td className="p-4">
                      {formatCurrency(Number(p.grossSalary ?? p.gross ?? 0) - Number(p.netSalary ?? p.net ?? 0))}
                    </td>
                    <td className="p-4 font-medium">{formatCurrency(Number(p.netSalary ?? p.net ?? 0))}</td>
                    <td className="p-4 text-sm">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
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
