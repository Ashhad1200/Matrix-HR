'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

export default function AttendancePage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [todayLog, setTodayLog] = useState<any>(null);

  const month = new Date().toISOString().slice(0, 7);

  function load() {
    api.attendance.myLogs(month).then(setLogs).catch(console.error);
    api.attendance.dashboard().then(setDashboard).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function clockIn() {
    await api.attendance.clockIn();
    load();
  }

  async function clockOut() {
    await api.attendance.clockOut();
    load();
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = logs.find((l) => l.date?.startsWith(today));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Attendance</h1>

      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-lg font-medium">Today</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {todayEntry?.clockIn ? `Clocked in at ${new Date(todayEntry.clockIn).toLocaleTimeString()}` : 'Not clocked in'}
              {todayEntry?.clockOut ? ` · Out at ${new Date(todayEntry.clockOut).toLocaleTimeString()}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={clockIn} disabled={!!todayEntry?.clockIn}>Clock In</Button>
            <Button variant="secondary" onClick={clockOut} disabled={!todayEntry?.clockIn || !!todayEntry?.clockOut}>Clock Out</Button>
          </div>
        </CardContent>
      </Card>

      {dashboard && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Present', value: dashboard.present },
            { label: 'On Leave', value: dashboard.onLeave },
            { label: 'Absent', value: dashboard.absent },
            { label: 'Late', value: dashboard.late },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>This Month</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`rounded p-2 text-center text-xs ${
                  log.status === 'PRESENT' ? 'bg-green-100 dark:bg-green-900' :
                  log.status === 'ABSENT' ? 'bg-red-100 dark:bg-red-900' :
                  'bg-gray-100 dark:bg-gray-800'
                }`}
                title={`${formatDate(log.date)} - ${log.status}`}
              >
                {new Date(log.date).getDate()}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
