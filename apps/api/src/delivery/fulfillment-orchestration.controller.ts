import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { FulfillmentOrchestrationService } from './fulfillment-orchestration.service';
import {
  AssignCourierDto,
  ConfirmDeliveryDto,
  ConfirmPickupDto,
  TimeoutReassignDto,
} from './dto/orchestration.dto';

/**
 * G8 — Additive fulfilment orchestration APIs.
 * Does not replace existing /orders or /delivery/* RC1 routes.
 */
@Controller('fulfillment')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class FulfillmentOrchestrationController {
  constructor(private readonly orch: FulfillmentOrchestrationService) {}

  @Get('orders/:orderId')
  @UseGuards(RolesGuard)
  @Roles('BUYER', 'FARMER', 'COURIER')
  getStatus(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orch.getByOrderId(orderId);
  }

  @Post('orders/:orderId/seller-accept')
  @UseGuards(RolesGuard)
  @Roles('FARMER')
  sellerAccept(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orch.sellerAccept(orderId, user.userId);
  }

  @Post('orders/:orderId/preparing')
  @UseGuards(RolesGuard)
  @Roles('FARMER')
  preparing(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orch.startPreparing(orderId, user.userId);
  }

  @Post('orders/:orderId/ready-for-pickup')
  @UseGuards(RolesGuard)
  @Roles('FARMER')
  ready(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orch.markReadyForPickup(orderId, user.userId);
  }

  @Post('orders/:orderId/confirm-pickup')
  @UseGuards(RolesGuard)
  @Roles('FARMER', 'COURIER')
  confirmPickup(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: ConfirmPickupDto,
  ) {
    return this.orch.confirmPickup({
      orderId,
      party: dto.party,
      actorUserId: user.userId,
    });
  }

  @Post('orders/:orderId/confirm-delivery')
  @UseGuards(RolesGuard)
  @Roles('BUYER', 'COURIER')
  confirmDelivery(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: ConfirmDeliveryDto,
  ) {
    return this.orch.confirmDelivery({
      orderId,
      party: dto.party,
      actorUserId: user.userId,
    });
  }

  @Post('orders/:orderId/in-transit')
  @UseGuards(RolesGuard)
  @Roles('COURIER')
  inTransit(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orch.markInTransit(orderId, user.userId);
  }
}

@Controller('admin/fulfillment')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminFulfillmentOrchestrationController {
  constructor(private readonly orch: FulfillmentOrchestrationService) {}

  @Get('orders/:orderId')
  @RequirePermissions('delivery.read')
  getStatus(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orch.getByOrderId(orderId);
  }

  @Get('orders/:orderId/available-couriers')
  @RequirePermissions('delivery.read')
  available(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orch.listAvailableCouriers(orderId);
  }

  @Post('orders/:orderId/assign')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  assign(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AssignCourierDto,
  ) {
    return this.orch.assignCourier({
      orderId,
      actorUserId: admin.userId,
      courierUserId: dto.courierUserId,
      timeoutMinutes: dto.timeoutMinutes,
    });
  }

  @Post('orders/:orderId/settle')
  @RequirePermissions('delivery.manage')
  settle(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orch.settle(orderId, admin.userId);
  }

  @Post('timeout-reassign')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  timeoutReassign(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: TimeoutReassignDto,
  ) {
    return this.orch.timeoutAndReassign({
      actorUserId: admin.userId,
      autoReassign: dto.autoReassign,
      limit: dto.limit,
    });
  }
}
