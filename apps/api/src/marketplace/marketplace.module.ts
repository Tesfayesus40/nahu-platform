import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { FarmsModule } from '../farms/farms.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MarketplaceService } from './marketplace.service';
import { FarmersController, ListingsController } from './marketplace.controller';

@Module({
  imports: [CatalogModule, FarmsModule, InventoryModule],
  controllers: [FarmersController, ListingsController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
