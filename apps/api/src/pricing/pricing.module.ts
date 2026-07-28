import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { AdminPricingController } from './admin-pricing.controller';
import { PaymentRailsService } from './payment-rails.service';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [PricingController, AdminPricingController],
  providers: [PricingService, PaymentRailsService],
  exports: [PricingService, PaymentRailsService],
})
export class PricingModule {}
