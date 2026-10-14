/**
 * Disclosed activity monitoring: settings gating + policy versioning, consent-before-pairing, device-token ingest
 * (counts only), rollup, HR/manager scoping, tenant isolation, offline alert + auto-resolve.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { accounts, api, API } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const iso = (minFromNow: number) => new Date(Date.now() + minFromNow * 60000).toISOString();
const psql = (q: string) => execFileSync('psql', ['-h', process.env.PGHOST || '127.0.0.1', '-p', process.env.PGPORT || '5433', '-U', process.env.PGUSER || 'matrixhr', '-d', process.env.PGDATABASE || 'matrixhr', '-tAqc', q],
  { env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'matrixhr' } }).toString().trim();

async function ingest(token: string, samples: any[], agentVersion?: string) {
  const r = await fetch(`${API}/activity/ingest`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-device-token': token }, body: JSON.stringify({ agentVersion, samples }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test.describe('Monitoring settings & RBAC', () => {
  test('only HR/admin manage settings; policy required to enable; version bumps on change', async () => {
    expect((await api('employee', '/monitoring/settings')).status).toBe(403);
    expect((await api('manager', '/monitoring/settings')).status).toBe(403);
    expect((await api('employee', '/monitoring/settings', 'PUT', { enabled: true })).status).toBe(403);
    expect((await api('admin', '/monitoring/settings', 'PUT', { enabled: true })).status, 'no policy').toBe(400);
    const on = await api('admin', '/monitoring/settings', 'PUT', { enabled: true, policyText: `${tag} policy: time and activity only, never content.` });
    expect(on.status).toBeLessThan(300);
    const v = on.body.policyVersion;
    expect((await api('admin', '/monitoring/settings', 'PUT', { policyText: `${tag} policy v2` })).body.policyVersion).toBe(v + 1);
    expect((await api('admin', '/monitoring/settings', 'PUT', { offlineAlertMins: 20 })).body.policyVersion, 'non-policy change keeps version').toBe(v + 1);
  });
});

test.describe('Consent, pairing, ingest, rollup', () => {
  test('employee consents, pairs, agent ingests counts only, HR sees the summary', async () => {
    await api('admin', '/monitoring/settings', 'PUT', { enabled: true, policyText: `${tag} policy`, trackApps: true, trackDomains: false, workdayStartMin: 0, workdayEndMin: 1439 });
    // employee cannot pair before accepting the current policy
    expect((await api('employee', '/monitoring/me/devices', 'POST', { name: 'pc' })).status).toBe(403);
    expect((await api('employee', '/monitoring/me/consent', 'POST')).status).toBeLessThan(300);
    const paired = await api('employee', '/monitoring/me/devices', 'POST', { name: `${tag} laptop`, platform: 'windows' });
    expect(paired.status).toBeLessThan(300);
    const token: string = paired.body.token;
    expect(token.startsWith('mon_')).toBe(true);

    expect((await ingest('mon_bogus', [])).status, 'bad token').toBe(401);
    const res = await ingest(token, [{ windowStart: iso(-6), windowEnd: iso(-1), activeSeconds: 250, idleSeconds: 50, mouseEvents: 1200, keyboardEvents: 800, foregroundApp: 'VS Code', foregroundDomain: 'secret.example' }], '0.2.0');
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
    expect(res.body.accepted).toBe(1);

    const run = await api('admin', '/monitoring/run-maintenance', 'POST');
    expect(run.status).toBeLessThan(300);
    expect(run.body.rebuilt).toBeGreaterThanOrEqual(1);

    const emp = accounts().users.employee;
    const me = await api('employee', '/monitoring/me');
    expect(me.body.consented).toBe(true);
    expect(me.body.devices.some((d: any) => d.name === `${tag} laptop` && d.agentVersion === '0.2.0')).toBe(true);
    expect(me.body.today.activeSeconds).toBe(250);

    const ov = await api('admin', '/monitoring/overview');
    const mine = ov.body.summaries.find((s: any) => s.employeeId === emp.employeeId);
    expect(mine.activeSeconds).toBe(250);
    expect(ov.body.devices.some((d: any) => d.online === true)).toBe(true);
    // domain was dropped (trackDomains off); app kept
    const sample = psql(`select coalesce("foregroundDomain",'NULL'), "foregroundApp" from "ActivitySample" where "employeeId"='${emp.employeeId}' order by "createdAt" desc limit 1`);
    expect(sample).toContain('NULL');
    expect(sample).toContain('VS Code');
  });
});

test.describe('Isolation & offline alerts', () => {
  test('other tenant sees nothing; cross-tenant revoke 404', async () => {
    const ov = await api('adminB', '/monitoring/overview');
    expect(ov.body.devices.length).toBe(0);
    expect(ov.body.summaries.length).toBe(0);
    const aDevice = (await api('admin', '/monitoring/devices')).body[0];
    expect(aDevice).toBeTruthy();
    expect((await api('adminB', `/monitoring/devices/${aDevice.id}/revoke`, 'POST')).status).toBe(404);
  });

  test('a silent agent raises an offline alert to HR, and re-ingest clears it', async () => {
    // ensure tenant A is enabled all-day with a 15-min offline threshold
    await api('admin', '/monitoring/settings', 'PUT', { enabled: true, policyText: `${tag} policy`, workdayStartMin: 0, workdayEndMin: 1439, offlineAlertMins: 15 });
    const dev = (await api('admin', '/monitoring/devices')).body.find((d: any) => d.status === 'ACTIVE');
    expect(dev).toBeTruthy();
    const tenantId = accounts().tenantA;
    psql(`update "MonitoredDevice" set "lastSeenAt"=now()-interval '40 minutes', "pairedAt"=now()-interval '2 hours', "lastAlertAt"=null where id='${dev.id}'`);
    const run = await api('admin', '/monitoring/run-maintenance', 'POST');
    expect(run.body.raised).toBeGreaterThanOrEqual(1);
    const open = await api('admin', '/monitoring/alerts?resolved=false');
    const mine = open.body.find((a: any) => a.deviceId === dev.id && a.type === 'AGENT_OFFLINE');
    expect(mine, 'offline alert raised').toBeTruthy();
    // HR notification exists
    const notes = Number(psql(`select count(*) from "Notification" where "tenantId"='${tenantId}' and title='Monitoring agent offline'`));
    expect(notes).toBeGreaterThanOrEqual(1);
    // HR resolves it
    expect((await api('admin', `/monitoring/alerts/${mine.id}/resolve`, 'POST')).status).toBeLessThan(300);
    const after = await api('admin', '/monitoring/alerts?resolved=false');
    expect(after.body.find((a: any) => a.id === mine.id)).toBeUndefined();
  });
});
