import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Liveness: process is up (Docker HEALTHCHECK / k8s liveness).
 * Readiness: dependencies (DB) are reachable (k8s readiness / load balancer).
 */
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** @deprecated Prefer /health/live and /health/ready — kept for RC1 clients. */
  @Get('health')
  async check() {
    const dbHealthy = await this.prisma.isHealthy();
    const body = {
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'nahu-platform-api',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbHealthy ? 'up' : 'down',
      },
    };
    if (!dbHealthy) {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }

  @Get('health/live')
  live() {
    return {
      status: 'ok',
      probe: 'liveness',
      service: 'nahu-platform-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/ready')
  async ready() {
    const dbHealthy = await this.prisma.isHealthy();
    const body = {
      status: dbHealthy ? 'ok' : 'unavailable',
      probe: 'readiness',
      service: 'nahu-platform-api',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbHealthy ? 'up' : 'down',
      },
    };
    if (!dbHealthy) {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
