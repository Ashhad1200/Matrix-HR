'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">WhatsApp Integration</h1>
      <Card>
        <CardHeader><CardTitle>Commands</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[hsl(var(--muted-foreground))]">
            Employees and managers can interact with MatrixHR via WhatsApp.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { cmd: 'balance', desc: 'View leave balance' },
              { cmd: 'attendance', desc: 'This month attendance' },
              { cmd: 'team', desc: "See who's out today" },
              { cmd: 'APPROVE {id}', desc: 'Approve leave request' },
            ].map((c) => (
              <div key={c.cmd} className="rounded-lg border border-[hsl(var(--border))] p-4">
                <code className="font-mono text-brand-600">{c.cmd}</code>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{c.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Automated Notifications</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
            <li>Leave request submitted → Manager notified</li>
            <li>Leave approved/rejected → Employee notified</li>
            <li>Attendance reminder → Daily clock-in prompt</li>
            <li>Payslip ready → PDF sent via WhatsApp</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
