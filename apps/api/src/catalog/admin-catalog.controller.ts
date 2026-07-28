import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AdminCatalogService } from './admin-catalog.service';
import { ListingAttributesService } from './listing-attributes.service';

class UpdateVerticalDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAm?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  defaultBrand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  complianceProfileCode?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  verticalCode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameEn: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameAm: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string | null;

  @IsOptional()
  @IsString()
  descriptionAm?: string | null;

  @IsOptional()
  @IsIn(['GOODS', 'SUPPLIES', 'SERVICE'])
  listingKind?: string;

  @IsOptional()
  @IsBoolean()
  sellEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  verticalCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameAm?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string | null;

  @IsOptional()
  @IsString()
  descriptionAm?: string | null;

  @IsOptional()
  @IsIn(['GOODS', 'SUPPLIES', 'SERVICE'])
  listingKind?: string;

  @IsOptional()
  @IsBoolean()
  sellEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  categoryCode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nameEn: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nameAm: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string | null;

  @IsOptional()
  @IsString()
  descriptionAm?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  defaultUnitCode?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'COMING_SOON', 'DISCONTINUED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'COMING_SOON' | 'DISCONTINUED';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nameAm?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string | null;

  @IsOptional()
  @IsString()
  descriptionAm?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  defaultUnitCode?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'COMING_SOON', 'DISCONTINUED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'COMING_SOON' | 'DISCONTINUED';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class CreateVarietyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nameEn: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nameAm: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class UpdateVarietyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nameAm?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

@Controller('admin/catalog')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminCatalogController {
  constructor(
    private readonly adminCatalog: AdminCatalogService,
    private readonly listingAttributes: ListingAttributesService,
  ) {}

  @Get('attribute-definitions')
  @RequirePermissions('catalog.read')
  listAttributeDefinitions(@Query('categoryCode') categoryCode?: string) {
    if (!categoryCode) return [];
    return this.listingAttributes.listDefinitionsByCategoryCode(categoryCode);
  }

  @Get('verticals')
  @RequirePermissions('catalog.read')
  listVerticals() {
    return this.adminCatalog.listVerticals();
  }

  @Patch('verticals/:code')
  @RequirePermissions('catalog.write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateVertical(@Param('code') code: string, @Body() dto: UpdateVerticalDto) {
    return this.adminCatalog.updateVertical(code, dto);
  }

  @Get('categories')
  @RequirePermissions('catalog.read')
  listCategories(@Query('verticalCode') verticalCode?: string) {
    return this.adminCatalog.listCategories({ verticalCode });
  }

  @Post('categories')
  @RequirePermissions('catalog.write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminCatalog.createCategory(dto);
  }

  @Patch('categories/:code')
  @RequirePermissions('catalog.write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateCategory(@Param('code') code: string, @Body() dto: UpdateCategoryDto) {
    return this.adminCatalog.updateCategory(code, dto);
  }

  @Get('products')
  @RequirePermissions('catalog.read')
  listProducts(@Query('categoryCode') categoryCode?: string) {
    return this.adminCatalog.listProducts({ categoryCode });
  }

  @Post('products')
  @RequirePermissions('catalog.write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createProduct(@Body() dto: CreateProductDto) {
    return this.adminCatalog.createProduct(dto);
  }

  @Patch('products/:code')
  @RequirePermissions('catalog.write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateProduct(@Param('code') code: string, @Body() dto: UpdateProductDto) {
    return this.adminCatalog.updateProduct(code, dto);
  }

  @Get('products/:code/varieties')
  @RequirePermissions('catalog.read')
  listVarieties(@Param('code') code: string) {
    return this.adminCatalog.listVarieties(code);
  }

  @Post('products/:code/varieties')
  @RequirePermissions('catalog.write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createVariety(@Param('code') code: string, @Body() dto: CreateVarietyDto) {
    return this.adminCatalog.createVariety(code, dto);
  }

  @Patch('products/:productCode/varieties/:varietyCode')
  @RequirePermissions('catalog.write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateVariety(
    @Param('productCode') productCode: string,
    @Param('varietyCode') varietyCode: string,
    @Body() dto: UpdateVarietyDto,
  ) {
    return this.adminCatalog.updateVariety(productCode, varietyCode, dto);
  }
}
