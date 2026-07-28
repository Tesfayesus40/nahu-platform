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
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import {
  AdminRefundPaymentDto,
  AdminSettlePaymentDto,
} from './dto/payment-orchestration.dto';

/**
 * G9 — Additive payment status APIs.
 * Does not replace /orders confirm-payment or /payments/methods.
 */
@Controller('payments/orders')
@UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
@Roles('BUYER', 'FARMER', 'COURIER')
export class PaymentOrchestrationController {
  constructor(private readonly payments: PaymentOrchestrationService) {}

  @Get(':orderId/status')
  status(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getStatus(orderId);
  }

  @Get(':orderId/escrow')
  escrow(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getEscrow(orderId);
  }

  @Get(':orderId/settlement')
  settlement(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getSettlement(orderId);
  }

  @Get(':orderId/refund')
  refund(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getRefund(orderId);
  }

  @Get(':orderId/events')
  events(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getEvents(orderId);
  }
}

@Controller('admin/payments')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminPaymentOrchestrationController {
  constructor(private readonly payments: PaymentOrchestrationService) {}

  @Get('orders/:orderId/status')
  @RequirePermissions('payment.read')
  status(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getStatus(orderId);
  }

  @Get('orders/:orderId/escrow')
  @RequirePermissions('payment.read')
  escrow(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getEscrow(orderId);
  }

  @Get('orders/:orderId/settlement')
  @RequirePermissions('payment.read')
  settlement(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getSettlement(orderId);
  }

  @Get('orders/:orderId/refund')
  @RequirePermissions('payment.read')
  refund(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getRefund(orderId);
  }

  @Get('orders/:orderId/events')
  @RequirePermissions('payment.read')
  events(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getEvents(orderId);
  }

  @Post('orders/:orderId/settle')
  @RequirePermissions('payment.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  settle(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AdminSettlePaymentDto,
  ) {
    return this.payments.settleOrder({
      orderId,
      actorUserId: admin.userId,
      reason: dto.reason,
      parties: dto.parties,
    });
  }

  @Post('orders/:orderId/refund')
  @RequirePermissions('payment.manage')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refundAction(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AdminRefundPaymentDto,
  ) {
    return this.payments.refundOrder({
      orderId,
      actorUserId: admin.userId,
      reason: dto.reason,
      amountEtb: dto.amountEtb,
      refundGoodsEtb: dto.refundGoodsEtb,
      refundBuyerFeeEtb: dto.refundBuyerFeeEtb,
      refundDeliveryEtb: dto.refundDeliveryEtb,
      message: dto.message,
    });
  }
}
