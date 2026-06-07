import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClockInDto } from './dto';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async clockIn(tenantId: string, employeeId: string, dto: ClockInDto, source = 'WEB') {
    const today = this.today();
    const existing = await this.prisma.attendanceLog.findUnique({
      where: { tenantId_employeeId_date: { tenantId, employeeId, date: today } },
    });

    if (existing?.clockIn) throw new BadRequestException('Already clocked in today');

    if (dto.latitude && dto.longitude) {
      const locations = await this.prisma.officeLocation.findMany({
        where: { tenantId, isActive: true },
      });
      if (locations.length > 0) {
        const inRange = locations.some((loc) => {
          const dist = this.haversine(
            Number(dto.latitude), Number(dto.longitude),
            Number(loc.latitude), Number(loc.longitude),
          );
          return dist <= loc.radiusMeters;
        });
        if (!inRange) throw new BadRequestException('You are outside the office geo-fence');
      }
    }

    const log = await this.prisma.attendanceLog.upsert({
      where: { tenantId_employeeId_date: { tenantId, employeeId, date: today } },
      update: {
        clockIn: new Date(),
        source: source as any,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: 'PRESENT',
      },
      create: {
        tenantId, employeeId, date: today,
        clockIn: new Date(),
        source: source as any,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: 'PRESENT',
      },
    });

    return log;
  }

  async clockOut(tenantId: string, employeeId: string) {
    const today = this.today();
    const log = await this.prisma.attendanceLog.findUnique({
      where: { tenantId_employeeId_date: { tenantId, employeeId, date: today } },
    });

    if (!log?.clockIn) throw new BadRequestException('Not clocked in today');
    if (log.clockOut) throw new BadRequestException('Already clocked out');

    const clockOut = new Date();
    const hours = (clockOut.getTime() - log.clockIn.getTime()) / (1000 * 60 * 60);

    return this.prisma.attendanceLog.update({
      where: { id: log.id },
      data: { clockOut, hours: Math.round(hours * 100) / 100 },
    });
  }

  async getMyLogs(tenantId: string, employeeId: string, month?: string) {
    const start = month
      ? new Date(`${month}-01`)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

    return this.prisma.attendanceLog.findMany({
      where: { tenantId, employeeId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
  }

  async getTodayDashboard(tenantId: string) {
    const today = this.today();
    const logs = await this.prisma.attendanceLog.findMany({
      where: { tenantId, date: today },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, department: true },
        },
      },
    });

    const allEmployees = await this.prisma.employee.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const onLeave = await this.prisma.leaveRequest.count({
      where: {
        tenantId, status: 'APPROVED',
        startDate: { lte: today }, endDate: { gte: today },
      },
    });

    const present = logs.filter((l) => l.clockIn && !l.clockOut).length;
    const completed = logs.filter((l) => l.clockOut).length;
    const absent = allEmployees - logs.length - onLeave;

    return {
      date: today,
      total: allEmployees,
      present,
      completed,
      onLeave,
      absent: Math.max(0, absent),
      late: logs.filter((l) => {
        if (!l.clockIn) return false;
        const hour = l.clockIn.getHours();
        return hour >= 10;
      }).length,
      logs,
    };
  }

  async requestRegularization(
    tenantId: string,
    employeeId: string,
    data: { date: string; reason: string; requestedClockIn?: string; requestedClockOut?: string },
  ) {
    const date = new Date(data.date);
    date.setHours(0, 0, 0, 0);

    let log = await this.prisma.attendanceLog.findUnique({
      where: { tenantId_employeeId_date: { tenantId, employeeId, date } },
    });

    if (!log) {
      log = await this.prisma.attendanceLog.create({
        data: { tenantId, employeeId, date, status: 'ABSENT' },
      });
    }

    return this.prisma.regularizationRequest.create({
      data: {
        tenantId,
        attendanceLogId: log.id,
        reason: data.reason,
        requestedClockIn: data.requestedClockIn ? new Date(data.requestedClockIn) : undefined,
        requestedClockOut: data.requestedClockOut ? new Date(data.requestedClockOut) : undefined,
      },
    });
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
