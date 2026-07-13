import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MarketplaceService } from './marketplace.service';
import { FarmersController, ListingsController } from './marketplace.controller';

@Module({
  imports: [CatalogModule],
  controllers: [FarmersController, ListingsController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
