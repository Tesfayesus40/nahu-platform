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
import { AdminOrdersService } from './admin-orders.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import {
  ListOrdersQueryDto,
  OrderAdminActionDto,
  OrderAdminNoteDto,
} from './dto/admin-orders.dto';
import { PaymentsService } from '../payments/payments.service';

@Controller('admin/orders')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminOrdersController {
  constructor(
    private readonly orders: AdminOrdersService,
    private readonly payments: PaymentsService,
  ) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get()
  @RequirePermissions('orders.read')
  list(@Query() query: ListOrdersQueryDto) {
    return this.orders.list(query);
  }

  @Get('payment-methods')
  @RequirePermissions('payments.read')
  paymentMethods() {
    return this.payments.listMethods();
  }

  @Get(':id')
  @RequirePermissions('orders.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(id);
  }

  @Post(':id/actions')
  @RequirePermissions('orders.transition')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  action(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderAdminActionDto,
    @Req() req: Request,
  ) {
    return this.orders.applyAction(admin, id, dto, this.meta(req));
  }

  @Post(':id/notes')
  @RequirePermissions('orders.transition')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  note(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderAdminNoteDto,
    @Req() req: Request,
  ) {
    return this.orders.addNote(admin, id, dto, this.meta(req));
  }
}
