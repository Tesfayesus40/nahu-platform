import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  CatalogController,
  CatalogVerticalsController,
  ProductsController,
} from './catalog.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';
import { ListingAttributesService } from './listing-attributes.service';
import { ListingSchemaService } from './listing-schema.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  controllers: [
    CatalogController,
    ProductsController,
    CatalogVerticalsController,
    AdminCatalogController,
  ],
  providers: [
    CatalogService,
    AdminCatalogService,
    ListingAttributesService,
    ListingSchemaService,
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    CatalogService,
    AdminCatalogService,
    ListingAttributesService,
    ListingSchemaService,
  ],
})
export class CatalogModule {}
