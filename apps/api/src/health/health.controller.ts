import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

/**
 * /health   — liveness: the process is up (restart it if this fails).
 * /health/ready — readiness: it can actually serve traffic, i.e. the database answers (take it out of the
 * load balancer if this fails, don't restart). Deployments flip traffic only once /health/ready is green.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  live() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()), version: process.env.APP_VERSION || 'dev' };
  }

  @Get('ready')
  async ready() {
    const database = await Promise.race([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'up' as const),
      new Promise<'down'>((resolve) => setTimeout(() => resolve('down'), 2000)),
    ]).catch(() => 'down' as const);
    const body = { status: database === 'up' ? 'ready' : 'degraded', checks: { database }, version: process.env.APP_VERSION || 'dev' };
    if (database !== 'up') throw new ServiceUnavailableException(body);
    return body;
  }
}
