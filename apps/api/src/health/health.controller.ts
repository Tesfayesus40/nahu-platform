import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const dbHealthy = await this.prisma.isHealthy();

    return {
      status: 'ok',
      service: 'nahu-platform-api',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbHealthy ? 'up' : 'down',
      },
    };
  }
}
