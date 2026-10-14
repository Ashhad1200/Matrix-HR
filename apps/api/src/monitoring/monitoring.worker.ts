import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { todayIn, minutesOfDayIn, inWorkWindow } from './monitoring-time';

/**
 * Three scheduled jobs, all safe to run repeatedly and directly callable from tests:
 *   rollupRecent  — fold raw samples into one daily summary per employee per local day
 *   detectOffline — raise an alert to HR when an agent goes silent during the work window (agent closed/uninstalled)
 *   purge         — delete raw samples past retentionRawDays and summaries past retentionSummaryDays
 */
@Injectable()
export class MonitoringWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.MONITORING_WORKER === 'off') return;
    this.timer = setInterval(() => this.tick().catch((e) => this.logger.error(`monitoring tick failed: ${e.message}`)), 5 * 60_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async tick(now = new Date()) {
    await this.rollupRecent(now);
    await this.detectOffline(now);
    await this.purge(now);
  }

  /** Rebuilds daily summaries for every (tenant, employee, day) that has raw samples in the recent window. */
  async rollupRecent(now = new Date(), lookbackDays = 2): Promise<number> {
    const since = new Date(now.getTime() - lookbackDays * 86_400_000);
    const tenants = await this.prisma.tenant.findMany({
      where: { activitySamples: { some: { windowStart: { gte: since } } } },
      select: { id: true, timezone: true },
    });
    let rebuilt = 0;
    for (const t of tenants) {
      const settings = await this.prisma.monitoringSettings.findUnique({ where: { tenantId: t.id } });
      const samples = await this.prisma.activitySample.findMany({
        where: { tenantId: t.id, windowStart: { gte: since } },
        select: { employeeId: true, windowStart: true, windowEnd: true, activeSeconds: true, idleSeconds: true,
          mouseEvents: true, keyboardEvents: true, foregroundApp: true },
      });
      // group by employee + local day
      const groups = new Map<string, typeof samples>();
      for (const s of samples) {
        const day = todayIn(t.timezone || 'Asia/Karachi', s.windowStart);
        const key = `${s.employeeId}|${day}`;
        (groups.get(key) ?? groups.set(key, []).get(key)!).push(s);
      }
      const workWindowSec = settings ? Math.max(0, (settings.workdayEndMin - settings.workdayStartMin)) * 60 : 9 * 3600;
      for (const [key, rows] of groups) {
        const [employeeId, day] = key.split('|');
        let active = 0, idle = 0, mouse = 0, kb = 0;
        let first: Date | null = null, last: Date | null = null;
        const appSec = new Map<string, number>();
        for (const r of rows) {
          active += r.activeSeconds; idle += r.idleSeconds; mouse += r.mouseEvents; kb += r.keyboardEvents;
          if (!first || r.windowStart < first) first = r.windowStart;
          if (!last || r.windowEnd > last) last = r.windowEnd;
          if (r.foregroundApp) appSec.set(r.foregroundApp, (appSec.get(r.foregroundApp) ?? 0) + r.activeSeconds);
        }
        const topApps = [...appSec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, seconds]) => ({ name, seconds }));
        const offline = Math.max(0, workWindowSec - (active + idle));
        await this.prisma.activityDailySummary.upsert({
          where: { tenantId_employeeId_day: { tenantId: t.id, employeeId, day } },
          update: { activeSeconds: active, idleSeconds: idle, offlineSeconds: offline, mouseEvents: mouse, keyboardEvents: kb,
            firstActivityAt: first, lastActivityAt: last, topApps },
          create: { tenantId: t.id, employeeId, day, activeSeconds: active, idleSeconds: idle, offlineSeconds: offline,
            mouseEvents: mouse, keyboardEvents: kb, firstActivityAt: first, lastActivityAt: last, topApps },
        });
        rebuilt++;
      }
    }
    return rebuilt;
  }

  /** Raises an AGENT_OFFLINE alert (once per silence) when a paired agent stops reporting during work hours. */
  async detectOffline(now = new Date()): Promise<number> {
    const tenants = await this.prisma.monitoringSettings.findMany({ where: { enabled: true }, select: { tenantId: true, offlineAlertMins: true, workdayStartMin: true, workdayEndMin: true } });
    let raised = 0;
    for (const s of tenants) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: s.tenantId }, select: { timezone: true, status: true } });
      if (!tenant || tenant.status !== 'ACTIVE') continue;
      const tz = tenant.timezone || 'Asia/Karachi';
      if (!inWorkWindow(minutesOfDayIn(tz, now), s.workdayStartMin, s.workdayEndMin)) continue;
      const staleBefore = new Date(now.getTime() - s.offlineAlertMins * 60_000);
      const devices = await this.prisma.monitoredDevice.findMany({
        where: { tenantId: s.tenantId, status: 'ACTIVE', pairedAt: { lt: staleBefore },
          OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: staleBefore } }],
          AND: [{ OR: [{ lastAlertAt: null }, { lastAlertAt: { lt: staleBefore } }] }] },
        select: { id: true, employeeId: true, name: true, lastSeenAt: true },
      });
      for (const d of devices) {
        const detail = d.lastSeenAt
          ? `Agent "${d.name}" stopped reporting. Last seen ${new Date(d.lastSeenAt).toISOString()}.`
          : `Agent "${d.name}" was installed but has never reported.`;
        await this.prisma.monitoringAlert.create({ data: { tenantId: s.tenantId, employeeId: d.employeeId, deviceId: d.id, type: 'AGENT_OFFLINE', detail } });
        await this.prisma.monitoredDevice.update({ where: { id: d.id }, data: { lastAlertAt: now } });
        // notify HR + admins
        const emp = await this.prisma.employee.findUnique({ where: { id: d.employeeId }, select: { firstName: true, lastName: true } });
        const hr = await this.prisma.user.findMany({ where: { tenantId: s.tenantId, role: { in: ['HR_MANAGER', 'COMPANY_ADMIN'] }, status: 'ACTIVE' }, select: { id: true } });
        for (const u of hr) {
          await this.notifications.create(s.tenantId, u.id, 'Monitoring agent offline',
            `${emp ? `${emp.firstName} ${emp.lastName}` : 'An employee'}'s agent stopped reporting during work hours.`, 'IN_APP', { deviceId: d.id, type: 'AGENT_OFFLINE' });
        }
        raised++;
      }
    }
    return raised;
  }

  async purge(now = new Date()): Promise<{ samples: number; summaries: number }> {
    const settings = await this.prisma.monitoringSettings.findMany({ select: { tenantId: true, retentionRawDays: true, retentionSummaryDays: true } });
    let samples = 0, summaries = 0;
    for (const s of settings) {
      const rawCut = new Date(now.getTime() - s.retentionRawDays * 86_400_000);
      const r = await this.prisma.activitySample.deleteMany({ where: { tenantId: s.tenantId, createdAt: { lt: rawCut } } });
      samples += r.count;
      const sumCut = todayIn('UTC', new Date(now.getTime() - s.retentionSummaryDays * 86_400_000));
      const r2 = await this.prisma.activityDailySummary.deleteMany({ where: { tenantId: s.tenantId, day: { lt: sumCut } } });
      summaries += r2.count;
    }
    return { samples, summaries };
  }
}
