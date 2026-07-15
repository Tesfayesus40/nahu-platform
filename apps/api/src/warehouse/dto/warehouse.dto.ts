import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { WarehouseSiteStatus } from '@prisma/client';

export class CreateOnFarmSiteDto {
  @IsUUID()
  farmId: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameAm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  regionEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  zone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  woreda?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  kebele?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  centroidLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  centroidLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  capacityUnitCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStorageSiteDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameAm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsEnum(WarehouseSiteStatus)
  status?: WarehouseSiteStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  regionEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  zone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  woreda?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  kebele?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  centroidLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  centroidLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  capacityUnitCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryStorageSitesDto {
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
