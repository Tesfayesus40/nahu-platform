import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ListingAttributesService } from './listing-attributes.service';
import { ListingSchemaService } from './listing-schema.service';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

class QueryVerticalsDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  activeOnly?: boolean;
}

class QueryAttributeDefsDto {
  @IsOptional()
  @IsString()
  categoryCode?: string;
}

class QueryListingSchemaDto {
  @IsString()
  categoryCode!: string;

  @IsOptional()
  @IsString()
  schemaId?: string;
}

class QuerySearchMetadataDto {
  @IsString()
  categoryCode!: string;
}

/** Existing public catalog routes — additive fields only (G2). */
@Controller('categories')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly listingAttributes: ListingAttributesService,
  ) {}

  @Get()
  listCategories(@Query() query: QueryCategoriesDto) {
    return this.catalog.listCategories(query);
  }

  /** G3 — attribute definitions for a category code. */
  @Get(':code/attributes')
  listCategoryAttributes(@Param('code') code: string) {
    return this.listingAttributes.listDefinitionsByCategoryCode(code);
  }
}

@Controller('products')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  listProducts(@Query() query: QueryProductsDto) {
    return this.catalog.listProducts(query);
  }

  @Get(':codeOrId')
  getProduct(@Param('codeOrId') codeOrId: string) {
    return this.catalog.getProductByCodeOrId(codeOrId);
  }
}

/** Additive G2–G4 catalog namespace. */
@Controller('catalog')
export class CatalogVerticalsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly listingAttributes: ListingAttributesService,
    private readonly listingSchemas: ListingSchemaService,
  ) {}

  @Get('verticals')
  listVerticals(@Query() query: QueryVerticalsDto) {
    return this.catalog.listVerticals(query);
  }

  @Get('verticals/:code')
  getVertical(@Param('code') code: string) {
    return this.catalog.getVerticalByCode(code);
  }

  @Get('verticals/:code/categories')
  listVerticalCategories(
    @Param('code') code: string,
    @Query() query: QueryCategoriesDto,
  ) {
    return this.catalog.listCategoriesByVertical(code, query);
  }

  @Get('units')
  listUnits() {
    return this.listingAttributes.listUnits();
  }

  @Get('attribute-definitions')
  listAttributeDefinitions(@Query() query: QueryAttributeDefsDto) {
    if (!query.categoryCode) {
      return [];
    }
    return this.listingAttributes.listDefinitionsByCategoryCode(query.categoryCode);
  }

  /**
   * G4 — everything needed to render a listing form from configuration.
   * Alias: GET /catalog/form-schemas (D5 contract).
   */
  @Get('listing-schemas')
  getListingSchema(@Query() query: QueryListingSchemaDto) {
    if (!query.categoryCode?.trim()) {
      throw new BadRequestException('categoryCode is required');
    }
    return this.listingSchemas.getListingSchema({
      categoryCode: query.categoryCode,
      schemaId: query.schemaId,
    });
  }

  @Get('form-schemas')
  getFormSchema(@Query() query: QueryListingSchemaDto) {
    if (!query.categoryCode?.trim()) {
      throw new BadRequestException('categoryCode is required');
    }
    return this.listingSchemas.getListingSchema({
      categoryCode: query.categoryCode,
      schemaId: query.schemaId || 'listing.create',
    });
  }

  /** G4 — searchable / filterable / sortable attribute metadata (no search UI). */
  @Get('search-metadata')
  getSearchMetadata(@Query() query: QuerySearchMetadataDto) {
    if (!query.categoryCode?.trim()) {
      throw new BadRequestException('categoryCode is required');
    }
    return this.listingSchemas.getSearchMetadata(query.categoryCode);
  }
}
