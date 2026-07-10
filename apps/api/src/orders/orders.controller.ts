import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUYER')
  createOrder(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.orders.createOrder(user.userId, dto);
  }

  // Buyer who owns the order — simulates Telebirr callback until a signed
  // webhook replaces this in production (Phase 2).
  @Patch(':id/confirm-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUYER')
  confirmPayment(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.orders.confirmPayment(id, user.userId);
  }

  @Patch(':id/confirm-delivery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUYER')
  confirmDelivery(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.orders.confirmDelivery(id, user.userId);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUYER')
  cancelOrder(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.orders.cancelOrder(id, user.userId);
  }

  @Patch(':id/decline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  declineOrder(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.orders.declineOrder(id, user.userId);
  }

  // Either party can raise a dispute once payment is in escrow -- no role
  // restriction, since both buyer and farmer might need this.
  @Patch(':id/dispute')
  @UseGuards(JwtAuthGuard)
  raiseDispute(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.orders.raiseDispute(id, user.userId);
  }

  @Patch(':id/address')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUYER')
  updateAddress(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.orders.updateAddress(id, user.userId, dto.deliveryAddress);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyOrders(@CurrentUser() user: JwtPayload) {
    return this.orders.getMyOrders(user.userId, user.role);
  }
}
