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
import { AdminDeliveryService } from './admin-delivery.service';
import { AdminOpsService } from './admin-ops.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import {
  FulfillmentActionDto,
  ListFulfillmentQueryDto,
} from './dto/fulfillment.dto';
import { ListCouriersQueryDto } from './dto/admin-ops.dto';

@Controller('admin/delivery')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminDeliveryController {
  constructor(
    private readonly delivery: AdminDeliveryService,
    private readonly ops: AdminOpsService,
  ) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get('ops/metrics')
  @RequirePermissions('delivery.read')
  metrics() {
    return this.ops.getOpsMetrics();
  }

  @Get('couriers')
  @RequirePermissions('delivery.read')
  listCouriers(@Query() query: ListCouriersQueryDto) {
    return this.ops.listCouriers(query);
  }

  @Get('couriers/:userId')
  @RequirePermissions('delivery.read')
  getCourier(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.ops.getCourierOps(userId);
  }

  @Get('fulfillments')
  @RequirePermissions('delivery.read')
  list(@Query() query: ListFulfillmentQueryDto) {
    return this.delivery.list(query);
  }

  @Get('fulfillments/:id')
  @RequirePermissions('delivery.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.delivery.get(id);
  }

  @Post('fulfillments/:id/actions')
  @RequirePermissions('delivery.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  action(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FulfillmentActionDto,
    @Req() req: Request,
  ) {
    return this.delivery.applyAction(admin, id, dto, this.meta(req));
  }
}
