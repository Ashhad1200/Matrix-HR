/**
 * Full MatrixHR API + role-based auth matrix test.
 * Usage: pnpm exec tsx scripts/rbac-api-test.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { appendFileSync } from 'fs';
import { ROLES } from '@matrixhr/shared';

config({ path: resolve(__dirname, '../.env') });

const BASE = process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const LOG_PATH = resolve(__dirname, '../debug-317bd7.log');
const DEBUG_ENDPOINT = 'http://127.0.0.1:7483/ingest/b4385a4b-295d-4a65-b54c-a91d76c58e74';
const SESSION = '317bd7';

type RoleKey = 'admin' | 'hr' | 'manager' | 'employee' | 'none';
type Expect = 'allow' | 'deny' | 'public';

type Probe = {
  method: string;
  path: string;
  expect: Partial<Record<RoleKey, Expect>>;
  body?: unknown;
  note?: string;
};

const USERS: Record<Exclude<RoleKey, 'none'>, { email: string; role: string }> = {
  admin: { email: 'admin@acme.com', role: ROLES.COMPANY_ADMIN },
  hr: { email: 'hr@acme.com', role: ROLES.HR_MANAGER },
  manager: { email: 'ali.khan@acme.com', role: ROLES.MANAGER },
  employee: { email: 'sara.ahmed@acme.com', role: ROLES.EMPLOYEE },
};

const tokens: Partial<Record<Exclude<RoleKey, 'none'>, string>> = {};
const results: {
  role: RoleKey;
  method: string;
  path: string;
  status: number;
  expected: Expect;
  pass: boolean;
  note?: string;
}[] = [];

function debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  const entry = {
    sessionId: SESSION,
    runId: 'rbac-full',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    /* ignore */
  }
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

async function loginAll() {
  for (const [key, u] of Object.entries(USERS)) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: 'Password123!' }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Login failed for ${u.email}: ${data.message}`);
    tokens[key as Exclude<RoleKey, 'none'>] = data.accessToken;
    // #region agent log
    debugLog('H-B', 'rbac-api-test.ts:loginAll', 'role login ok', {
      role: key,
      portal: data.user?.permissions?.portal,
      navCount: data.user?.permissions?.nav?.length ?? 0,
      tokenLen: data.accessToken?.length ?? 0,
    });
    // #endregion
  }
}

async function ensureSeed() {
  // Optional warm-up — skip on timeout; base seed is enough for RBAC probes.
  try {
    const res = await fetch(`${API}/dev/seed-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({}));
    // #region agent log
    debugLog('H-F', 'rbac-api-test.ts:ensureSeed', 'seed-bulk finished', {
      status: res.status,
      ok: res.ok,
      note: data?.error || data?.ok,
    });
    // #endregion
  } catch (err: any) {
    // #region agent log
    debugLog('H-F', 'rbac-api-test.ts:ensureSeed', 'seed-bulk skipped', {
      reason: err?.name || String(err),
    });
    // #endregion
    console.warn('seed-bulk skipped (timeout or unavailable) — using existing data');
  }
}

async function probe(role: RoleKey, p: Probe) {
  const expected = p.expect[role] ?? p.expect.admin ?? 'allow';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (role !== 'none' && role !== 'public' as RoleKey) {
    const t = tokens[role as Exclude<RoleKey, 'none'>];
    if (t) headers.Authorization = `Bearer ${t}`;
  } else if (role === 'none') {
    /* no auth header */
  }

  let status = 0;
  let message = '';
  try {
    const res = await fetch(`${API}${p.path}`, {
      method: p.method,
      headers,
      body: p.body ? JSON.stringify(p.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    status = res.status;
    const text = await res.text();
    try {
      message = JSON.parse(text)?.message || text.slice(0, 120);
    } catch {
      message = text.slice(0, 120);
    }
  } catch (err: any) {
    status = 0;
    message = err.message;
  }

  const pass =
    expected === 'public' || expected === 'allow'
      ? status !== 401 && status !== 403 && status !== 0
      : expected === 'deny'
        ? status === 401 || status === 403
        : false;

  results.push({ role, method: p.method, path: p.path, status, expected, pass, note: message || p.note });

  if (!pass) {
    // #region agent log
    debugLog('H-A', 'rbac-api-test.ts:probe', 'RBAC mismatch', {
      role,
      method: p.method,
      path: p.path,
      status,
      expected,
      message,
    });
    // #endregion
  }

  return { status, pass };
}

const PROBES: Probe[] = [
  // Public
  { method: 'GET', path: '/tenants/subdomain/acme', expect: { none: 'public', admin: 'public' } },
  { method: 'GET', path: '/careers/acme/jobs', expect: { none: 'public' } },
  { method: 'GET', path: '/sso/acme/metadata', expect: { none: 'public' } },

  // Auth
  { method: 'GET', path: '/auth/me', expect: { admin: 'allow', hr: 'allow', manager: 'allow', employee: 'allow', none: 'deny' } },

  // Dashboard & notifications (all auth)
  { method: 'GET', path: '/dashboard', expect: { admin: 'allow', hr: 'allow', manager: 'allow', employee: 'allow', none: 'deny' } },
  { method: 'GET', path: '/notifications', expect: { admin: 'allow', employee: 'allow', none: 'deny' } },

  // Employees
  { method: 'GET', path: '/employees', expect: { admin: 'allow', employee: 'allow', none: 'deny' } },
  { method: 'GET', path: '/employees/team', expect: { manager: 'allow', employee: 'deny' } },
  { method: 'GET', path: '/employees/me/payslips', expect: { employee: 'allow' } },

  // Approvals (manager+)
  { method: 'GET', path: '/approvals/inbox', expect: { manager: 'allow', admin: 'allow', employee: 'deny', none: 'deny' } },

  // Payroll (HR/admin only)
  { method: 'GET', path: '/payroll/runs', expect: { admin: 'allow', hr: 'allow', manager: 'deny', employee: 'deny' } },
  { method: 'GET', path: '/payroll/w2?year=2025', expect: { admin: 'allow', employee: 'deny' } },

  // Recruitment (HR/admin)
  { method: 'GET', path: '/recruitment/jobs', expect: { admin: 'allow', employee: 'deny' } },

  // Reports (manager+)
  { method: 'GET', path: '/reports/headcount', expect: { manager: 'allow', admin: 'allow', employee: 'deny' } },

  // Admin-only settings
  { method: 'GET', path: '/api-keys', expect: { admin: 'allow', hr: 'deny', manager: 'deny' } },
  { method: 'GET', path: '/sso/config', expect: { admin: 'allow', hr: 'deny' } },

  // HR/admin modules
  { method: 'GET', path: '/custom-fields', expect: { admin: 'allow', hr: 'allow', employee: 'deny' } },
  { method: 'GET', path: '/workflows', expect: { admin: 'allow', employee: 'deny' } },
  { method: 'GET', path: '/audit/logs', expect: { admin: 'allow', employee: 'deny' } },
  { method: 'GET', path: '/enps/surveys/summary', expect: { admin: 'allow', employee: 'deny' } },
  { method: 'GET', path: '/integrations', expect: { admin: 'allow', employee: 'deny' } },
  { method: 'GET', path: '/eor/countries', expect: { admin: 'allow', employee: 'deny' } },

  // Manager hub
  { method: 'GET', path: '/one-on-ones', expect: { manager: 'allow', employee: 'deny' } },
  { method: 'GET', path: '/peer-reviews', expect: { manager: 'allow', employee: 'deny' } },

  // Timesheets
  { method: 'GET', path: '/timesheets/projects', expect: { employee: 'allow', admin: 'allow' } },
  { method: 'GET', path: '/timesheets/entries', expect: { employee: 'allow' } },
  { method: 'GET', path: '/timesheets/pending', expect: { manager: 'allow', employee: 'deny' } },

  // Performance (all auth)
  { method: 'GET', path: '/performance/goals', expect: { employee: 'allow', admin: 'allow' } },
  { method: 'GET', path: '/performance/reviews', expect: { admin: 'allow', employee: 'allow' } },

  // Leave & attendance
  { method: 'GET', path: '/leave/balances', expect: { employee: 'allow', none: 'deny' } },
  { method: 'GET', path: '/attendance/my-logs', expect: { employee: 'allow' } },
  { method: 'GET', path: '/attendance/dashboard', expect: { manager: 'allow', employee: 'deny' } },

  // Marketplace
  { method: 'GET', path: '/marketplace/integrations', expect: { admin: 'allow', employee: 'allow' } },
  { method: 'POST', path: '/marketplace/slack/connect', expect: { admin: 'allow', employee: 'deny' }, body: {} },

  // Extensions
  { method: 'GET', path: '/extensions/panels', expect: { admin: 'allow', employee: 'deny' } },

  // AI (all auth)
  { method: 'POST', path: '/ai/ask', expect: { employee: 'allow', none: 'deny' }, body: { question: 'leave balance?' } },

  // LMS
  { method: 'GET', path: '/lms/courses', expect: { employee: 'allow', admin: 'allow' } },
];

async function runAdminSmoke() {
  const token = tokens.admin!;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const smokePaths = [
    ['GET', '/employees/org-chart'],
    ['GET', '/employees/departments'],
    ['GET', '/leave/policies'],
    ['GET', '/leave/requests'],
    ['GET', '/leave/whos-out'],
    ['GET', '/onboarding/templates'],
    ['GET', '/onboarding/progress'],
    ['GET', '/recruitment/applications'],
    ['GET', '/performance/cycles'],
    ['GET', '/reports/leave-consumption'],
    ['GET', '/reports/attendance?month=2026-06'],
    ['GET', '/reports/payroll-cost'],
    ['GET', '/webhooks'],
    ['GET', '/formulas'],
    ['GET', '/report-definitions'],
    ['GET', '/preboarding'],
    ['GET', '/whatsapp/messages'],
    ['GET', '/marketplace/categories'],
  ] as const;

  let smokeFailed = 0;
  for (const [method, path] of smokePaths) {
    let status = 0;
    try {
      const res = await fetch(`${API}${path}`, { method, headers, signal: AbortSignal.timeout(15000) });
      status = res.status;
      const ok = status !== 401 && status !== 403 && status !== 0;
      if (!ok) smokeFailed++;
      // #region agent log
      debugLog('H-C', 'rbac-api-test.ts:runAdminSmoke', ok ? 'admin smoke ok' : 'admin smoke fail', {
        method,
        path,
        status,
      });
      // #endregion
      results.push({ role: 'admin', method, path, status, expected: 'allow', pass: ok });
    } catch (err: any) {
      smokeFailed++;
      // #region agent log
      debugLog('H-C', 'rbac-api-test.ts:runAdminSmoke', 'admin smoke timeout', {
        method,
        path,
        error: err?.name || String(err),
      });
      // #endregion
      results.push({ role: 'admin', method, path, status: 0, expected: 'allow', pass: false, note: err?.message });
    }
  }
  return smokeFailed;
}

function printReport() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  console.log('\n═══ MatrixHR Full API + RBAC Test ═══');
  console.log(`API: ${API}\n`);
  console.log(`Total probes: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed.length}\n`);

  if (failed.length) {
    console.log('── Failures ──');
    for (const f of failed) {
      console.log(`  [${f.role}] ${f.method} ${f.path} → ${f.status} (expected ${f.expected}) ${f.note || ''}`);
    }
  }

  const byRole = ['admin', 'hr', 'manager', 'employee', 'none'] as RoleKey[];
  console.log('\n── By role ──');
  for (const role of byRole) {
    const subset = results.filter((r) => r.role === role);
    if (!subset.length) continue;
    const ok = subset.filter((r) => r.pass).length;
    console.log(`  ${role}: ${ok}/${subset.length}`);
  }

  // #region agent log
  debugLog('H-D', 'rbac-api-test.ts:printReport', 'summary', {
    total: results.length,
    passed,
    failed: failed.length,
    failurePaths: failed.map((f) => `${f.role} ${f.method} ${f.path}`),
  });
  // #endregion
}

async function main() {
  console.log(`MatrixHR RBAC test → ${API}`);
  await ensureSeed();
  await loginAll();

  for (const p of PROBES) {
    const roles = (['admin', 'hr', 'manager', 'employee', 'none'] as RoleKey[]).filter(
      (r) => p.expect[r] !== undefined,
    );
    for (const role of roles) {
      await probe(role, p);
    }
  }

  await runAdminSmoke();
  printReport();

  const failed = results.filter((r) => !r.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  // #region agent log
  debugLog('H-E', 'rbac-api-test.ts:main', 'fatal', { error: String(err) });
  // #endregion
  console.error(err);
  process.exit(1);
});
