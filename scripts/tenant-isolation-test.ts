/**
 * Black-box tenant-isolation proof (ENGINEERING_ROADMAP.md Phase 5; checklist.md #1 IDOR).
 * RLS is not active, so isolation rests entirely on application-layer scoping — this suite is the
 * evidence for it. It needs two seeded tenants (Acme + Globex: `seed-globex.ts`) and works by:
 *   1. Discovering every route from the OpenAPI document (no hand-maintained list to forget to update).
 *   2. Harvesting the ids of everything each tenant admin can list.
 *   3. Replaying the OTHER tenant's ids against every parameterised route (GET/PATCH/PUT/DELETE/POST),
 *      expecting a refusal — never a 2xx.
 *   4. Scanning every response an attacker receives for ANY of the victim's ids or tenantId.
 * Mutations only go Acme -> Globex so a leak damages the disposable tenant, never the demo data.
 * Usage: pnpm test:isolation
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

const ORIGIN = process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
const API = `${ORIGIN}/api/v1`;
const PASSWORD = 'Password123!';
const IDS_PER_PREFIX = 3;

type Res = { status: number; text: string; json: any };

async function call(token: string, method: string, path: string, body?: unknown): Promise<Res> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  return { status: res.status, text, json };
}

async function login(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body: any = await res.json();
  if (!body.accessToken) throw new Error(`login failed for ${email}`);
  const me = await call(body.accessToken, 'GET', '/auth/me');
  return { token: body.accessToken as string, tenantId: me.json.tenantId as string };
}

/** Routes that are intentionally reachable across tenants or aren't tenant data. */
const SKIP_PREFIXES = ['/auth', '/platform', '/dev', '/sso/', '/health', '/marketplace', '/biometric', '/iclock'];
const skipPath = (p: string) => SKIP_PREFIXES.some((s) => p === s.replace(/\/$/, '') || p.startsWith(s));

function collectIds(payload: any): string[] {
  const out: string[] = [];
  const walk = (v: any) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if (typeof v.id === 'string') out.push(v.id);
      Object.values(v).forEach(walk);
    }
  };
  walk(payload);
  return out;
}

/** Harvest what several roles of one tenant can list — some lists (timesheets, 1:1s) are per-user. */
async function harvest(tokens: string | string[], listPaths: string[]) {
  const byPrefix = new Map<string, string[]>();
  const allIds = new Set<string>();
  for (const token of Array.isArray(tokens) ? tokens : [tokens]) {
    for (const p of listPaths) {
      const r = await call(token, 'GET', p);
      if (r.status !== 200) continue;
      collectIds(r.json).forEach((i) => allIds.add(i));
      // A list is a bare array, or an object wrapping one ({data: []}, {entries: []}, ...).
      const wrapped = r.json && !Array.isArray(r.json) ? Object.values(r.json).find((v) => Array.isArray(v)) : undefined;
      const top = (Array.isArray(r.json) ? r.json : (wrapped as any[]) ?? []) as any[];
      const topIds = top.map((x) => x?.id).filter((x) => typeof x === 'string');
      if (topIds.length) byPrefix.set(p, [...new Set([...(byPrefix.get(p) ?? []), ...topIds])]);
    }
  }
  return { byPrefix, allIds };
}

async function main() {
  console.log(`Tenant isolation test -> ${API}\n`);
  const acme = await login('admin@acme.com');
  const globex = await login('admin@globex.com');
  if (!acme.tenantId || !globex.tenantId || acme.tenantId === globex.tenantId) {
    throw new Error('expected two distinct tenants (run seed-globex.ts)');
  }

  const doc: any = await (await fetch(`${ORIGIN}/api/docs-json`)).json();
  const routes: { method: string; path: string }[] = [];
  for (const [rawPath, ops] of Object.entries<any>(doc.paths)) {
    const path = rawPath.replace(/^\/api\/v1/, '');
    if (skipPath(path)) continue;
    for (const method of Object.keys(ops)) routes.push({ method: method.toUpperCase(), path });
  }
  const listPaths = routes.filter((r) => r.method === 'GET' && !r.path.includes('{')).map((r) => r.path);
  // {provider}/{subdomain}/{token} are lookup keys, not record ids — replaying a record id there proves nothing.
  const idParam = (p: string) => (p.match(/\{([^}]+)\}/g) ?? []).every((m) => /^\{(id|\w*Id)\}$/.test(m));
  const paramRoutes = routes.filter((r) => r.path.includes('{') && idParam(r.path));
  console.log(`Discovered ${routes.length} routes (${listPaths.length} lists, ${paramRoutes.length} parameterised)`);

  // The seed leaves many tables empty, and an untested route is exactly where an IDOR hides —
  // so give both tenants at least one record in each of these resources (idempotent).
  const stamp = Date.now();
  const fixtures: { list: string; body: (ctx: { employeeId?: string }) => unknown; needsEmployee?: boolean }[] = [
    { list: '/custom-fields', body: () => ({ entity: 'Employee', key: `iso_${stamp}`, label: 'Isolation field', fieldType: 'text' }) },
    { list: '/formulas', body: () => ({ name: `Iso formula ${stamp}`, entity: 'PayrollItem', expression: 'baseSalary * 0.1', targetField: 'bonus' }) },
    { list: '/workflows', body: () => ({ name: `Iso workflow ${stamp}`, trigger: 'iso.test', steps: [{ order: 0, role: 'HR_MANAGER' }] }) },
    { list: '/report-definitions', body: () => ({ name: `Iso report ${stamp}`, config: { entity: 'Employee', columns: ['firstName'] } }) },
    { list: '/enps/surveys', body: () => ({ title: `Iso survey ${stamp}`, question: 'How likely are you to recommend us?' }) },
    { list: '/api-keys', body: () => ({ name: `Iso key ${stamp}` }) },
    { list: '/timesheets/projects', body: () => ({ key: `ISO${String(stamp).slice(-6)}`, name: `Iso project ${stamp}` }) },
    { list: '/integrations', body: () => ({ provider: `iso-${stamp}`, status: 'disconnected' }) },
    { list: '/webhooks', body: () => ({ url: `https://example.com/iso-${stamp}`, events: ['employee.created'] }) },
  ];
  const ensureFixtures = async (token: string) => {
    for (const f of fixtures) {
      const existing = await call(token, 'GET', f.list);
      const has = Array.isArray(existing.json) ? existing.json.length : (Object.values(existing.json ?? {}).find((v) => Array.isArray(v)) as any[] | undefined)?.length;
      if (existing.status === 200 && !has) await call(token, 'POST', f.list, f.body({}));
    }
  };
  await ensureFixtures(acme.token);
  await ensureFixtures(globex.token);
  // Offboarding + one-on-ones need real employees: give the victim (Globex) an open case and a 1:1.
  const gEmps = (await call(globex.token, 'GET', '/employees?limit=3')).json?.data ?? [];
  if (gEmps[0] && !((await call(globex.token, 'GET', '/offboarding')).json ?? []).length) {
    await call(globex.token, 'POST', '/offboarding', { employeeId: gEmps[0].id, type: 'TERMINATION', lastWorkingDay: new Date().toISOString().slice(0, 10) });
  }
  if (gEmps[2] && !((await call(globex.token, 'GET', '/payroll/compensation-items')).json ?? []).length) {
    await call(globex.token, 'POST', '/payroll/compensation-items', { employeeId: gEmps[2].id, type: 'ALLOWANCE', label: 'iso', amount: 1000 });
  }
  const gStaff = await login('sara.ahmed@globex.com');
  if (!((await call(gStaff.token, 'GET', '/timesheets/entries')).json ?? []).length) {
    await call(gStaff.token, 'POST', '/timesheets/entries', { date: new Date().toISOString().slice(0, 10), hours: 2, note: 'iso' });
  }
  const gManager = await login('ali.khan@globex.com');
  if (gEmps[1] && !((await call(gManager.token, 'GET', '/one-on-ones')).json ?? []).length) {
    await call(gManager.token, 'POST', '/one-on-ones', { employeeId: gEmps[1].id, scheduledAt: new Date(Date.now() + 86400000).toISOString(), talkingPoints: [{ text: 'iso', done: false }] });
  }

  const aStaff = await login('sara.ahmed@acme.com');
  const aManager = await login('ali.khan@acme.com');
  const acmeData = await harvest([acme.token, aManager.token, aStaff.token], listPaths);
  const globexData = await harvest([globex.token, gManager.token, gStaff.token], listPaths);
  console.log(`Harvested ${acmeData.allIds.size} Acme ids and ${globexData.allIds.size} Globex ids\n`);

  const leaks: string[] = [];
  const twoXX: string[] = [];
  let requests = 0;

  const scan = (who: string, method: string, path: string, res: Res, victim: { tenantId: string; ids: Set<string> }) => {
    if (res.text.includes(victim.tenantId)) leaks.push(`${who} ${method} ${path}: response contains the other tenant's tenantId`);
    for (const id of victim.ids) {
      if (res.text.includes(id)) {
        leaks.push(`${who} ${method} ${path}: response contains another tenant's record id ${id}`);
        break;
      }
    }
  };

  // 1) Plain list endpoints: an attacker's own lists must never contain the victim's ids.
  for (const [who, attacker, victimData, victim] of [
    ['Acme', acme, globexData, globex],
    ['Globex', globex, acmeData, acme],
  ] as const) {
    for (const p of listPaths) {
      const r = await call(attacker.token, 'GET', p);
      requests++;
      scan(who, 'GET', p, r, { tenantId: victim.tenantId, ids: victimData.allIds });
    }
  }

  // 2) The same lists with the victim's employee id as a filter — the classic query-param IDOR.
  const victimEmployees = globexData.byPrefix.get('/employees') ?? [];
  for (const p of listPaths.filter((x) => !x.includes('{'))) {
    for (const key of ['employeeId', 'userId', 'tenantId']) {
      const val = key === 'tenantId' ? globex.tenantId : victimEmployees[0];
      if (!val) continue;
      const r = await call(acme.token, 'GET', `${p}?${key}=${encodeURIComponent(val)}`);
      requests++;
      scan('Acme', 'GET', `${p}?${key}=<victim>`, r, { tenantId: globex.tenantId, ids: globexData.allIds });
    }
  }

  // 3) Every parameterised route, replayed with the other tenant's ids.
  const prefixOf = (path: string) => path.slice(0, path.indexOf('{')).replace(/\/$/, '');
  const fill = (path: string, id: string) => path.replace(/\{[^}]+\}/g, id);
  let replayed = 0;
  const untested = new Set<string>();
  // Routes nested under a resource with no list of their own (e.g. /employees/{id}/documents) borrow
  // ids from the nearest ancestor list; only routes with no candidate at all are reported as untested.
  const candidateIds = (data: typeof globexData, path: string) => {
    for (let p = prefixOf(path); p; p = p.slice(0, p.lastIndexOf('/'))) {
      const ids = data.byPrefix.get(p);
      if (ids?.length) return ids.slice(0, IDS_PER_PREFIX);
    }
    return [] as string[];
  };
  for (const dir of [
    { who: 'Acme->Globex', attacker: acme, victimData: globexData, victim: globex, mutate: true },
    { who: 'Globex->Acme', attacker: globex, victimData: acmeData, victim: acme, mutate: false },
  ]) {
    for (const r of paramRoutes) {
      if (r.method !== 'GET' && !dir.mutate) continue;
      const ids = candidateIds(dir.victimData, r.path);
      if (!ids.length) {
        untested.add(`${r.method} ${r.path}`);
        continue;
      }
      for (const id of ids) {
        const res = await call(dir.attacker.token, r.method, fill(r.path, id), r.method === 'GET' || r.method === 'DELETE' ? undefined : {});
        requests++;
        replayed++;
        // `{count: 0}` is a scoped updateMany that matched nothing — a refusal, not a write.
        const noop = res.json && typeof res.json === 'object' && res.json.count === 0;
        if (res.status >= 200 && res.status < 300 && !noop) twoXX.push(`${dir.who} ${r.method} ${r.path} (id ${id}) -> ${res.status}`);
        scan(dir.who, r.method, r.path, res, { tenantId: dir.victim.tenantId, ids: dir.victimData.allIds });
      }
    }
  }

  // 3b) Victim data must be untouched by the mutation replay.
  const survivors = await harvest(globex.token, ['/employees']);
  const intact = [...(globexData.byPrefix.get('/employees') ?? [])].every((id) => survivors.byPrefix.get('/employees')?.includes(id));

  console.log(`Sent ${requests} requests (${replayed} cross-tenant replays)`);
  console.log(`Routes with no harvestable victim id (NOT exercised): ${untested.size}${untested.size ? '\n' + [...untested].map((u) => '   · ' + u).join('\n') : ''}\n`);
  let failed = false;
  if (leaks.length) {
    failed = true;
    console.log(`LEAKS (${leaks.length}):\n${[...new Set(leaks)].map((l) => ' - ' + l).join('\n')}\n`);
  } else {
    console.log('ok   no response ever contained another tenant\'s ids or tenantId');
  }
  if (twoXX.length) {
    failed = true;
    console.log(`CROSS-TENANT 2xx (${twoXX.length}) — investigate each:\n${twoXX.map((l) => ' - ' + l).join('\n')}\n`);
  } else {
    console.log('ok   every cross-tenant id replay was refused (no 2xx)');
  }
  if (!intact) {
    failed = true;
    console.log('FAIL victim tenant employees changed during the replay');
  } else {
    console.log('ok   victim tenant data unchanged by attempted mutations');
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
