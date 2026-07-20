import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard/summary')
  @RequirePermissions('admin.dashboard.read')
  dashboardSummary() {
    return {
      status: 'ok',
      message: 'Operational queues and domain KPIs arrive in A2+',
      placeholders: {
        pendingVerifications: null,
        openDisputes: null,
        activeListings: null,
      },
    };
  }

  @Get('system/health')
  @RequirePermissions('admin.system.health.read')
  async systemHealth() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'nahu-platform-api',
      timestamp: new Date().toISOString(),
      dependencies: { database },
    };
  }
}
