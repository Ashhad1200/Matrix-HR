/** Departments & designations, per-employee pay components (audited), and the per-client logo upload. */
import { test, expect } from '@playwright/test';
import { accounts, api, API } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;
// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function upload(who: 'superadmin' | 'admin', id: string, bytes: Buffer, type: string, name: string) {
  const token = accounts().users[who].token;
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  const r = await fetch(`${API}/platform/tenants/${id}/logo`, { method: 'PUT', headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test.describe('Departments', () => {
  test('create, rename, nest, import, delete refused while in use, audited, isolated', async () => {
    const a = await api('hr', '/employees/departments', 'POST', { name: `${tag} Ops` });
    expect(a.status, JSON.stringify(a.body)).toBeLessThan(300);
    expect((await api('hr', '/employees/departments', 'POST', { name: `${tag} ops` })).status, 'duplicate name, any case').toBe(409);
    expect((await api('hr', '/employees/departments', 'POST', { name: '' })).status).toBe(400);
    expect((await api('employee', '/employees/departments', 'POST', { name: 'x' })).status).toBe(403);
    const b = await api('hr', '/employees/departments', 'POST', { name: `${tag} Ops East`, parentId: a.body.id });
    expect(b.status).toBeLessThan(300);
    expect((await api('hr', `/employees/departments/${a.body.id}`, 'PATCH', { parentId: b.body.id })).status, 'a department cannot sit under its own child').toBe(400);
    expect((await api('hr', `/employees/departments/${a.body.id}`, 'PATCH', { name: `${tag} Operations` })).status).toBe(200);
    expect((await api('adminB', `/employees/departments/${a.body.id}`, 'PATCH', { name: 'hijack' })).status).toBe(404);
    expect((await api('adminB', `/employees/departments/${a.body.id}`, 'DELETE')).status).toBe(404);
    expect((await api('adminB', '/employees/departments')).body.map((d: any) => d.id)).not.toContain(a.body.id);
    // foreign parent id is refused
    const foreign = await api('adminB', '/employees/departments', 'POST', { name: `${tag} B-only` });
    expect((await api('hr', '/employees/departments', 'POST', { name: `${tag} X`, parentId: foreign.body.id })).status).toBeGreaterThanOrEqual(400);

    // in use by sub-department
    const refused = await api('hr', `/employees/departments/${a.body.id}`, 'DELETE');
    expect(refused.status).toBe(409);
    expect(JSON.stringify(refused.body)).toMatch(/sub-department|Ops East/i);
    // in use by an employee
    const empId = accounts().users.employee2.employeeId;
    const before = (await api('hr', `/employees/${empId}`)).body.departmentId ?? null;
    expect((await api('hr', `/employees/${empId}`, 'PATCH', { departmentId: b.body.id })).status).toBe(200);
    expect((await api('hr', `/employees/departments/${b.body.id}`, 'DELETE')).status, 'employee still assigned').toBe(409);
    await api('hr', `/employees/${empId}`, 'PATCH', { departmentId: before });
    expect((await api('hr', `/employees/departments/${b.body.id}`, 'DELETE')).status).toBe(200);
    expect((await api('hr', `/employees/departments/${a.body.id}`, 'DELETE')).status).toBe(200);

    // import
    const imp = await api('hr', '/employees/departments/import', 'POST', { rows: [{ name: `${tag} Imp A` }, { name: `${tag} Imp B`, parent: `${tag} Imp A` }, { name: `${tag} Imp C`, parent: 'No such parent' }, { name: `${tag} imp a` }] });
    expect(imp.status, JSON.stringify(imp.body)).toBeLessThan(300);
    expect(imp.body.created).toBe(2); expect(imp.body.skipped).toBe(1); expect(imp.body.errors).toHaveLength(1);
    expect((await api('hr', '/employees/departments/import', 'POST', { rows: [] })).status).toBe(400);
    expect((await api('employee', '/employees/departments/import', 'POST', { rows: [{ name: 'x' }] })).status).toBe(403);

    const log = await api('hr', '/audit/logs?entity=Department&limit=200');
    const actions = log.body.map((l: any) => l.action);
    for (const act of ['CREATE', 'UPDATE', 'DELETE', 'IMPORT']) expect(actions, `audit has ${act}`).toContain(act);
    for (const d of (await api('hr', '/employees/departments')).body.filter((d: any) => d.name.startsWith(`${tag} Imp`))) await api('hr', `/employees/departments/${d.id}`, 'DELETE');
  });
});

test.describe('Designations', () => {
  test('create, edit, import, delete refused while held, isolated', async () => {
    const g = await api('hr', '/employees/designations', 'POST', { name: `${tag} Analyst`, grade: 'G2' });
    expect(g.status, JSON.stringify(g.body)).toBeLessThan(300);
    expect((await api('hr', '/employees/designations', 'POST', { name: `${tag} analyst` })).status).toBe(409);
    expect((await api('hr', `/employees/designations/${g.body.id}`, 'PATCH', { name: `${tag} Senior Analyst`, grade: null })).status).toBe(200);
    expect((await api('employee', `/employees/designations/${g.body.id}`, 'PATCH', { name: 'x' })).status).toBe(403);
    expect((await api('adminB', `/employees/designations/${g.body.id}`, 'PATCH', { name: 'x' })).status).toBe(404);
    const empId = accounts().users.employee2.employeeId;
    const before = (await api('hr', `/employees/${empId}`)).body.designationId ?? null;
    expect((await api('hr', `/employees/${empId}`, 'PATCH', { designationId: g.body.id })).status).toBe(200);
    const refused = await api('hr', `/employees/designations/${g.body.id}`, 'DELETE');
    expect(refused.status).toBe(409);
    expect(JSON.stringify(refused.body)).toMatch(/employee/i);
    await api('hr', `/employees/${empId}`, 'PATCH', { designationId: before });
    expect((await api('hr', `/employees/designations/${g.body.id}`, 'DELETE')).status).toBe(200);
    const imp = await api('hr', '/employees/designations/import', 'POST', { rows: [{ name: `${tag} Imp T1`, grade: 'G1' }, { name: `${tag} Imp T2` }, { name: `${tag} Imp T1` }] });
    expect(imp.body.created).toBe(2); expect(imp.body.skipped).toBe(1);
    for (const d of (await api('hr', '/employees/designations')).body.filter((d: any) => d.name.startsWith(`${tag} Imp`))) await api('hr', `/employees/designations/${d.id}`, 'DELETE');
  });
});

test.describe('Pay components (compensation items)', () => {
  test('recurring and one-off, edit, delete, validation, audit, isolation, payroll still consumes them', async () => {
    const emp = accounts().users.employee.employeeId;
    const rec = await api('hr', '/payroll/compensation-items', 'POST', { employeeId: emp, type: 'ALLOWANCE', label: `${tag} Fuel`, amount: 5000, recurring: true, startPeriod: '2031-01', endPeriod: '2031-06' });
    expect(rec.status, JSON.stringify(rec.body)).toBeLessThan(300);
    const once = await api('hr', '/payroll/compensation-items', 'POST', { employeeId: emp, type: 'BONUS', label: `${tag} Eid`, amount: 20000, recurring: false, startPeriod: '2031-03' });
    expect(once.status).toBeLessThan(300);
    expect((await api('hr', '/payroll/compensation-items', 'POST', { employeeId: emp, type: 'ALLOWANCE', label: 'x', amount: 1, startPeriod: '2031-13' })).status, 'bad month').toBe(400);
    expect((await api('hr', '/payroll/compensation-items', 'POST', { employeeId: emp, type: 'ALLOWANCE', label: 'x', amount: 1, startPeriod: '2031-05', endPeriod: '2031-02' })).status, 'end before start').toBe(400);
    expect((await api('hr', '/payroll/compensation-items', 'POST', { employeeId: emp, type: 'NOPE', label: 'x', amount: 1 })).status).toBe(400);
    expect((await api('hr', '/payroll/compensation-items', 'POST', { employeeId: accounts().users.employeeB.employeeId, type: 'BONUS', label: 'x', amount: 1 })).status, 'foreign employee').toBe(404);
    expect((await api('employee', '/payroll/compensation-items', 'POST', { employeeId: emp, type: 'BONUS', label: 'x', amount: 1 })).status).toBe(403);
    expect((await api('manager', `/payroll/compensation-items?employeeId=${emp}`)).status).toBe(403);

    const upd = await api('hr', `/payroll/compensation-items/${rec.body.id}`, 'PATCH', { amount: 6500, endPeriod: '2031-09', label: `${tag} Fuel v2` });
    expect(upd.status, JSON.stringify(upd.body)).toBe(200);
    expect(Number(upd.body.amount)).toBe(6500); expect(upd.body.endPeriod).toBe('2031-09');
    expect((await api('hr', `/payroll/compensation-items/${rec.body.id}`, 'PATCH', { startPeriod: '2032-01' })).status, 'start after existing end').toBe(400);
    expect((await api('adminB', `/payroll/compensation-items/${rec.body.id}`, 'PATCH', { amount: 1 })).status).toBe(404);
    expect((await api('adminB', `/payroll/compensation-items/${rec.body.id}`, 'DELETE')).status).toBe(404);
    expect((await api('adminB', `/payroll/compensation-items?employeeId=${emp}`)).body.filter((i: any) => i.employeeId === emp)).toHaveLength(0);

    const list = (await api('hr', `/payroll/compensation-items?employeeId=${emp}`)).body;
    expect(list.map((i: any) => i.id)).toEqual(expect.arrayContaining([rec.body.id, once.body.id]));

    const log = (await api('hr', '/audit/logs?entity=CompensationItem&limit=200')).body;
    const mine = log.filter((l: any) => [rec.body.id, once.body.id].includes(l.entityId));
    expect(mine.map((l: any) => l.action)).toEqual(expect.arrayContaining(['CREATE', 'UPDATE']));
    const upLog = mine.find((l: any) => l.action === 'UPDATE');
    expect(JSON.stringify(upLog.before)).toContain('5000'); expect(JSON.stringify(upLog.after)).toContain('6500');

    expect((await api('hr', `/payroll/compensation-items/${rec.body.id}`, 'DELETE')).status).toBe(200);
    expect((await api('hr', `/payroll/compensation-items/${once.body.id}`, 'DELETE')).status).toBe(200);
    const after = (await api('hr', '/audit/logs?entity=CompensationItem&limit=200')).body;
    expect(after.some((l: any) => l.action === 'DELETE' && l.entityId === rec.body.id)).toBe(true);
  });
});

test.describe('Per-client logo (backoffice)', () => {
  test('upload, validate by bytes, replace, clear, isolated, operator only, audited', async () => {
    const tenantA = accounts().tenants?.A?.id ?? (await api('admin', '/auth/me')).body.tenantId;
    const tenantB = (await api('adminB', '/auth/me')).body.tenantId;
    expect((await upload('admin', tenantA, PNG, 'image/png', 'l.png')).status, 'company admin cannot set the client logo').toBe(403);
    expect((await upload('superadmin', tenantA, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'), 'image/svg+xml', 'l.svg')).status).toBe(400);
    expect((await upload('superadmin', tenantA, Buffer.from('GIF89a not really'), 'image/png', 'l.png')).status, 'declared type is ignored').toBe(400);
    expect((await upload('superadmin', tenantA, Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(300 * 1024)]), 'image/png', 'big.png')).status, 'over 256 KB').toBeGreaterThanOrEqual(400);
    expect((await upload('superadmin', 'zz-nonexistent', PNG, 'image/png', 'l.png')).status).toBe(404);

    const ok = await upload('superadmin', tenantA, PNG, 'image/png', 'l.png');
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.logoUrl).toMatch(/^data:image\/png;base64,/);
    expect((await api('admin', '/auth/me')).body.tenant.logoUrl).toBe(ok.body.logoUrl);
    expect((await api('employee', '/auth/me')).body.tenant.logoUrl, 'every user of that company sees it').toBe(ok.body.logoUrl);
    expect((await api('adminB', '/auth/me')).body.tenant.logoUrl ?? null, 'other companies unaffected').not.toBe(ok.body.logoUrl);
    expect((await api('superadmin', `/platform/tenants/${tenantB}`)).body.logoUrl ?? null).not.toBe(ok.body.logoUrl);

    expect((await api('admin', `/platform/tenants/${tenantA}/logo`, 'DELETE')).status).toBe(403);
    expect((await api('superadmin', `/platform/tenants/${tenantA}/logo`, 'DELETE')).status).toBe(200);
    expect((await api('admin', '/auth/me')).body.tenant.logoUrl ?? null).toBeNull();
    const audit = (await api('superadmin', '/platform/audit?limit=100')).body;
    expect(audit.map((a: any) => a.action)).toEqual(expect.arrayContaining(['TENANT_LOGO_SET', 'TENANT_LOGO_CLEARED']));
  });
});
