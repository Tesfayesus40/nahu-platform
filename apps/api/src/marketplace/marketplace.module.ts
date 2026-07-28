import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { FarmsModule } from '../farms/farms.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { MarketplaceService } from './marketplace.service';
import { FarmersController, ListingsController, BuyersController } from './marketplace.controller';
import { SellersController } from './sellers.controller';
import { SellerPartyService } from './seller-party.service';
import { AdminVerificationController } from './admin-verification.controller';
import { AdminVerificationService } from './admin-verification.service';
import { AdminListingModerationController } from './admin-listing-moderation.controller';
import { AdminListingModerationService } from './admin-listing-moderation.service';
import {
  AdminCooperativesController,
  AdminPromotionsController,
} from './admin-promotions.controller';
import {
  AdminCooperativesService,
  AdminPromotionsService,
} from './admin-promotions.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [CatalogModule, FarmsModule, InventoryModule, AuditModule, IdentityModule],
  controllers: [
    FarmersController,
    SellersController,
    BuyersController,
    ListingsController,
    AdminVerificationController,
    AdminListingModerationController,
    AdminPromotionsController,
    AdminCooperativesController,
  ],
  providers: [
    MarketplaceService,
    SellerPartyService,
    AdminVerificationService,
    AdminListingModerationService,
    AdminPromotionsService,
    AdminCooperativesService,
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    MarketplaceService,
    SellerPartyService,
    AdminVerificationService,
    AdminListingModerationService,
    AdminPromotionsService,
    AdminCooperativesService,
  ],
})
export class MarketplaceModule {}
