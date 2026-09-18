import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationSyncService } from '../integrations/integration-sync.service';
import { zonedTimeToUtc } from './tz';

const PROVIDER = 'zkteco';
const ONLINE_WINDOW_MS = 10 * 60_000;
// PIN, then "YYYY-MM-DD HH:mm:ss", separated by tabs or spaces — the ATTLOG line shape.
const ATTLOG_LINE = /^(\S+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/;

type Punch = { pin: string; at: Date; localDate: string };

@Injectable()
export class BiometricService {
  constructor(
    private prisma: PrismaService,
    private syncLogs: IntegrationSyncService,
  ) {}

  // ── Device registry (admin) ────────────────────────────────────────────
  private withStatus<T extends { lastSeenAt: Date | null }>(d: T) {
    return { ...d, online: !!d.lastSeenAt && Date.now() - d.lastSeenAt.getTime() < ONLINE_WINDOW_MS };
  }

  async listDevices(tenantId: string) {
    const rows = await this.prisma.biometricDevice.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    return rows.map((d) => this.withStatus(d));
  }

  private async assertIntegrationConnected(tenantId: string) {
    const row = await this.prisma.tenantIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider: PROVIDER } },
    });
    if (!row || row.status !== 'connected') {
      throw new BadRequestException('Connect ZKTeco Biometric in the Marketplace before registering devices');
    }
  }

  async createDevice(tenantId: string, dto: { serialNumber: string; name: string; location?: string }) {
    await this.assertIntegrationConnected(tenantId);
    const serial = dto.serialNumber.trim();
    const existing = await this.prisma.biometricDevice.findUnique({ where: { serialNumber: serial } });
    if (existing) throw new ConflictException('A device with this serial number is already registered');
    const row = await this.prisma.biometricDevice.create({
      data: { tenantId, serialNumber: serial, name: dto.name, location: dto.location },
    });
    return this.withStatus(row);
  }

  async updateDevice(tenantId: string, id: string, dto: { name?: string; location?: string; isActive?: boolean }) {
    const d = await this.prisma.biometricDevice.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Device not found');
    return this.withStatus(await this.prisma.biometricDevice.update({ where: { id }, data: dto }));
  }

  async removeDevice(tenantId: string, id: string) {
    const d = await this.prisma.biometricDevice.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Device not found');
    await this.prisma.biometricDevice.delete({ where: { id } });
    return { deleted: true };
  }

  // ── ADMS protocol (called by the terminals, no user session) ───────────
  /** Only a registered, active device on a tenant with the integration connected may talk to us. */
  private async authenticateDevice(serialNumber: string) {
    const device = serialNumber
      ? await this.prisma.biometricDevice.findUnique({ where: { serialNumber } })
      : null;
    if (!device || !device.isActive) throw new ForbiddenException('Unknown or disabled device');
    const integration = await this.prisma.tenantIntegration.findUnique({
      where: { tenantId_provider: { tenantId: device.tenantId, provider: PROVIDER } },
    });
    if (integration?.status !== 'connected') throw new ForbiddenException('Integration is not connected');
    await this.prisma.biometricDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    return device;
  }

  async handshake(serialNumber: string) {
    await this.authenticateDevice(serialNumber);
    return [
      `GET OPTION FROM: ${serialNumber}`,
      'ErrorDelay=60',
      'Delay=30',
      'TransInterval=1',
      'TransFlag=TransData AttLog',
      'Realtime=1',
      'Encrypt=None',
    ].join('\n');
  }

  async receive(serialNumber: string, table: string | undefined, body: string) {
    const device = await this.authenticateDevice(serialNumber);
    if ((table || '').toUpperCase() !== 'ATTLOG') return 'OK';

    const startedAt = new Date();
    const tenant = await this.prisma.tenant.findUnique({ where: { id: device.tenantId }, select: { timezone: true } });
    const tz = tenant?.timezone || 'Asia/Karachi';

    const punches: Punch[] = [];
    let badLines = 0;
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(ATTLOG_LINE);
      const at = m ? zonedTimeToUtc(m[2].replace(/\s+/, ' '), tz) : null;
      if (!m || !at) {
        badLines++;
        continue;
      }
      punches.push({ pin: m[1], at, localDate: m[2].slice(0, 10) });
    }

    const pins = [...new Set(punches.map((p) => p.pin))];
    const employees = pins.length
      ? await this.prisma.employee.findMany({
          where: { tenantId: device.tenantId, OR: [{ biometricPin: { in: pins } }, { employeeCode: { in: pins } }] },
          select: { id: true, employeeCode: true, biometricPin: true },
        })
      : [];
    const byPin = new Map<string, string>();
    for (const e of employees) {
      byPin.set(e.employeeCode, e.id);
      if (e.biometricPin) byPin.set(e.biometricPin, e.id); // an explicit PIN wins over a code collision
    }

    const unknownPins = new Set<string>();
    const groups = new Map<string, { employeeId: string; localDate: string; times: Date[] }>();
    let accepted = 0;
    for (const p of punches) {
      const employeeId = byPin.get(p.pin);
      if (!employeeId) {
        unknownPins.add(p.pin);
        continue;
      }
      accepted++;
      const key = `${employeeId}|${p.localDate}`;
      const g = groups.get(key) ?? { employeeId, localDate: p.localDate, times: [] };
      g.times.push(p.at);
      groups.set(key, g);
    }

    for (const g of groups.values()) {
      const date = new Date(`${g.localDate}T00:00:00.000Z`);
      const where = { tenantId_employeeId_date: { tenantId: device.tenantId, employeeId: g.employeeId, date } };
      const existing = await this.prisma.attendanceLog.findUnique({ where });

      const times = g.times.map((t) => t.getTime());
      const first = new Date(Math.min(...times, existing?.clockIn?.getTime() ?? Infinity));
      const lastMs = Math.max(...times, existing?.clockOut?.getTime() ?? -Infinity);
      // A single punch is only a clock-in; the terminal doesn't say in/out reliably, so pair first and last.
      const clockOut = lastMs > first.getTime() ? new Date(lastMs) : existing?.clockOut ?? null;
      const hours = clockOut ? Math.round(((clockOut.getTime() - first.getTime()) / 3_600_000) * 100) / 100 : null;

      await this.prisma.attendanceLog.upsert({
        where,
        update: { clockIn: first, clockOut, hours, status: existing?.status === 'ABSENT' ? 'PRESENT' : undefined },
        create: {
          tenantId: device.tenantId, employeeId: g.employeeId, date,
          clockIn: first, clockOut, hours, status: 'PRESENT', source: 'BIOMETRIC',
        },
      });
    }

    const failed = punches.length - accepted + badLines;
    await this.prisma.biometricDevice.update({ where: { id: device.id }, data: { lastPushAt: new Date() } });
    await this.syncLogs.record({
      tenantId: device.tenantId,
      provider: PROVIDER,
      direction: 'INBOUND',
      processed: accepted,
      failed,
      startedAt,
      message: failed
        ? `Received ${accepted} punch(es); ${failed} could not be matched (${[...unknownPins].slice(0, 5).join(', ') || 'unparseable lines'})`
        : `Received ${accepted} punch(es) from ${device.name}`,
      details: { device: device.serialNumber, unknownPins: [...unknownPins].slice(0, 20), badLines },
    });
    return `OK: ${accepted}`;
  }
}
