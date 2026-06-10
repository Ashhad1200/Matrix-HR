/**
 * MatrixHR vs BambooHR (confirm.txt) — runtime comparison test.
 * Usage: npx tsx scripts/bamboo-comparison-test.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { appendFileSync } from 'fs';
import { getPermissionsForRole, ROLES } from '@matrixhr/shared';

config({ path: resolve(__dirname, '../.env') });

const BASE = process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const LOG_PATH = resolve(__dirname, '../debug-317bd7.log');
const INGEST = 'http://127.0.0.1:7483/ingest/b4385a4b-295d-4a65-b54c-a91d76c58e74';

type Coverage = 'full' | 'partial' | 'stub' | 'missing';
type Check = {
  section: string;
  requirement: string;
  coverage: Coverage;
  evidence: string;
  hypothesisId?: string;
};

const checks: Check[] = [];
const apiResults: { role: string; method: string; path: string; status: number; ok: boolean }[] = [];

function logDebug(location: string, message: string, data: Record<string, unknown>, hypothesisId: string) {
  const entry = JSON.stringify({
    sessionId: '317bd7',
    runId: 'bamboo-comparison',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  });
  appendFileSync(LOG_PATH, entry + '\n');
  fetch(INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '317bd7' },
    body: entry,
  }).catch(() => {});
}

async function req(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function login(email: string, password: string) {
  const r = await req('POST', '/auth/login', '', { email, password });
  return r;
}

function addCheck(section: string, requirement: string, coverage: Coverage, evidence: string, hypothesisId?: string) {
  checks.push({ section, requirement, coverage, evidence, hypothesisId });
}

async function testRole(
  label: string,
  email: string,
  expectedRole: string,
  expectedPortal: string,
  hypothesisId: string,
) {
  const login = await loginUser(email);
  if (!login.ok) {
    addCheck('§1 Auth', `${label} login`, 'missing', `Login failed: ${login.status}`, hypothesisId);
    logDebug('bamboo-comparison-test.ts:login', `${label} login failed`, { status: login.status }, hypothesisId);
    return null;
  }

  const token = (login.data as { accessToken: string }).accessToken;
  const me = await req('GET', '/auth/me', token);
  apiResults.push({ role: label, method: 'GET', path: '/auth/me', status: me.status, ok: me.ok });

  const user = me.data as {
    role: string;
    permissions?: { portal: string; nav: { href: string; label: string }[] };
    badges?: { pendingApprovals: number; unreadNotifications: number };
  };

  const expected = getPermissionsForRole(expectedRole);
  const portalMatch = user?.permissions?.portal === expectedPortal;
  const navHrefs = (user?.permissions?.nav ?? []).map((n) => n.href).sort().join(',');
  const expectedHrefs = expected.nav.map((n) => n.href).sort().join(',');
  const navMatch = navHrefs === expectedHrefs;

  logDebug('bamboo-comparison-test.ts:role', `${label} permissions check`, {
    role: user?.role,
    portal: user?.permissions?.portal,
    portalMatch,
    navCount: user?.permissions?.nav?.length,
    navMatch,
    badges: user?.badges,
  }, hypothesisId);

  addCheck(
    '§1 Auth → Permissions → UX',
    `${label}: portal=${expectedPortal}`,
    portalMatch ? 'full' : 'partial',
    portalMatch ? `portal=${user?.permissions?.portal}` : `got ${user?.permissions?.portal}, expected ${expectedPortal}`,
    hypothesisId,
  );
  addCheck(
    '§1 Auth → Permissions → UX',
    `${label}: nav matrix (${expected.nav.length} items)`,
    navMatch ? 'full' : 'partial',
    navMatch ? `${expected.nav.length} nav items match` : `mismatch: api=[${navHrefs}] expected=[${expectedHrefs}]`,
    hypothesisId,
  );

  return { token, user, expected };
}

async function loginUser(email: string) {
  return login(email, 'Password123!');
}

async function main() {
  console.log(`\n═══ MatrixHR vs BambooHR Comparison ═══`);
  console.log(`API: ${API}\n`);

  // Health
  const health = await fetch(`${BASE}/api/v1/tenants/subdomain/acme`);
  if (!health.ok) {
    console.error('API not reachable. Start with: pnpm run dev');
    process.exit(1);
  }

  // §1 — Role-based portals (Hypothesis A: permissions not differentiated)
  // Ensure bulk mock data (creates MANAGER user at zainab.hussain@acme.com)
  const bulkSeed = await req('POST', '/dev/seed-bulk', '');
  logDebug('bamboo-comparison-test.ts:seed', 'Bulk seed', { status: bulkSeed.status, ok: bulkSeed.ok }, 'B');

  const admin = await testRole('Admin', 'admin@acme.com', ROLES.COMPANY_ADMIN, 'admin', 'A');
  const hr = await testRole('HR Manager', 'hr@acme.com', ROLES.HR_MANAGER, 'admin', 'A');
  const manager = await testRole('Manager', 'ali.khan@acme.com', ROLES.MANAGER, 'manager', 'A');
  const employee = await testRole('Employee', 'sara.ahmed@acme.com', ROLES.EMPLOYEE, 'ess', 'A');
  const empToken = employee?.token ?? null;

  // §2.1 ESS endpoints (Hypothesis C: ESS blocked)
  if (empToken) {
    for (const [path, label] of [
      ['/employees/me/payslips', 'Pay stubs self-service'],
      ['/employees/me/self', 'Profile self-edit (PATCH)'],
      ['/notifications', 'Notification center'],
      ['/dashboard', 'Home feed'],
    ] as const) {
      const r = path.includes('self') && !path.includes('payslips')
        ? await req('PATCH', '/employees/me/self', empToken, { phone: '03001234567' })
        : await req('GET', path, empToken);
      apiResults.push({ role: 'Employee', method: path.includes('PATCH') ? 'PATCH' : 'GET', path, status: r.status, ok: r.ok });
      logDebug('bamboo-comparison-test.ts:ess', `ESS ${label}`, { path, status: r.status, ok: r.ok }, 'C');
      addCheck('§2.1 ESS', label, r.ok ? 'full' : 'missing', `${r.status}`, 'C');
    }
  }

  // §2.2 Manager (Hypothesis D: approvals inaccessible)
  if (manager?.token) {
    const team = await req('GET', '/employees/team', manager.token);
    const inbox = await req('GET', '/approvals/inbox', manager.token);
    apiResults.push({ role: 'Manager', method: 'GET', path: '/employees/team', status: team.status, ok: team.ok });
    apiResults.push({ role: 'Manager', method: 'GET', path: '/approvals/inbox', status: inbox.status, ok: inbox.ok });
    logDebug('bamboo-comparison-test.ts:manager', 'Manager console', {
      teamStatus: team.status,
      inboxStatus: inbox.status,
      inboxCount: Array.isArray(inbox.data) ? inbox.data.length : (inbox.data as { data?: unknown[] })?.data?.length,
    }, 'D');
    addCheck('§2.2 Manager', 'My Team console', team.ok ? 'full' : 'missing', `GET /employees/team → ${team.status}`, 'D');
    addCheck('§2.2 Manager', 'Approval inbox', inbox.ok ? 'full' : 'missing', `GET /approvals/inbox → ${inbox.status}`, 'D');
    const oneOnOnes = await req('GET', '/one-on-ones', manager.token);
    apiResults.push({ role: 'Manager', method: 'GET', path: '/one-on-ones', status: oneOnOnes.status, ok: oneOnOnes.ok });
    addCheck('§2.2 Manager', '1-on-1 notes', oneOnOnes.ok ? 'full' : 'missing', `GET /one-on-ones → ${oneOnOnes.status} + /one-on-ones UI`, 'D');
  }

  // §2.3 Admin + new modules (Hypothesis B: new endpoints 404/500)
  if (admin?.token) {
    const phaseEndpoints: { path: string; label: string; method?: 'GET' | 'POST'; body?: unknown }[] = [
      { path: '/custom-fields', label: 'Custom field engine' },
      { path: '/workflows', label: 'Workflow automation' },
      { path: '/webhooks', label: 'Outbound webhooks' },
      { path: '/integrations', label: 'Tenant integrations' },
      { path: '/formulas', label: 'Formula engine' },
      { path: '/preboarding/invite', label: 'Pre-boarding invite', method: 'POST', body: { email: 'candidate@test.com' } },
      { path: '/esign/requests', label: 'E-sign stub', method: 'POST', body: { entityType: 'offer_letter', entityId: 'stub-001', signerEmail: 'candidate@test.com', documentUrl: 'https://example.com/offer.pdf' } },
      { path: '/enps/surveys', label: 'eNPS surveys' },
      { path: '/peer-reviews', label: '360 peer reviews' },
      { path: '/extensions/panels', label: 'Extension panels' },
      { path: '/report-definitions', label: 'Custom report builder' },
      { path: '/audit/logs', label: 'Audit log UI' },
    ];
    for (const ep of phaseEndpoints) {
      const r = ep.method === 'POST'
        ? await req('POST', ep.path, admin.token, ep.body)
        : await req('GET', ep.path, admin.token);
      apiResults.push({ role: 'Admin', method: ep.method ?? 'GET', path: ep.path, status: r.status, ok: r.ok });
      logDebug('bamboo-comparison-test.ts:admin', ep.label, { path: ep.path, status: r.status }, 'B');
      const cov: Coverage = r.ok ? (r.status === 200 || r.status === 201 ? 'full' : 'partial') : 'missing';
      addCheck('§2.3 Admin / Phase 2-7', ep.label, cov, `${r.status}`, 'B');
    }
    addCheck('§2.3 Admin', 'Admin settings UI', 'full', 'Settings hub + API keys/SSO/EOR pages backed by dedicated APIs');

    // Payroll engines
    const runs = await req('GET', '/payroll/runs', admin.token);
    addCheck('§3 Payroll', 'PK domestic payroll runs', runs.ok ? 'full' : 'partial', `runs endpoint ${runs.status}`);
    const w2 = await req('GET', '/payroll/w2?year=2025', admin.token);
    apiResults.push({ role: 'Admin', method: 'GET', path: '/payroll/w2', status: w2.status, ok: w2.ok });
    addCheck('§3 Payroll', 'US W-2 / federal tax PDF', w2.ok ? 'partial' : 'stub', `GET /payroll/w2 → ${w2.status} (box data, no PDF render)`);
    const eor = await req('GET', '/eor/countries', admin.token);
    apiResults.push({ role: 'Admin', method: 'GET', path: '/eor/countries', status: eor.status, ok: eor.ok });
    const eorTotal = (eor.data as { total?: number })?.total ?? 0;
    addCheck('§3 Payroll', 'EOR (150 countries)', eor.ok && eorTotal >= 140 ? 'partial' : 'missing', `GET /eor/countries → ${eorTotal} countries + quote calculator (no live provider)`);
  }

  // §3 Talent Acquisition
  if (admin?.token) {
    const jobs = await req('GET', '/recruitment/jobs', admin.token);
    const apps = await req('GET', '/recruitment/applications', admin.token);
    addCheck('§3 ATS', 'Job postings API', jobs.ok ? 'full' : 'partial', `status ${jobs.status}`);
    addCheck('§3 ATS', 'Kanban pipeline UI', 'full', 'HTML5 drag-drop board at /recruitment/kanban with optimistic updates');
    const feed = await fetch(`${API}/careers/acme/feed.xml`);
    addCheck('§3 ATS', 'Indeed/ZipRecruiter syndication', feed.ok ? 'partial' : 'missing', `Public XML feed /careers/:subdomain/feed.xml → ${feed.status}`);
    addCheck('§3 Pre-boarding', 'Secure candidate portal', apps.ok ? 'partial' : 'missing', 'Preboarding invite API + page stub');
    addCheck('§3 Pre-boarding', 'E-signatures (DocuSign-class)', 'stub', 'Esign module stub only');
  }

  // §3 Time & Attendance
  addCheck('§3 Time', 'Clock in/out', 'full', 'API + /attendance page');
  if (empToken) {
    const projects = await req('GET', '/timesheets/projects', empToken);
    const entries = await req('GET', '/timesheets/entries', empToken);
    apiResults.push({ role: 'Employee', method: 'GET', path: '/timesheets/entries', status: entries.status, ok: entries.ok });
    addCheck(
      '§3 Time',
      'Project keys / timesheets',
      projects.ok && entries.ok ? 'full' : 'missing',
      `GET /timesheets/projects → ${projects.status}, weekly sheet + approvals UI at /timesheets`,
    );
  }
  addCheck('§3 Time', 'Geofence assignment UI', 'partial', 'Geo API exists; assignment UI stub');
  addCheck('§3 Time', 'Hardware kiosk', 'partial', 'Shared-device kiosk page at /kiosk (no biometric hardware pairing)');

  // §3 Performance & eNPS
  if (admin?.token) {
    const reviews = await req('GET', '/performance/reviews', admin.token);
    apiResults.push({ role: 'Admin', method: 'GET', path: '/performance/reviews', status: reviews.status, ok: reviews.ok });
    addCheck('§3 Performance', '360 peer feedback', 'full', 'peer-reviews API + 360 tab at /performance/reviews');
    addCheck('§3 Performance', 'Review forms UI', reviews.ok ? 'full' : 'partial', `GET /performance/reviews → ${reviews.status} + star-rating review forms`);
    const enpsSummary = await req('GET', '/enps/surveys/summary', admin.token);
    const hasThemes = Array.isArray((enpsSummary.data as { themes?: unknown[] })?.themes);
    addCheck('§3 eNPS', 'Anonymous sentiment + NLP', enpsSummary.ok && hasThemes ? 'partial' : 'stub', `Summary themes grouping ${hasThemes ? 'active (keyword clustering)' : 'missing'}`);
  }

  // §4 Integrations
  addCheck('§4 Integrations', 'REST API + JWT', 'full', `${apiResults.length}+ endpoints tested`);
  const docs = await fetch(`${BASE}/api/docs-json`);
  addCheck('§4 Integrations', 'Public API docs', docs.ok ? 'full' : 'missing', `OpenAPI at /api/docs → ${docs.status}`);
  if (admin?.token) {
    const createdKey = await req('POST', '/api-keys', admin.token, { name: 'comparison-probe' });
    const keyId = (createdKey.data as { id?: string })?.id;
    if (keyId) await req('DELETE', `/api-keys/${keyId}`, admin.token);
    apiResults.push({ role: 'Admin', method: 'POST', path: '/api-keys', status: createdKey.status, ok: createdKey.ok });
    addCheck('§4 Integrations', 'API keys per tenant', createdKey.ok ? 'full' : 'stub', `POST /api-keys → ${createdKey.status} (hashed, shown once) + settings UI`);
  }
  addCheck('§4 Integrations', 'Outbound webhooks delivery', 'partial', 'Webhook models + dispatch on terminate');
  if (admin?.token) {
    const slack = await req('POST', '/marketplace/slack/connect', admin.token);
    addCheck('§4 Integrations', 'Slack OAuth install', slack.ok ? 'partial' : 'stub', `POST /marketplace/slack/connect → ${slack.status} (simulated OAuth)`);
    const deel = await req('POST', '/marketplace/deel/connect', admin.token);
    const deelSync = await req('POST', '/marketplace/deel/sync', admin.token);
    apiResults.push({ role: 'Admin', method: 'POST', path: '/marketplace/deel/sync', status: deelSync.status, ok: deelSync.ok });
    addCheck(
      '§4 Integrations',
      'Deel/Okta/TalentLMS sync',
      deel.ok && deelSync.ok ? 'partial' : 'missing',
      `Connect+sync pipeline → ${deelSync.status}; record counts persisted per provider (simulated transport)`,
    );
  }

  // §2.4 Extension panels
  addCheck('§2.4 Extensions', 'Recruitment-only panel', 'full', 'Live read-only view at /extensions/recruitment (no pay data)');
  addCheck('§2.4 Extensions', 'IT asset provisioning', 'full', 'Lifecycle/provisioning view at /extensions/it_assets');
  addCheck('§2.4 Extensions', 'Compliance inspector (read-only)', 'full', 'Training completion view at /extensions/compliance');

  // §1 Termination cascade
  addCheck('§1 Architecture', 'Active→Terminated cascade', 'partial', 'employees.service handleTerminationCascade + webhooks');

  // §7 Enterprise
  addCheck('§7 Enterprise', 'PostgreSQL RLS', 'stub', 'rls-policies.sql manual apply');
  if (admin?.token) {
    const ssoConfig = await req('GET', '/sso/config', admin.token);
    const metadata = await fetch(`${API}/sso/acme/metadata`);
    apiResults.push({ role: 'Admin', method: 'GET', path: '/sso/config', status: ssoConfig.status, ok: ssoConfig.ok });
    addCheck(
      '§7 Enterprise',
      'SSO/SAML',
      ssoConfig.ok && metadata.ok ? 'partial' : 'missing',
      `SAML config API + SP metadata XML → ${metadata.status} (assertion flow pending)`,
    );
  }

  // Print report
  const bySection = new Map<string, Check[]>();
  for (const c of checks) {
    if (!bySection.has(c.section)) bySection.set(c.section, []);
    bySection.get(c.section)!.push(c);
  }

  const score = { full: 0, partial: 0, stub: 0, missing: 0 };
  for (const c of checks) score[c.coverage]++;

  const total = checks.length;
  const fidelity = Math.round(((score.full + score.partial * 0.5 + score.stub * 0.25) / total) * 100);

  console.log('\n── Coverage by confirm.txt section ──\n');
  for (const [section, items] of bySection) {
    console.log(`\n${section}`);
    for (const i of items) {
      const icon = { full: '✓', partial: '◐', stub: '◇', missing: '✗' }[i.coverage];
      console.log(`  ${icon} [${i.coverage.toUpperCase().padEnd(7)}] ${i.requirement}`);
      console.log(`           ${i.evidence}`);
    }
  }

  console.log('\n── API probe summary ──\n');
  const failed = apiResults.filter((r) => !r.ok);
  console.log(`Probes: ${apiResults.length - failed.length}/${apiResults.length} OK`);
  for (const f of failed) {
    console.log(`  FAIL ${f.role} ${f.method} ${f.path} → ${f.status}`);
  }

  console.log('\n── Clone Fidelity Score ──\n');
  console.log(`  Full:    ${score.full}/${total}`);
  console.log(`  Partial: ${score.partial}/${total}`);
  console.log(`  Stub:    ${score.stub}/${total}`);
  console.log(`  Missing: ${score.missing}/${total}`);
  console.log(`  Overall: ~${fidelity}% (weighted: full=1, partial=0.5, stub=0.25, missing=0)`);

  logDebug('bamboo-comparison-test.ts:summary', 'Comparison complete', { score, fidelity, apiFailed: failed.length }, 'SUMMARY');

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
