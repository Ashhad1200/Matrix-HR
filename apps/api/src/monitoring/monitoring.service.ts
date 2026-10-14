import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { scopedEmployeeIds, employeeIdFilter, isHrPlus, type Viewer } from '../common/data-scope';
import { todayIn } from '../common/tenant-time';
import { newDeviceToken, classify } from './monitoring.util';
import { UpdateMonitoringSettingsDto, PairDeviceDto, IngestDto } from './dto';

const DEFAULTS = {
  enabled: false, policyText: '', policyVersion: 1, trackApps: true, trackDomains: true,
  workdayStartMin: 540, workdayEndMin: 1080, offlineAlertMins: 15, retentionRawDays: 30, retentionSummaryDays: 365,
};

@Injectable()
export class MonitoringService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ── Settings ──────────────────────────────────────────────────────────────
  async getSettings(tenantId: string) {
    const s = await this.prisma.monitoringSettings.findUnique({ where: { tenantId } });
    return s ?? { tenantId, ...DEFAULTS, updatedByUserId: null, updatedAt: null };
  }

  async updateSettings(tenantId: string, userId: string, dto: UpdateMonitoringSettingsDto) {
    const before = await this.prisma.monitoringSettings.findUnique({ where: { tenantId } });
    const start = dto.workdayStartMin ?? before?.workdayStartMin ?? DEFAULTS.workdayStartMin;
    const end = dto.workdayEndMin ?? before?.workdayEndMin ?? DEFAULTS.workdayEndMin;
    if (start === end) throw new BadRequestException('Work day start and end cannot be the same');
    // Editing the policy text re-prompts everyone: bump the version so old consents no longer count.
    const policyChanged = dto.policyText !== undefined && dto.policyText !== (before?.policyText ?? '');
    const nextVersion = (before?.policyVersion ?? DEFAULTS.policyVersion) + (policyChanged ? 1 : 0);
    if (dto.enabled && !(dto.policyText ?? before?.policyText)?.trim()) {
      throw new BadRequestException('Add a monitoring policy before turning monitoring on — employees must see what is collected.');
    }
    const data = {
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.policyText !== undefined ? { policyText: dto.policyText } : {}),
      policyVersion: nextVersion,
      ...(dto.trackApps !== undefined ? { trackApps: dto.trackApps } : {}),
      ...(dto.trackDomains !== undefined ? { trackDomains: dto.trackDomains } : {}),
      ...(dto.workdayStartMin !== undefined ? { workdayStartMin: dto.workdayStartMin } : {}),
      ...(dto.workdayEndMin !== undefined ? { workdayEndMin: dto.workdayEndMin } : {}),
      ...(dto.offlineAlertMins !== undefined ? { offlineAlertMins: dto.offlineAlertMins } : {}),
      ...(dto.retentionRawDays !== undefined ? { retentionRawDays: dto.retentionRawDays } : {}),
      ...(dto.retentionSummaryDays !== undefined ? { retentionSummaryDays: dto.retentionSummaryDays } : {}),
      updatedByUserId: userId,
    };
    const saved = await this.prisma.monitoringSettings.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...DEFAULTS, ...data, policyVersion: nextVersion },
    });
    await this.audit.log({ tenantId, userId, action: 'UPDATE', entity: 'MonitoringSettings', entityId: tenantId,
      before: before ? { enabled: before.enabled, policyVersion: before.policyVersion } : null,
      after: { enabled: saved.enabled, policyVersion: saved.policyVersion } });
    return saved;
  }

  // ── Employee self-service ──────────────────────────────────────────────────
  /** Everything the signed-in employee needs: policy, their consent state, their devices, and today's own summary. */
  async mySummary(tenantId: string, employeeId: string | null) {
    const settings = await this.getSettings(tenantId);
    if (!employeeId) return { enabled: settings.enabled, hasEmployeeProfile: false };
    const [consent, devices, tenant] = await Promise.all([
      this.prisma.monitoringConsent.findFirst({ where: { tenantId, employeeId, policyVersion: settings.policyVersion } }),
      this.prisma.monitoredDevice.findMany({ where: { tenantId, employeeId, status: 'ACTIVE' },
        select: { id: true, name: true, platform: true, agentVersion: true, pairedAt: true, lastSeenAt: true }, orderBy: { pairedAt: 'desc' } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }),
    ]);
    const today = await this.prisma.activityDailySummary.findUnique({
      where: { tenantId_employeeId_day: { tenantId, employeeId, day: todayIn(tenant?.timezone || 'Asia/Karachi') } },
    });
    return {
      enabled: settings.enabled, hasEmployeeProfile: true,
      policyVersion: settings.policyVersion, policyText: settings.policyText,
      consented: !!consent, consentedAt: consent?.acceptedAt ?? null,
      trackApps: settings.trackApps, trackDomains: settings.trackDomains,
      devices, today,
    };
  }

  async consent(tenantId: string, employeeId: string | null, ipAddress?: string) {
    if (!employeeId) throw new BadRequestException('Your login is not linked to an employee profile');
    const settings = await this.getSettings(tenantId);
    if (!settings.enabled) throw new BadRequestException('Monitoring is not turned on for your company');
    await this.prisma.monitoringConsent.upsert({
      where: { tenantId_employeeId_policyVersion: { tenantId, employeeId, policyVersion: settings.policyVersion } },
      update: { acceptedAt: new Date(), ipAddress },
      create: { tenantId, employeeId, policyVersion: settings.policyVersion, ipAddress },
    });
    await this.audit.log({ tenantId, userId: undefined, action: 'MONITORING_CONSENT', entity: 'Employee', entityId: employeeId,
      after: { policyVersion: settings.policyVersion } });
    return { consented: true, policyVersion: settings.policyVersion };
  }

  /** Pairs a new agent. Requires monitoring ON and a consent for the current policy version. Returns the token ONCE. */
  async pairDevice(tenantId: string, employeeId: string | null, dto: PairDeviceDto) {
    if (!employeeId) throw new BadRequestException('Your login is not linked to an employee profile');
    const settings = await this.getSettings(tenantId);
    if (!settings.enabled) throw new BadRequestException('Monitoring is not turned on for your company');
    const consent = await this.prisma.monitoringConsent.findFirst({ where: { tenantId, employeeId, policyVersion: settings.policyVersion } });
    if (!consent) throw new ForbiddenException('Accept the monitoring policy before installing the agent');
    const { token, hash } = newDeviceToken();
    const device = await this.prisma.monitoredDevice.create({
      data: { tenantId, employeeId, name: dto.name.trim(), platform: dto.platform, agentVersion: dto.agentVersion, tokenHash: hash },
    });
    await this.audit.log({ tenantId, userId: undefined, action: 'MONITORING_DEVICE_PAIRED', entity: 'MonitoredDevice', entityId: device.id,
      after: { employeeId, name: device.name } });
    // token is returned exactly once; only its hash is stored
    return { deviceId: device.id, token, name: device.name };
  }

  async myActivity(tenantId: string, employeeId: string | null, from?: string, to?: string) {
    if (!employeeId) return [];
    return this.prisma.activityDailySummary.findMany({
      where: { tenantId, employeeId, ...(from || to ? { day: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
      orderBy: { day: 'desc' }, take: 120,
    });
  }

  /** An employee may remove their own device; HR/managers use revokeDevice (scoped) instead. */
  async removeOwnDevice(tenantId: string, employeeId: string | null, deviceId: string) {
    if (!employeeId) throw new NotFoundException('Device not found');
    const device = await this.prisma.monitoredDevice.findFirst({ where: { id: deviceId, tenantId, employeeId } });
    if (!device) throw new NotFoundException('Device not found');
    await this.prisma.monitoredDevice.update({ where: { id: deviceId }, data: { status: 'REVOKED', revokedAt: new Date() } });
    return { removed: true };
  }

  // ── Agent ingest (device token) ─────────────────────────────────────────────
  async ingest(device: { id: string; tenantId: string; employeeId: string }, dto: IngestDto) {
    const settings = await this.getSettings(device.tenantId);
    if (!settings.enabled) throw new ForbiddenException('Monitoring is turned off');
    const now = new Date();
    if (dto.samples.length) {
      await this.prisma.activitySample.createMany({
        data: dto.samples.map((s) => {
          const ws = new Date(s.windowStart), we = new Date(s.windowEnd);
          if (isNaN(ws.getTime()) || isNaN(we.getTime()) || we < ws) throw new BadRequestException('Invalid sample window');
          return {
            tenantId: device.tenantId, deviceId: device.id, employeeId: device.employeeId,
            windowStart: ws, windowEnd: we, activeSeconds: s.activeSeconds, idleSeconds: s.idleSeconds,
            mouseEvents: s.mouseEvents, keyboardEvents: s.keyboardEvents,
            foregroundApp: settings.trackApps ? s.foregroundApp ?? null : null,
            foregroundDomain: settings.trackDomains ? s.foregroundDomain ?? null : null,
            category: classify(settings.trackApps ? s.foregroundApp : null, settings.trackDomains ? s.foregroundDomain : null),
          };
        }),
      });
    }
    await this.prisma.monitoredDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: now, ...(dto.agentVersion ? { agentVersion: dto.agentVersion } : {}), lastAlertAt: null },
    });
    // The agent is clearly alive again: resolve any open offline/stopped alert for it.
    await this.prisma.monitoringAlert.updateMany({
      where: { tenantId: device.tenantId, deviceId: device.id, resolvedAt: null, type: { in: ['AGENT_OFFLINE', 'AGENT_STOPPED'] } },
      data: { resolvedAt: now },
    });
    return { accepted: dto.samples.length };
  }

  // ── HR / manager read views (scoped) ────────────────────────────────────────
  private async scope(tenantId: string, viewer: Viewer) {
    return scopedEmployeeIds(this.prisma, tenantId, viewer);
  }

  async overview(tenantId: string, viewer: Viewer) {
    const [settings, tenant] = await Promise.all([
      this.getSettings(tenantId),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }),
    ]);
    const allowed = await this.scope(tenantId, viewer);
    const empFilter = allowed === null ? {} : { employeeId: { in: allowed } };
    const day = todayIn(tenant?.timezone || 'Asia/Karachi');
    const [summaries, devices, openAlerts] = await Promise.all([
      this.prisma.activityDailySummary.findMany({ where: { tenantId, day, ...empFilter },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } } }),
      this.prisma.monitoredDevice.findMany({ where: { tenantId, status: 'ACTIVE', ...empFilter },
        select: { id: true, employeeId: true, name: true, platform: true, lastSeenAt: true, agentVersion: true,
          employee: { select: { firstName: true, lastName: true } } } }),
      this.prisma.monitoringAlert.count({ where: { tenantId, resolvedAt: null, ...empFilter } }),
    ]);
    const staleMs = settings.offlineAlertMins * 60_000;
    const now = Date.now();
    return {
      enabled: settings.enabled, day,
      summaries: summaries.map((s) => ({
        employeeId: s.employeeId, name: `${s.employee.firstName} ${s.employee.lastName}`, employeeCode: s.employee.employeeCode,
        activeSeconds: s.activeSeconds, idleSeconds: s.idleSeconds, offlineSeconds: s.offlineSeconds,
        firstActivityAt: s.firstActivityAt, lastActivityAt: s.lastActivityAt, topApps: s.topApps,
      })),
      devices: devices.map((d) => ({
        id: d.id, employeeId: d.employeeId, employeeName: `${d.employee.firstName} ${d.employee.lastName}`,
        name: d.name, platform: d.platform, agentVersion: d.agentVersion, lastSeenAt: d.lastSeenAt,
        online: !!d.lastSeenAt && now - new Date(d.lastSeenAt).getTime() < staleMs,
      })),
      openAlerts,
    };
  }

  async summaries(tenantId: string, viewer: Viewer, requestedEmployeeId?: string, from?: string, to?: string) {
    const allowed = await this.scope(tenantId, viewer);
    const filter = employeeIdFilter(allowed, requestedEmployeeId);
    return this.prisma.activityDailySummary.findMany({
      where: { tenantId, ...filter, ...(from || to ? { day: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
      orderBy: [{ day: 'desc' }], take: 500,
    });
  }

  async devices(tenantId: string, viewer: Viewer) {
    const allowed = await this.scope(tenantId, viewer);
    const filter = allowed === null ? {} : { employeeId: { in: allowed } };
    return this.prisma.monitoredDevice.findMany({ where: { tenantId, ...filter },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } }, orderBy: { pairedAt: 'desc' } });
  }

  async revokeDevice(tenantId: string, viewer: Viewer, userId: string, deviceId: string) {
    const allowed = await this.scope(tenantId, viewer);
    const device = await this.prisma.monitoredDevice.findFirst({ where: { id: deviceId, tenantId } });
    if (!device || (allowed !== null && !allowed.includes(device.employeeId))) throw new NotFoundException('Device not found');
    await this.prisma.monitoredDevice.update({ where: { id: deviceId }, data: { status: 'REVOKED', revokedAt: new Date() } });
    await this.audit.log({ tenantId, userId, action: 'MONITORING_DEVICE_REVOKED', entity: 'MonitoredDevice', entityId: deviceId,
      before: { employeeId: device.employeeId, name: device.name } });
    return { revoked: true };
  }

  async alerts(tenantId: string, viewer: Viewer, resolved?: boolean) {
    const allowed = await this.scope(tenantId, viewer);
    const filter = allowed === null ? {} : { employeeId: { in: allowed } };
    return this.prisma.monitoringAlert.findMany({
      where: { tenantId, ...filter, ...(resolved === undefined ? {} : resolved ? { resolvedAt: { not: null } } : { resolvedAt: null }) },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  async resolveAlert(tenantId: string, viewer: Viewer, userId: string, alertId: string) {
    const allowed = await this.scope(tenantId, viewer);
    const alert = await this.prisma.monitoringAlert.findFirst({ where: { id: alertId, tenantId } });
    if (!alert || (allowed !== null && !allowed.includes(alert.employeeId))) throw new NotFoundException('Alert not found');
    await this.prisma.monitoringAlert.update({ where: { id: alertId }, data: { resolvedAt: new Date(), resolvedByUserId: userId } });
    return { resolved: true };
  }

  // viewer-only HR check used by the controller for settings routes handled by RolesGuard; kept for completeness
  assertHr(viewer: Viewer) { if (!isHrPlus(viewer.role)) throw new ForbiddenException('HR only'); }
}
