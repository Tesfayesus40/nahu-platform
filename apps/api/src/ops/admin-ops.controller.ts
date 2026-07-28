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
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Request } from 'express';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { OpsMarketplaceService } from './ops-marketplace.service';
import { OpsOrderInspectionService } from './ops-order-inspection.service';
import { OpsCourierPaymentService } from './ops-courier-payment.service';
import { AdminSellerOpsService } from './admin-seller-ops.service';
import { SELLER_ADMIN_ACTIONS } from './ops.rules';

class PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

class ListSellersQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  verificationStatus?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

class SellerActionDto {
  @IsIn([...SELLER_ADMIN_ACTIONS])
  action!: (typeof SELLER_ADMIN_ACTIONS)[number];

  @IsOptional()
  @IsString()
  notes?: string;
}

class ListCouriersQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  availability?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  activeOnly?: boolean;
}

class ReassignDto {
  @IsUUID()
  courierUserId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class ListPaymentsQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  escrowStatus?: string;

  @IsOptional()
  @IsString()
  settlementStatus?: string;

  @IsOptional()
  @IsString()
  refundStatus?: string;
}

class AuditSearchQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(['orders', 'fulfilment', 'payments', 'sellers'])
  domain?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

/**
 * G10 — Additive operations & administration APIs.
 * Does not replace existing admin/dashboard, admin/orders, or G8/G9 routes.
 */
@Controller('admin/ops')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminOpsMarketplaceController {
  constructor(
    private readonly marketplace: OpsMarketplaceService,
    private readonly orders: OpsOrderInspectionService,
    private readonly courierPayment: OpsCourierPaymentService,
  ) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get('dashboard')
  @RequirePermissions('admin.dashboard.read')
  dashboard() {
    return this.marketplace.getDashboardSummary();
  }

  @Get('health')
  @RequirePermissions('monitoring.read')
  health() {
    return this.marketplace.getHealth();
  }

  @Get('orders/:orderId')
  @RequirePermissions('orders.read')
  inspectOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orders.inspectOrder(orderId);
  }

  @Get('couriers')
  @RequirePermissions('delivery.read')
  listCouriers(@Query() query: ListCouriersQuery) {
    return this.courierPayment.listCouriers(query);
  }

  @Get('couriers/:userId/assignments')
  @RequirePermissions('delivery.read')
  courierAssignments(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.courierPayment.getCourierAssignments(userId);
  }

  @Post('shipments/:shipmentId/reassign')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  reassign(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: ReassignDto,
    @Req() req: Request,
  ) {
    return this.courierPayment.reassignShipment({
      shipmentId,
      courierUserId: dto.courierUserId,
      actorUserId: admin.userId,
      reason: dto.reason,
      sessionId: admin.sessionId,
      meta: this.meta(req),
    });
  }

  @Get('payments')
  @RequirePermissions('payment.read')
  listPayments(@Query() query: ListPaymentsQuery) {
    return this.courierPayment.listPayments(query);
  }

  @Get('payments/orders/:orderId')
  @RequirePermissions('payment.read')
  paymentDetail(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.courierPayment.getPaymentDetail(orderId);
  }

  @Get('audit/search')
  @RequirePermissions('audit.read')
  auditSearch(@Query() query: AuditSearchQuery) {
    return this.courierPayment.searchAudit(query);
  }
}

@Controller('admin/sellers')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminSellersController {
  constructor(private readonly sellers: AdminSellerOpsService) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get()
  @RequirePermissions('seller.read')
  list(@Query() query: ListSellersQuery) {
    return this.sellers.list(query);
  }

  @Get(':id')
  @RequirePermissions('seller.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sellers.get(id);
  }

  @Post(':id/actions')
  @RequirePermissions('seller.write')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  action(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SellerActionDto,
    @Req() req: Request,
  ) {
    return this.sellers.applyAction({
      sellerId: id,
      action: dto.action,
      actorUserId: admin.userId,
      sessionId: admin.sessionId,
      notes: dto.notes,
      meta: this.meta(req),
    });
  }
}
