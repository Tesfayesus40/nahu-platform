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

  // Simulates a Telebirr/CBE Birr payment callback. Any authenticated
  // caller, matching the original app's behavior (this stands in for a
  // webhook in production, not a user-facing action gated by role).
  @Patch(':id/confirm-payment')
  @UseGuards(JwtAuthGuard)
  confirmPayment(@Param('id') id: string) {
    return this.orders.confirmPayment(id);
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
