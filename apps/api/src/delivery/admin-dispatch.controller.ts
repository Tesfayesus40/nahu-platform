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
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { AdminAuthService } from '../identity/admin/admin-auth.service';
import { DispatchService } from './dispatch.service';
import { AdminOpsService } from './admin-ops.service';
import { AuditService } from '../audit/audit.service';
import {
  AdminDispatchShipmentDto,
  AdminReleaseShipmentDto,
  AdminUnassignShipmentDto,
} from './dto/admin-dispatch.dto';
import {
  AdminCancelShipmentDto,
  AdminRetryShipmentDto,
  AdminBulkShipmentsDto,
  ListShipmentsQueryDto,
} from './dto/admin-ops.dto';

@Controller('admin/delivery/shipments')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminDispatchController {
  constructor(
    private readonly dispatch: DispatchService,
    private readonly ops: AdminOpsService,
    private readonly adminAuth: AdminAuthService,
    private readonly audit: AuditService,
  ) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get()
  @RequirePermissions('delivery.read')
  list(@Query() query: ListShipmentsQueryDto) {
    return this.ops.listShipments(query);
  }

  @Post('bulk')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async bulk(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: AdminBulkShipmentsDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.ops.bulkShipmentActions({
      action: dto.action,
      shipmentIds: dto.shipmentIds,
      actorUserId: admin.userId,
      sessionId: admin.sessionId,
      reason: dto.reason,
      meta: this.meta(req),
    });
  }

  @Get(':id/courier-candidates')
  @RequirePermissions('delivery.read')
  async candidates(@Param('id', ParseUUIDPipe) id: string) {
    return this.dispatch.rankCourierCandidates(id);
  }

  @Get(':id')
  @RequirePermissions('delivery.read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.getShipmentDetail(id);
  }

  @Post(':id/release')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async release(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReleaseShipmentDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const result = await this.dispatch.releaseForAssignment({
      shipmentId: id,
      actorUserId: admin.userId,
      reason: dto.reason,
    });
    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'delivery.manage',
      action: 'delivery.shipment.release',
      targetType: 'shipment',
      targetId: id,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      afterJson: { currentStatus: 'AWAITING_ASSIGNMENT' },
      ...this.meta(req),
    });
    return result;
  }

  @Post(':id/assign')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async assign(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminDispatchShipmentDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.dispatch.assignShipment({
      shipmentId: id,
      courierUserId: dto.courierUserId,
      actorUserId: admin.userId,
      reason: dto.reason,
      audit: true,
      sessionId: admin.sessionId,
      meta: this.meta(req),
    });
  }

  @Post(':id/reassign')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async reassign(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminDispatchShipmentDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.dispatch.reassignShipment({
      shipmentId: id,
      courierUserId: dto.courierUserId,
      actorUserId: admin.userId,
      reason: dto.reason,
      audit: true,
      sessionId: admin.sessionId,
      meta: this.meta(req),
    });
  }

  @Post(':id/unassign')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async unassign(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUnassignShipmentDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.dispatch.unassignShipment({
      shipmentId: id,
      actorUserId: admin.userId,
      reason: dto.reason,
      audit: true,
      sessionId: admin.sessionId,
      meta: this.meta(req),
    });
  }

  @Post(':id/cancel')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async cancel(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminCancelShipmentDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.ops.cancelShipment({
      shipmentId: id,
      actorUserId: admin.userId,
      sessionId: admin.sessionId,
      reason: dto.reason,
      meta: this.meta(req),
    });
  }

  @Post(':id/retry')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async retry(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminRetryShipmentDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.ops.retryFailedShipment({
      shipmentId: id,
      actorUserId: admin.userId,
      sessionId: admin.sessionId,
      reason: dto.reason,
      meta: this.meta(req),
    });
  }
}
