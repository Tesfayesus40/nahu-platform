import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FARMER')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get('lots/:lotId/reservations')
  listForLot(@CurrentUser() user: JwtPayload, @Param('lotId') lotId: string) {
    return this.reservations.listForLot(user.userId, lotId);
  }

  @Get('reservations')
  byListing(@CurrentUser() user: JwtPayload, @Query('listingId') listingId: string) {
    return this.reservations.getByListing(user.userId, listingId);
  }

  @Post('reservations/:id/release')
  release(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reservations.releaseById(user.userId, id);
  }
}
