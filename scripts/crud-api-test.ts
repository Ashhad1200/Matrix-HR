/**
 * Full Create -> Read -> Update -> Delete verification for every module
 * that exposes a complete CRUD API (checked via presence of @Delete()).
 * Usage: pnpm exec tsx scripts/crud-api-test.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

const BASE = process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
const API = `${BASE}/api/v1`;

type Step = { op: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'VERIFY-GONE'; ok: boolean; status: number; note?: string };
type ModuleResult = { module: string; steps: Step[]; ok: boolean };

const results: ModuleResult[] = [];
let token = '';

async function req(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

async function crud(
  module: string,
  opts: {
    createPath: string;
    createBody: unknown | (() => Promise<unknown>);
    idField?: string;
    readPath?: (id: string) => string;
    updatePath: (id: string) => string;
    updateBody: unknown;
    deletePath: (id: string) => string;
  },
) {
  const steps: Step[] = [];
  let id = '';

  const body = typeof opts.createBody === 'function' ? await (opts.createBody as () => Promise<unknown>)() : opts.createBody;
  const create = await req('POST', opts.createPath, body);
  id = create.data?.[opts.idField ?? 'id'];
  steps.push({ op: 'CREATE', ok: create.ok && !!id, status: create.status, note: create.ok ? id : JSON.stringify(create.data).slice(0, 150) });

  if (id && opts.readPath) {
    const read = await req('GET', opts.readPath(id));
    steps.push({ op: 'READ', ok: read.ok, status: read.status });
  }

  if (id) {
    const update = await req('PATCH', opts.updatePath(id), opts.updateBody);
    steps.push({ op: 'UPDATE', ok: update.ok, status: update.status, note: update.ok ? undefined : JSON.stringify(update.data).slice(0, 150) });

    const del = await req('DELETE', opts.deletePath(id));
    steps.push({ op: 'DELETE', ok: del.ok, status: del.status, note: del.ok ? undefined : JSON.stringify(del.data).slice(0, 150) });

    if (del.ok && opts.readPath) {
      const verify = await req('GET', opts.readPath(id));
      steps.push({ op: 'VERIFY-GONE', ok: verify.status === 404, status: verify.status });
    }
  }

  const ok = steps.length > 0 && steps.every((s) => s.ok);
  results.push({ module, steps, ok });
}

async function main() {
  console.log(`Full CRUD test -> ${API}\n`);

  const login = await req('POST', '/auth/login', { email: 'admin@acme.com', password: 'Password123!' });
  if (!login.ok) { console.error('Login failed:', login.data); process.exit(1); }
  token = login.data.accessToken;

  const stamp = Date.now();

  await crud('custom-fields', {
    createPath: '/custom-fields',
    createBody: { entity: 'Employee', key: `crudTest_${stamp}`, label: 'CRUD Test Field', fieldType: 'text', required: false },
    readPath: (id) => `/custom-fields/${id}`,
    updatePath: (id) => `/custom-fields/${id}`,
    updateBody: { label: 'CRUD Test Field (updated)' },
    deletePath: (id) => `/custom-fields/${id}`,
  });

  await crud('webhooks', {
    createPath: '/webhooks',
    createBody: { url: `https://example.com/hook-${stamp}`, events: ['employee.created'], isActive: true },
    readPath: (id) => `/webhooks/${id}`,
    updatePath: (id) => `/webhooks/${id}`,
    updateBody: { isActive: false },
    deletePath: (id) => `/webhooks/${id}`,
  });

  await crud('formulas', {
    createPath: '/formulas',
    createBody: { name: `CRUD Test Formula ${stamp}`, entity: 'PayrollItem', expression: 'baseSalary * 0.1', targetField: 'bonus' },
    readPath: (id) => `/formulas/${id}`,
    updatePath: (id) => `/formulas/${id}`,
    updateBody: { expression: 'baseSalary * 0.15' },
    deletePath: (id) => `/formulas/${id}`,
  });

  await crud('workflows', {
    createPath: '/workflows',
    createBody: { name: `CRUD Test Workflow ${stamp}`, trigger: 'employee.profile.updated', steps: [{ type: 'notify', target: 'manager' }], isActive: true },
    readPath: (id) => `/workflows/${id}`,
    updatePath: (id) => `/workflows/${id}`,
    updateBody: { isActive: false },
    deletePath: (id) => `/workflows/${id}`,
  });

  await crud('reports-builder (report-definitions)', {
    createPath: '/report-definitions',
    createBody: { name: `CRUD Test Report ${stamp}`, config: { entity: 'Employee', columns: ['firstName', 'lastName'] } },
    readPath: (id) => `/report-definitions/${id}`,
    updatePath: (id) => `/report-definitions/${id}`,
    updateBody: { name: `CRUD Test Report ${stamp} (updated)` },
    deletePath: (id) => `/report-definitions/${id}`,
  });

  await crud('enps (surveys)', {
    createPath: '/enps/surveys',
    createBody: { title: `CRUD Test Survey ${stamp}`, question: 'How likely are you to recommend us?' },
    readPath: (id) => `/enps/surveys/${id}`,
    updatePath: (id) => `/enps/surveys/${id}`,
    updateBody: { title: `CRUD Test Survey ${stamp} (updated)` },
    deletePath: (id) => `/enps/surveys/${id}`,
  });

  await crud('api-keys', {
    createPath: '/api-keys',
    createBody: { name: `CRUD Test Key ${stamp}` },
    readPath: undefined,
    updatePath: (id) => `/api-keys/${id}`, // no PATCH route — expect this to fail, exposing the gap
    updateBody: {},
    deletePath: (id) => `/api-keys/${id}`,
  });

  await crud('one-on-ones', {
    createPath: '/one-on-ones',
    createBody: async () => {
      const emps = await req('GET', '/employees?limit=1');
      const employeeId = emps.data?.data?.[0]?.id;
      return { employeeId, scheduledAt: new Date(Date.now() + 86400000).toISOString(), talkingPoints: [{ text: 'Career growth', done: false }] };
    },
    readPath: undefined,
    updatePath: (id) => `/one-on-ones/${id}`,
    updateBody: { status: 'completed' },
    deletePath: (id) => `/one-on-ones/${id}`,
  });

  await crud('peer-reviews', {
    createPath: '/peer-reviews',
    createBody: async () => {
      const [cycles, emps] = await Promise.all([req('GET', '/performance/cycles'), req('GET', '/employees?limit=2')]);
      const cycleId = cycles.data?.[0]?.id ?? cycles.data?.data?.[0]?.id;
      const employeeId = emps.data?.data?.[0]?.id;
      const reviewerId = emps.data?.data?.[1]?.id ?? employeeId;
      return { cycleId, employeeId, reviewerId, relationship: 'peer', isAnonymous: true };
    },
    readPath: (id) => `/peer-reviews/${id}`,
    updatePath: (id) => `/peer-reviews/${id}`,
    updateBody: { rating: 4 },
    deletePath: (id) => `/peer-reviews/${id}`,
  });

  await crud('timesheets (projects, no delete route — expected gap)', {
    createPath: '/timesheets/projects',
    createBody: { key: `CRUD${stamp % 100000}`, name: `CRUD Test Project ${stamp}` },
    readPath: undefined,
    updatePath: (id) => `/timesheets/projects/${id}`, // no update route either — expect failure
    updateBody: {},
    deletePath: (id) => `/timesheets/projects/${id}`,
  });

  // ── Report ──
  console.log('═══ CRUD results (Create → Read → Update → Delete) ═══\n');
  for (const m of results) {
    console.log(`${m.ok ? '✓' : '✗'} ${m.module}`);
    for (const s of m.steps) {
      console.log(`    ${s.ok ? 'ok  ' : 'FAIL'} ${s.op.padEnd(12)} ${s.status}${s.note ? ` — ${s.note}` : ''}`);
    }
  }

  const passedModules = results.filter((r) => r.ok).length;
  console.log(`\n${passedModules}/${results.length} modules completed a full CRUD cycle successfully.`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
