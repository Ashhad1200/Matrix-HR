import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sha256 } from './monitoring.util';

/**
 * Authenticates the desktop agent by its pairing token (header `X-Device-Token`), NOT a user JWT.
 * The device carries its own tenant + employee, so the request is tenant-scoped the moment it is identified.
 * Attaches `request.device`.
 */
@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['x-device-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token || typeof token !== 'string') throw new UnauthorizedException('Missing device token');
    const device = await this.prisma.monitoredDevice.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, tenantId: true, employeeId: true, status: true },
    });
    if (!device || device.status !== 'ACTIVE') throw new UnauthorizedException('Unknown or revoked device');
    req.device = device;
    return true;
  }
}
