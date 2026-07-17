import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CoffeeGrade, ProcessMethod } from './create-listing.dto';

export type ListingSort = 'newest' | 'price_asc' | 'price_desc';

/**
 * B2 listing browse/search query.
 * Additive filters stay optional so older clients keep working.
 */
export class QueryListingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  productCode?: string;

  /** Seller (farmer_profiles.id) — active listings for Seller Profile. */
  @IsOptional()
  @IsUUID()
  farmerId?: string;

  /**
   * Keyword search across product, category, region, variety,
   * listing cooperative/station text, and seller name.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /** Free-text variety match (Browse variety chip). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  variety?: string;

  @IsOptional()
  @IsString()
  region?: string;

  /** Comma-separated origin names for multi-select filters. */
  @IsOptional()
  @IsString()
  regions?: string;

  @IsOptional()
  @IsEnum(CoffeeGrade)
  grade?: CoffeeGrade;

  /** Comma-separated grade codes for multi-select filters. */
  @IsOptional()
  @IsString()
  grades?: string;

  @IsOptional()
  @IsEnum(ProcessMethod)
  processMethod?: ProcessMethod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sort?: ListingSort = 'newest';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
