import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { CourierProfileService } from './courier-profile.service';
import { CourierNotificationsService } from './courier-notifications.service';
import {
  CreateCourierAnnouncementDto,
  ListCourierVerificationsQueryDto,
  RejectCourierVerificationDto,
} from './dto/courier-crm.dto';

@Controller('admin/delivery')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminCourierVerificationController {
  constructor(
    private readonly crm: CourierProfileService,
    private readonly notifications: CourierNotificationsService,
  ) {}

  @Get('courier-verifications')
  @RequirePermissions('delivery.read')
  list(@Query() query: ListCourierVerificationsQueryDto) {
    return this.crm.listVerifications(query);
  }

  @Get('courier-verifications/:id')
  @RequirePermissions('delivery.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.crm.getVerificationCase(id);
  }

  @Post('courier-verifications/:id/approve')
  @RequirePermissions('delivery.couriers.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  approve(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crm.approveVerification(id, admin.userId);
  }

  @Post('courier-verifications/:id/reject')
  @RequirePermissions('delivery.couriers.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  reject(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCourierVerificationDto,
  ) {
    return this.crm.rejectVerification(id, admin.userId, dto.reason);
  }

  @Post('courier-announcements')
  @RequirePermissions('delivery.couriers.manage')
  announce(@Body() dto: CreateCourierAnnouncementDto) {
    return this.notifications.createAnnouncement(dto);
  }
}
