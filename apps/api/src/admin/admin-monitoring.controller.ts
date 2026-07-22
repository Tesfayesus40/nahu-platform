import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { AdminMonitoringService } from './admin-monitoring.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

class MonitoringQuery {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  emitNotices?: boolean;
}

@Controller('admin/monitoring')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminMonitoringController {
  constructor(private readonly monitoring: AdminMonitoringService) {}

  @Get()
  @RequirePermissions('monitoring.read')
  snapshot(@Query() query: MonitoringQuery) {
    return this.monitoring.getSnapshot({
      emitNotices: query.emitNotices === true,
    });
  }
}
