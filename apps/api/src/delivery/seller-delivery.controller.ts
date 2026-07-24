import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import { PartyDeliveryService } from './party-delivery.service';
import { ListPartyShipmentsQueryDto } from './dto/party-delivery.dto';

@Controller('delivery/seller')
@UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
@Roles('FARMER')
export class SellerDeliveryController {
  constructor(private readonly party: PartyDeliveryService) {}

  @Get('shipments')
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListPartyShipmentsQueryDto,
  ) {
    return this.party.listShipments(user.userId, 'FARMER', {
      page: query.page,
      limit: query.limit,
      history:
        query.history === undefined
          ? undefined
          : query.history === 'true' || query.history === true,
    });
  }

  @Get('shipments/:id')
  detail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.party.getShipmentDetail(user.userId, 'FARMER', id);
  }

  @Get('orders/:orderId/tracking')
  tracking(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.party.getTrackingForOrder(user.userId, 'FARMER', orderId);
  }
}
