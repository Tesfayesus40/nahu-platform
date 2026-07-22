import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminFeatureFlagsService } from './admin-feature-flags.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';

class UpdateFeatureFlagDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('admin/system/feature-flags')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminFeatureFlagsController {
  constructor(private readonly flags: AdminFeatureFlagsService) {}

  @Get()
  @RequirePermissions('admin.system.config.read')
  list() {
    return this.flags.list();
  }

  @Patch(':id')
  @RequirePermissions('admin.system.config.write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  update(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureFlagDto,
    @Req() req: Request,
  ) {
    return this.flags.update(admin, id, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }
}
