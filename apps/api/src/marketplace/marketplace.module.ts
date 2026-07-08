import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { FarmersController, ListingsController } from './marketplace.controller';

// No JwtModule import needed here -- JwtAuthGuard/RolesGuard resolve
// JwtService from the globally-registered JwtConfigModule (see
// app.module.ts), same as IdentityModule.
@Module({
  controllers: [FarmersController, ListingsController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
