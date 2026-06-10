'use client';

import { useEffect, useState } from 'react';
import { Clock, LogIn, LogOut, CheckCircle2, XCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/** Shared-device attendance kiosk: each punch authenticates, clocks, and forgets. */
export default function KioskPage() {
  const [now, setNow] = useState(new Date());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const punch = async (direction: 'in' | 'out') => {
    setBusy(true);
    setResult(null);
    try {
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!loginRes.ok) throw new Error('Invalid credentials');
      const { accessToken } = await loginRes.json();

      const res = await fetch(`${API_URL}/attendance/clock-${direction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: direction === 'in' ? JSON.stringify({}) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Clock ${direction} failed`);

      setResult({ ok: true, message: `Clocked ${direction} at ${new Date().toLocaleTimeString()}` });
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(false);
      setTimeout(() => setResult(null), 5000);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-950 via-[#0b2e22] to-brand-900 p-6 text-white">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 font-display text-xl font-bold backdrop-blur">
          M
        </div>
        <p className="font-display text-6xl font-bold tabular-nums tracking-tight sm:text-7xl">
          {now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <p className="mt-2 text-lg text-white/60">
          {now.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3 rounded-3xl bg-white/10 p-6 backdrop-blur-lg">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/70">
          <Clock className="h-4 w-4" /> Attendance Kiosk
        </div>
        <input
          type="email"
          placeholder="Work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none"
        />
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            disabled={busy || !email || !password}
            onClick={() => punch('in')}
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-brand-500 font-semibold transition-all hover:bg-brand-400 disabled:opacity-40"
          >
            <LogIn className="h-5 w-5" /> Clock In
          </button>
          <button
            type="button"
            disabled={busy || !email || !password}
            onClick={() => punch('out')}
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-white/15 font-semibold transition-all hover:bg-white/25 disabled:opacity-40"
          >
            <LogOut className="h-5 w-5" /> Clock Out
          </button>
        </div>

        {result && (
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium animate-rise ${
              result.ok ? 'bg-brand-500/30 text-brand-100' : 'bg-rose-500/30 text-rose-100'
            }`}
          >
            {result.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
            {result.message}
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-white/40">MatrixHR Kiosk Mode · credentials are never stored on this device</p>
    </div>
  );
}
