import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListPromotionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'])
  status?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export class UpsertPromotionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'])
  status: string;

  @IsIn(['PLATFORM', 'CATEGORY', 'PRODUCT', 'LISTING', 'REGION'])
  scopeType: string;

  @IsOptional()
  @IsString()
  scopeRef?: string;

  @IsOptional()
  @IsIn(['PERCENT', 'FIXED_ETB'])
  discountType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discountValue?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListCooperativesQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  verified?: string;
}

export class UpdateCooperativeDto {
  @IsOptional()
  @IsString()
  verificationNotes?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  unionName?: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
