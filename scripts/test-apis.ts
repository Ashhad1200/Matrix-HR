/**
 * MatrixHR API smoke test — hits all public + authenticated endpoints.
 * Usage: npx tsx scripts/test-apis.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

const BASE = process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
const API = `${BASE}/api/v1`;

type Result = { method: string; path: string; status: number; ok: boolean; note?: string };

const results: Result[] = [];
let token = '';
let refreshToken = '';
let tenantId = '';
let employeeId = '';
let leaveRequestId = '';
let payrollRunId = '';
let jobId = '';
let applicationId = '';
let courseId = '';
let goalId = '';
let cycleId = '';
let notificationId = '';
let onboardingProgressId = '';
let onboardingTaskId = '';

async function req(
  method: string,
  path: string,
  body?: unknown,
  auth = true,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  results.push({
    method,
    path,
    status: res.status,
    ok: res.ok,
    note: res.ok ? undefined : String(data?.message || text).slice(0, 80),
  });

  return { status: res.status, data };
}

async function main() {
  console.log(`Testing MatrixHR API at ${API}\n`);

  // Public
  await req('GET', '/tenants/subdomain/acme', undefined, false);

  const login = await req('POST', '/auth/login', {
    email: 'admin@acme.com',
    password: 'Password123!',
  }, false);

  if (login.status !== 200 && login.status !== 201) {
    console.error('Login failed — is the API running?');
    printReport();
    process.exit(1);
  }

  token = login.data.accessToken;
  refreshToken = login.data.refreshToken;
  tenantId = login.data.tenant?.id;
  employeeId = login.data.user?.employeeId;

  // Ensure bulk mock data exists (25 entries per entity)
  await req('POST', '/dev/seed-bulk');

  await req('POST', '/auth/refresh', { refreshToken }, false);
  await req('GET', '/auth/me');

  // Dashboard & notifications
  await req('GET', '/dashboard');
  const notifs = await req('GET', '/notifications');
  notificationId = notifs.data?.[0]?.id;

  // Employees
  await req('GET', '/employees');
  await req('GET', '/employees/org-chart');
  await req('GET', '/employees/departments');
  await req('GET', '/employees/designations');
  if (employeeId) await req('GET', `/employees/${employeeId}`);

  // Leave
  await req('GET', '/leave/policies');
  await req('GET', '/leave/balances');
  const leaveReqs = await req('GET', '/leave/requests');
  leaveRequestId = leaveReqs.data?.[0]?.id;
  await req('GET', '/leave/whos-out');
  await req('GET', '/leave/holidays');

  // Attendance
  await req('GET', '/attendance/my-logs');
  await req('GET', '/attendance/dashboard');

  // Onboarding
  await req('GET', '/onboarding/templates');
  const progress = await req('GET', '/onboarding/progress');
  onboardingProgressId = progress.data?.[0]?.id;
  onboardingTaskId = progress.data?.[0]?.tasks?.[0]?.taskId;
  await req('GET', '/onboarding/dashboard');

  // Payroll
  const runs = await req('GET', '/payroll/runs');
  payrollRunId = runs.data?.[0]?.id;
  if (payrollRunId) {
    await req('GET', `/payroll/runs/${payrollRunId}`);
    await req('GET', `/payroll/runs/${payrollRunId}/bank-file?bank=meezan`);
  }

  // Recruitment
  const jobs = await req('GET', '/recruitment/jobs');
  jobId = jobs.data?.[0]?.id;
  const apps = await req('GET', '/recruitment/applications');
  applicationId = apps.data?.[0]?.id;

  // Performance
  const cycles = await req('GET', '/performance/cycles');
  cycleId = cycles.data?.[0]?.id;
  const goals = await req('GET', '/performance/goals');
  goalId = goals.data?.[0]?.id;

  // LMS
  const courses = await req('GET', '/lms/courses');
  courseId = courses.data?.[0]?.id;

  // Reports
  await req('GET', '/reports/headcount');
  await req('GET', '/reports/leave-consumption');
  await req('GET', '/reports/attendance?month=2026-06');
  await req('GET', '/reports/payroll-cost');

  // AI & Marketplace
  await req('POST', '/ai/ask', { question: 'How many leave days do I have?' });
  await req('POST', '/ai/rank-candidate', { resume: 'React Node.js TypeScript', jobDescription: 'Software Engineer' });
  await req('GET', '/marketplace/integrations');
  await req('GET', '/marketplace/categories');

  // WhatsApp
  await req('GET', '/whatsapp/messages');
  await req('POST', '/whatsapp/webhook', { entry: [{ changes: [{ value: { messages: [{ from: '923001234567', text: { body: 'balance' } }] } }] }] }, false);

  // Tenant branding
  await req('PATCH', '/tenants/branding', { primaryColor: '#2563eb' });

  printReport();
  const failed = results.filter((r) => !r.ok);
  process.exit(failed.length > 0 ? 1 : 0);
}

function printReport() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Results: ${passed}/${results.length} passed`);
  if (failed.length) {
    console.log('\nFailed:');
    for (const f of failed) {
      console.log(`  ${f.method} ${f.path} → ${f.status} ${f.note || ''}`);
    }
  } else {
    console.log('All endpoints responded successfully.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
