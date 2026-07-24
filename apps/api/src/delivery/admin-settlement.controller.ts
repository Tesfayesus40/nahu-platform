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
import { SettlementService } from './settlement.service';
import {
  AdjustEarningDto,
  ListAdminEarningsQueryDto,
  SettlementReauthDto,
} from './dto/settlement.dto';

/**
 * D11 — Admin settlement review (no payout rails).
 */
@Controller('admin/delivery/earnings')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminSettlementController {
  constructor(
    private readonly settlement: SettlementService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get()
  @RequirePermissions('delivery.earnings.read')
  list(@Query() query: ListAdminEarningsQueryDto) {
    return this.settlement.listAdminEarnings(query);
  }

  @Get(':id')
  @RequirePermissions('delivery.earnings.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.settlement.getEarningDetail(id);
  }

  @Post(':id/approve')
  @RequirePermissions('delivery.earnings.manage')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async approve(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettlementReauthDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.settlement.approveEarning({
      earningId: id,
      actorUserId: admin.userId,
      sessionId: admin.sessionId,
      reason: dto.reason,
      meta: this.meta(req),
    });
  }

  @Post(':id/mark-paid')
  @RequirePermissions('delivery.earnings.manage')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async markPaid(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettlementReauthDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.settlement.markPaid({
      earningId: id,
      actorUserId: admin.userId,
      sessionId: admin.sessionId,
      reason: dto.reason,
      meta: this.meta(req),
    });
  }

  @Post(':id/adjust')
  @RequirePermissions('delivery.earnings.manage')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async adjust(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustEarningDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.settlement.adjustEarning({
      earningId: id,
      correctionAmount: dto.correctionAmount,
      actorUserId: admin.userId,
      sessionId: admin.sessionId,
      reason: dto.reason,
      meta: this.meta(req),
    });
  }

  @Post(':id/reverse')
  @RequirePermissions('delivery.earnings.manage')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async reverse(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettlementReauthDto,
    @Req() req: Request,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.settlement.reverseEarning({
      earningId: id,
      actorUserId: admin.userId,
      sessionId: admin.sessionId,
      reason: dto.reason,
      meta: this.meta(req),
    });
  }
}
