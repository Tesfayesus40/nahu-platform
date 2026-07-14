import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController, ProductsController } from './catalog.controller';

@Module({
  controllers: [CatalogController, ProductsController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
