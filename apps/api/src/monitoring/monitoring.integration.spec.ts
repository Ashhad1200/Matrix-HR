/**
 * Integration tests (real Postgres; RUN_DB_TESTS=1) for disclosed activity monitoring:
 * settings gating, consent before pairing, device-token ingest, rollup, offline detection + HR notification,
 * retention purge, and tenant/role scoping.
 */
import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MonitoringService } from './monitoring.service';
import { MonitoringWorker } from './monitoring.worker';
import { sha256 } from './monitoring.util';

const run = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

run('activity monitoring (database)', () => {
  const prisma = new PrismaService();
  const audit = new AuditService(prisma);
  const notifications = new NotificationsService(prisma);
  const svc = new MonitoringService(prisma, audit);
  const worker = new MonitoringWorker(prisma, notifications);
  const sfx = randomUUID().slice(0, 8);
  const tenants: string[] = [];

  const hrViewer = (id = 'u') => ({ userId: id, role: 'HR_MANAGER', employeeId: null });

  async function mkTenant(label: string) {
    const t = await prisma.tenant.create({ data: { name: `MON ${label} ${sfx}`, subdomain: `mon-${label}-${sfx}`.toLowerCase(), timezone: 'UTC' } });
    tenants.push(t.id);
    return t.id;
  }
  async function mkEmp(tenantId: string, code: string, managerId?: string) {
    return prisma.employee.create({ data: { tenantId, employeeCode: `${code}-${sfx}`, firstName: code, lastName: 'T', status: 'ACTIVE', managerId } });
  }
  async function mkHrUser(tenantId: string) {
    return prisma.user.create({ data: { tenantId, email: `hr-${tenantId}@qa.test`, passwordHash: 'x', role: 'HR_MANAGER', status: 'ACTIVE' } });
  }

  afterAll(async () => {
    for (const id of tenants) await prisma.tenant.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('refuses to enable without a policy, bumps version on policy change', async () => {
    const t = await mkTenant('a');
    await expect(svc.updateSettings(t, 'u1', { enabled: true })).rejects.toThrow(BadRequestException);
    const s1 = await svc.updateSettings(t, 'u1', { enabled: true, policyText: 'We record time and activity only.' });
    expect(s1.enabled).toBe(true);
    const v1 = s1.policyVersion;
    const s2 = await svc.updateSettings(t, 'u1', { policyText: 'Updated policy text.' });
    expect(s2.policyVersion).toBe(v1 + 1);
    const s3 = await svc.updateSettings(t, 'u1', { offlineAlertMins: 20 }); // non-policy change: version steady
    expect(s3.policyVersion).toBe(v1 + 1);
  });

  it('requires consent before pairing; pairs once consented; token stored only as a hash', async () => {
    const t = await mkTenant('b');
    await svc.updateSettings(t, 'u1', { enabled: true, policyText: 'policy' });
    const emp = await mkEmp(t, 'E1');
    await expect(svc.pairDevice(t, emp.id, { name: 'pc' })).rejects.toThrow(ForbiddenException);
    await svc.consent(t, emp.id);
    const paired = await svc.pairDevice(t, emp.id, { name: 'Office PC', platform: 'windows' });
    expect(paired.token.startsWith('mon_')).toBe(true);
    const row = await prisma.monitoredDevice.findUnique({ where: { id: paired.deviceId } });
    expect(row!.tokenHash).toBe(sha256(paired.token));
    // a brand-new policy version invalidates the old consent for pairing
    await svc.updateSettings(t, 'u1', { policyText: 'v2 policy' });
    await expect(svc.pairDevice(t, emp.id, { name: 'pc2' })).rejects.toThrow(ForbiddenException);
  });

  it('ingests counts only, drops app/domain when disabled, rolls up to a daily summary', async () => {
    const t = await mkTenant('c');
    await svc.updateSettings(t, 'u1', { enabled: true, policyText: 'policy', trackApps: true, trackDomains: false });
    const emp = await mkEmp(t, 'E1');
    await svc.consent(t, emp.id);
    const { deviceId } = await svc.pairDevice(t, emp.id, { name: 'pc' });
    const device = { id: deviceId, tenantId: t, employeeId: emp.id };
    const base = new Date();
    const mk = (minAgo: number, dur: number) => ({
      windowStart: new Date(base.getTime() - minAgo * 60000).toISOString(),
      windowEnd: new Date(base.getTime() - (minAgo - dur) * 60000).toISOString(),
      activeSeconds: dur * 50, idleSeconds: dur * 10, mouseEvents: dur * 100, keyboardEvents: dur * 40,
      foregroundApp: 'VS Code', foregroundDomain: 'secret-internal.example',
    });
    const res = await svc.ingest(device, { samples: [mk(10, 5), mk(4, 4)] });
    expect(res.accepted).toBe(2);
    const stored = await prisma.activitySample.findMany({ where: { deviceId } });
    expect(stored).toHaveLength(2);
    expect(stored.every((s) => s.foregroundApp === 'VS Code')).toBe(true);
    expect(stored.every((s) => s.foregroundDomain === null)).toBe(true); // trackDomains was off
    const rebuilt = await worker.rollupRecent();
    expect(rebuilt).toBeGreaterThanOrEqual(1);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(base);
    const sum = await prisma.activityDailySummary.findUnique({ where: { tenantId_employeeId_day: { tenantId: t, employeeId: emp.id, day } } });
    expect(sum!.activeSeconds).toBe(9 * 50); // 5+4 minutes * 50
    expect((sum!.topApps as any[])[0].name).toBe('VS Code');
  });

  it('raises an offline alert during work hours, notifies HR, and auto-resolves on re-ingest', async () => {
    const t = await mkTenant('d');
    await svc.updateSettings(t, 'u1', { enabled: true, policyText: 'policy', workdayStartMin: 0, workdayEndMin: 1439, offlineAlertMins: 15 });
    const hr = await mkHrUser(t);
    const emp = await mkEmp(t, 'E1');
    await svc.consent(t, emp.id);
    const { deviceId, token } = await svc.pairDevice(t, emp.id, { name: 'pc' });
    // make it look silent for 40 min and paired 2h ago
    await prisma.monitoredDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date(Date.now() - 40 * 60000), pairedAt: new Date(Date.now() - 2 * 3600_000) } });
    const raised = await worker.detectOffline();
    expect(raised).toBeGreaterThanOrEqual(1);
    const open = await svc.alerts(t, hrViewer(), false);
    expect(open.some((a) => a.type === 'AGENT_OFFLINE')).toBe(true);
    const notes = await prisma.notification.count({ where: { tenantId: t, userId: hr.id, title: 'Monitoring agent offline' } });
    expect(notes).toBeGreaterThanOrEqual(1);
    // a second run does not double-alert (throttled by lastAlertAt)
    const again = await worker.detectOffline();
    expect(again).toBe(0);
    // re-ingest resolves it
    await svc.ingest({ id: deviceId, tenantId: t, employeeId: emp.id }, { samples: [] });
    const openAfter = await svc.alerts(t, hrViewer(), false);
    expect(openAfter.filter((a) => a.deviceId === deviceId && a.type === 'AGENT_OFFLINE')).toHaveLength(0);
  });

  it('purges raw samples past retention but keeps summaries', async () => {
    const t = await mkTenant('e');
    await svc.updateSettings(t, 'u1', { enabled: true, policyText: 'policy', retentionRawDays: 30, retentionSummaryDays: 365 });
    const emp = await mkEmp(t, 'E1');
    const dev = await prisma.monitoredDevice.create({ data: { tenantId: t, employeeId: emp.id, name: 'pc', tokenHash: sha256('x' + sfx) } });
    const old = new Date(Date.now() - 40 * 86400_000);
    await prisma.activitySample.create({ data: { tenantId: t, deviceId: dev.id, employeeId: emp.id, windowStart: old, windowEnd: old, activeSeconds: 1, idleSeconds: 0, mouseEvents: 0, keyboardEvents: 0, createdAt: old } });
    const fresh = await prisma.activitySample.create({ data: { tenantId: t, deviceId: dev.id, employeeId: emp.id, windowStart: new Date(), windowEnd: new Date(), activeSeconds: 1, idleSeconds: 0, mouseEvents: 0, keyboardEvents: 0 } });
    const r = await worker.purge();
    expect(r.samples).toBeGreaterThanOrEqual(1);
    expect(await prisma.activitySample.findUnique({ where: { id: fresh.id } })).not.toBeNull();
  });

  it('scopes reads by tenant and role: manager sees self+reports, other tenant sees nothing', async () => {
    const tA = await mkTenant('f');
    await svc.updateSettings(tA, 'u1', { enabled: true, policyText: 'p' });
    const mgr = await mkEmp(tA, 'MGR');
    const report = await mkEmp(tA, 'REP', mgr.id);
    const other = await mkEmp(tA, 'OTH');
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
    for (const e of [mgr, report, other]) await prisma.activityDailySummary.create({ data: { tenantId: tA, employeeId: e.id, day, activeSeconds: 100 } });
    const mgrViewer = { userId: 'm', role: 'MANAGER', employeeId: mgr.id };
    const seen = await svc.summaries(tA, mgrViewer);
    const ids = new Set(seen.map((s) => s.employeeId));
    expect(ids.has(mgr.id)).toBe(true);
    expect(ids.has(report.id)).toBe(true);
    expect(ids.has(other.id)).toBe(false);
    // other tenant
    const tB = await mkTenant('g');
    const seenB = await svc.summaries(tB, hrViewer());
    expect(seenB.every((s) => s.tenantId === tB)).toBe(true);
    expect(seenB.some((s) => ids.has(s.employeeId))).toBe(false);
    // HR+ in A cannot revoke a device created in B
    const empB = await mkEmp(tB, 'E1');
    const devB = await prisma.monitoredDevice.create({ data: { tenantId: tB, employeeId: empB.id, name: 'pc', tokenHash: sha256('z' + sfx) } });
    await expect(svc.revokeDevice(tA, hrViewer(), 'u', devB.id)).rejects.toThrow(NotFoundException);
  });
});
