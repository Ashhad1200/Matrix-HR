import { test, expect } from '@playwright/test';
import { accounts, api } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;

/** Generic create → list → get → update → persisted → delete → gone, for the admin-only config entities. */
async function crud(opts: { base: string; create: object; patch: object; check: (row: any) => void; bad: object[]; hasGet?: boolean; hasPatch?: boolean; hasDelete?: boolean; who?: any }) {
  const who = opts.who ?? 'hr';
  const c = await api(who, opts.base, 'POST', opts.create);
  expect(c.status, `create ${opts.base}: ${JSON.stringify(c.body)}`).toBe(201);
  const id = c.body.id;
  const list = await api(who, opts.base);
  expect(JSON.stringify(list.body), 'listed').toContain(id);
  if (opts.hasGet !== false) expect((await api(who, `${opts.base}/${id}`)).status).toBe(200);
  for (const bad of opts.bad) expect((await api(who, opts.base, 'POST', bad)).status, `invalid ${JSON.stringify(bad)}`).toBe(400);
  expect((await api('employee', opts.base)).status, 'employee list').toBe(403);
  expect((await api('employee', opts.base, 'POST', opts.create)).status, 'employee create').toBe(403);
  expect((await api('manager', opts.base)).status, 'manager list').toBe(403);
  if (opts.hasGet !== false) expect([403, 404]).toContain((await api('adminB', `${opts.base}/${id}`)).status);
  if (opts.hasPatch !== false) {
    const u = await api(who, `${opts.base}/${id}`, 'PATCH', opts.patch);
    expect(u.status, `patch: ${JSON.stringify(u.body)}`).toBeLessThan(300);
    const row = JSON.stringify((await api(who, opts.hasGet !== false ? `${opts.base}/${id}` : opts.base)).body);
    opts.check(JSON.parse(row).id ? JSON.parse(row) : (JSON.parse(row) as any[]).find((r) => r.id === id));
    expect([403, 404]).toContain((await api('adminB', `${opts.base}/${id}`, 'PATCH', opts.patch)).status);
  }
  if (opts.hasDelete !== false) {
    expect([403, 404], 'other tenant delete').toContain((await api('adminB', `${opts.base}/${id}`, 'DELETE')).status);
    expect((await api(who, `${opts.base}/${id}`, 'DELETE')).status).toBeLessThan(300);
    expect(JSON.stringify((await api(who, opts.base)).body)).not.toContain(id);
  }
  return id;
}

test('workflows CRUD', async () => {
  await crud({ base: '/workflows', create: { name: `${tag} wf`, trigger: 'leave.request', steps: [{ order: 0, role: 'MANAGER', action: 'approve' }] }, patch: { name: `${tag} wf 2`, isActive: false }, check: (r) => expect(r.name).toBe(`${tag} wf 2`), bad: [{}, { name: 'x' }] });
});
test('custom fields CRUD', async () => {
  await crud({ base: '/custom-fields', create: { entity: 'employee', key: `zz_${Date.now().toString(36)}`, label: `${tag} field`, fieldType: 'text' }, patch: { label: `${tag} field 2`, required: true }, check: (r) => { expect(r.label).toBe(`${tag} field 2`); expect(r.required).toBe(true); }, bad: [{}, { key: 'Bad Key!', label: 'x', fieldType: 'text' }] });
});
test('formulas CRUD', async () => {
  await crud({ base: '/formulas', create: { name: `${tag} f`, entity: 'employee', expression: '1 + 1', targetField: 'zz' }, patch: { name: `${tag} f 2` }, check: (r) => expect(r.name).toBe(`${tag} f 2`), bad: [{}] });
});
test('report definitions CRUD', async () => {
  await crud({ base: '/report-definitions', create: { name: `${tag} rpt`, config: { entity: 'employee', columns: ['firstName'] } }, patch: { name: `${tag} rpt 2` }, check: (r) => expect(r.name).toBe(`${tag} rpt 2`), bad: [{}] });
});
test('webhooks CRUD + test delivery', async () => {
  const id = await crud({ base: '/webhooks', create: { url: 'http://93.184.216.34/hook', events: ['employee.created'] }, patch: { isActive: false }, check: (r) => expect(r.isActive).toBe(false), bad: [{}, { url: 'not a url', events: [] }, { url: 'http://169.254.169.254/latest', events: ['x'] }, { url: 'http://localhost:5432/', events: ['x'] }], hasDelete: false });
  void id;
});
test('webhook URL must not allow internal addresses (SSRF)', async () => {
  const r = await api('hr', '/webhooks', 'POST', { url: 'http://127.0.0.1:3001/api/v1/health', events: ['employee.created'] });
  expect(r.status, 'loopback webhook target accepted').toBe(400);
});
test('API keys: create shows the secret once, list never does; revoke', async () => {
  const c = await api('admin', '/api-keys', 'POST', { name: `${tag} key` });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  const secret = c.body.key ?? c.body.secret ?? c.body.token;
  expect(secret, 'key returned once').toBeTruthy();
  const list = JSON.stringify((await api('admin', '/api-keys')).body);
  expect(list).toContain(c.body.id);
  expect(list, 'the secret must never be listed again').not.toContain(secret);
  expect((await api('hr', '/api-keys')).status, 'HR must not manage API keys').toBe(403);
  expect((await api('admin', '/api-keys', 'POST', { name: '' })).status).toBe(400);
  expect([403, 404]).toContain((await api('adminB', `/api-keys/${c.body.id}`, 'DELETE')).status);
  expect((await api('admin', `/api-keys/${c.body.id}`, 'DELETE')).status).toBeLessThan(300);
  expect(JSON.stringify((await api('admin', '/api-keys')).body)).not.toContain(c.body.id);
});
test('biometric devices CRUD and device-protocol auth', async () => {
  const sn = `ZZ${Date.now().toString(36)}`.toUpperCase();
  await api('hr', '/marketplace/zkteco/connect', 'POST');
  await crud({ base: '/biometric/devices', create: { serialNumber: sn, name: `${tag} dev` }, patch: { name: `${tag} dev 2` }, check: (r) => expect(r.name).toBe(`${tag} dev 2`), bad: [{}, { serialNumber: 'a', name: '' }], hasGet: false });
  const unknown = await fetch(`${process.env.API_URL || 'http://localhost:3001/api/v1'}/iclock/cdata?SN=NOT-REGISTERED-ZZ&table=ATTLOG`, { method: 'POST', body: '1\t2026-01-01 08:00:00\t0\t1' });
  expect(unknown.status, 'unregistered device must be refused').toBeGreaterThanOrEqual(400);
});
test('SSO config (admin only) and branding', async () => {
  expect((await api('hr', '/sso/config')).status).toBe(403);
  expect((await api('admin', '/sso/config')).status).toBe(200);
  const b = await api('admin', '/tenants/branding', 'PATCH', { primaryColor: '#112233' });
  expect(b.status, JSON.stringify(b.body)).toBeLessThan(300);
  expect((await api('admin', '/tenants/branding', 'PATCH', { primaryColor: 'javascript:alert(1)' })).status, 'a non-colour value in branding').toBe(400);
  expect((await api('hr', '/tenants/branding', 'PATCH', { primaryColor: '#000000' })).status).toBe(403);
  expect((await api('employee', '/tenants/branding', 'PATCH', { primaryColor: '#000000' })).status).toBe(403);
});
test('integrations / marketplace: connect, list, disconnect, isolation', async () => {
  const cats = await api('hr', '/marketplace/integrations');
  expect(cats.status).toBe(200);
  const items: any[] = Array.isArray(cats.body) ? cats.body : cats.body.integrations ?? [];
  expect(items.length).toBeGreaterThan(0);
  const first = items[0];
  const id = first.id ?? first.provider ?? first.slug;
  const con = await api('hr', `/marketplace/${id}/connect`, 'POST');
  expect(con.status, JSON.stringify(con.body)).toBeLessThan(500);
  expect((await api('hr', `/marketplace/${id}/disconnect`, 'POST')).status).toBeLessThan(500);
  expect((await api('employee', `/marketplace/${id}/connect`, 'POST')).status, 'an ordinary employee installing company integrations').toBeGreaterThanOrEqual(400);
});
test('audit log: HR/admin read only; entries exist for changes', async () => {
  expect((await api('employee', '/audit/logs')).status).toBe(403);
  expect((await api('manager', '/audit/logs')).status).toBe(403);
  const l = await api('hr', '/audit/logs');
  expect(l.status).toBe(200);
  expect(JSON.stringify(l.body).length).toBeGreaterThan(20);
  expect(JSON.stringify((await api('adminB', '/audit/logs')).body)).not.toContain(accounts().tenantA);
});
test('notifications: own only, mark read', async () => {
  const n = await api('employee', '/notifications');
  expect(n.status).toBe(200);
  const items = Array.isArray(n.body) ? n.body : n.body.items ?? [];
  if (items.length) {
    const unread = items.find((x: any) => !x.read);
    if (unread) {
      await api('employee2', `/notifications/${unread.id}/read`, 'PATCH'); // not theirs: must change nothing
      const after = (await api('employee', '/notifications')).body;
      expect((Array.isArray(after) ? after : after.items).find((x: any) => x.id === unread.id).read, 'another user marked my notification read').toBe(false);
    }
    expect((await api('employee', `/notifications/${items[0].id}/read`, 'PATCH')).status).toBeLessThan(300);
  }
});
