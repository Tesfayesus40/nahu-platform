import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CoffeeGrade, ProcessMethod } from './create-listing.dto';

export type ListingSort = 'newest' | 'price_asc' | 'price_desc';

export class QueryListingsDto {
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
