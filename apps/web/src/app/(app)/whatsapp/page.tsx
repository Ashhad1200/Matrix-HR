'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export default function WhatsAppPage() {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    api.whatsapp.messages().then(setMessages).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">WhatsApp Integration</h1>

      <div className="grid gap-6 lg:grid-cols-2">
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
          <CardHeader><CardTitle>Message Log ({messages.length})</CardTitle></CardHeader>
          <CardContent className="max-h-96 space-y-2 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No messages yet</p>
            ) : messages.map((m) => (
              <div key={m.id} className="rounded-lg border border-[hsl(var(--border))] p-3 text-sm">
                <div className="flex justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${m.direction === 'inbound' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {m.direction}
                  </span>
                  <span className="text-[hsl(var(--muted-foreground))]">{formatDate(m.createdAt)}</span>
                </div>
                <p className="mt-1">{m.body}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{m.recipientPhone} · {m.status}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

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
