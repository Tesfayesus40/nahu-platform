import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import {
  CreateMovementDto,
  QueryBalancesDto,
  QueryLotsDto,
  ReceiveStockDto,
} from './dto/inventory.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FARMER')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('lots')
  listLots(@CurrentUser() user: JwtPayload, @Query() query: QueryLotsDto) {
    return this.inventory.listLots(user.userId, query);
  }

  @Get('lots/:id')
  getLot(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.inventory.getLot(user.userId, id);
  }

  @Get('lots/:id/movements')
  listMovements(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.inventory.listMovements(user.userId, id);
  }

  @Get('balances')
  balances(@CurrentUser() user: JwtPayload, @Query() query: QueryBalancesDto) {
    return this.inventory.balances(user.userId, query);
  }

  @Post('receive')
  receive(@CurrentUser() user: JwtPayload, @Body() dto: ReceiveStockDto) {
    return this.inventory.receive(user.userId, dto);
  }

  @Post('movements')
  createMovement(@CurrentUser() user: JwtPayload, @Body() dto: CreateMovementDto) {
    return this.inventory.createMovement(user.userId, dto);
  }
}
