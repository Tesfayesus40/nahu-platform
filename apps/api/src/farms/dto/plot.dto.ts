import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FarmStatus, TenureType } from '@prisma/client';

export class CreatePlotDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameAm?: string;

  @IsOptional()
  @IsEnum(TenureType)
  tenureType?: TenureType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sizeHa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  centroidLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  centroidLng?: number;

  @IsOptional()
  @IsObject()
  boundaryGeojson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  boundarySource?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePlotDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameAm?: string;

  @IsOptional()
  @IsEnum(TenureType)
  tenureType?: TenureType;

  @IsOptional()
  @IsEnum(FarmStatus)
  status?: FarmStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sizeHa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  centroidLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  centroidLng?: number;

  @IsOptional()
  @IsObject()
  boundaryGeojson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  boundarySource?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
