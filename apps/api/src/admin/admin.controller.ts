import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminSystemService } from './admin-system.service';

@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: AdminDashboardService,
    private readonly system: AdminSystemService,
  ) {}

  @Get('dashboard/summary')
  @RequirePermissions('admin.dashboard.read')
  dashboardSummary(@CurrentAdmin() admin: AdminRequestUser) {
    return this.dashboard.getAnalytics(admin);
  }

  @Get('system/health')
  @RequirePermissions('admin.system.health.read')
  systemHealth() {
    return this.system.getHealth();
  }

  @Get('system/overview')
  @RequirePermissions('admin.system.config.read')
  systemOverview() {
    return this.system.getOverview();
  }
}
