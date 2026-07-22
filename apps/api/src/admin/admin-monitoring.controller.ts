import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminMonitoringService } from './admin-monitoring.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { adminRequestMeta } from '../common/admin/admin-request-meta';

@Controller('admin/monitoring')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminMonitoringController {
  constructor(private readonly monitoring: AdminMonitoringService) {}

  @Get()
  @RequirePermissions('monitoring.read')
  snapshot() {
    return this.monitoring.getSnapshot();
  }

  @Post('emit-notices')
  @RequirePermissions('monitoring.read')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  emitNotices(@CurrentAdmin() admin: AdminRequestUser, @Req() req: Request) {
    return this.monitoring.emitAlertNotices(admin, adminRequestMeta(req));
  }
}
