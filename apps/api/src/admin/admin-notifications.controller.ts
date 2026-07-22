import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';

class ListNotificationsQuery {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  unreadOnly?: boolean;
}

class PublishNotificationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(3)
  body: string;

  @IsOptional()
  @IsIn(['INFO', 'WARN', 'CRITICAL'])
  severity?: string;

  @IsOptional()
  @IsIn(['USER', 'BROADCAST', 'ROLE'])
  audience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  audienceRole?: string;

  @IsOptional()
  @IsUUID()
  recipientUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  linkPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceModule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dedupeKey?: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('admin/notifications')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  @Get()
  @RequirePermissions('notifications.read')
  list(
    @CurrentAdmin() admin: AdminRequestUser,
    @Query() query: ListNotificationsQuery,
  ) {
    return this.notifications.listForAdmin(admin, query);
  }

  @Post('read-all')
  @RequirePermissions('notifications.read')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  markAllRead(@CurrentAdmin() admin: AdminRequestUser, @Req() req: Request) {
    return this.notifications.markAllRead(admin, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Post('publish')
  @RequirePermissions('notifications.manage')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  publish(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: PublishNotificationDto,
    @Req() req: Request,
  ) {
    return this.notifications.publish(admin, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Post(':id/read')
  @RequirePermissions('notifications.read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  markRead(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.notifications.markRead(admin, id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }
}
