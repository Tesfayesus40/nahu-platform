import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { LotSourceType, LotStatus, MovementType } from '@prisma/client';

export class ReceiveStockDto {
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  plotId?: string;

  @IsString()
  @MaxLength(80)
  productCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  varietyCode?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unitCode?: string;

  @IsOptional()
  @IsEnum(LotSourceType)
  sourceType?: LotSourceType;

  @IsOptional()
  @IsISO8601({ strict: true })
  harvestDate?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  expiresOn?: string;

  @IsOptional()
  @IsString()
  qualityNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  storageLabel?: string;

  @IsOptional()
  @IsUUID()
  storageSiteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lotCode?: string;

  @IsOptional()
  @IsBoolean()
  quarantine?: boolean;
}

export type MovementCommand =
  | 'ADJUST_IN'
  | 'ADJUST_OUT'
  | 'LOSS'
  | 'TRANSFER_OUT';

export class CreateMovementDto {
  @IsUUID()
  lotId: string;

  @IsEnum(MovementType)
  type: MovementType;

  /** Optional for RELOCATE (defaults to 0). Required-positive for other types. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unitCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Required when type is TRANSFER_OUT */
  @IsOptional()
  @IsUUID()
  toFarmId?: string;

  @IsOptional()
  @IsUUID()
  toPlotId?: string;

  /** Required when type is RELOCATE */
  @IsOptional()
  @IsUUID()
  toStorageSiteId?: string;
}

export class QueryLotsDto {
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @IsOptional()
  @IsUUID()
  storageSiteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  productCode?: string;

  @IsOptional()
  @IsEnum(LotStatus)
  status?: LotStatus;

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

export class QueryBalancesDto {
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @IsOptional()
  @IsUUID()
  storageSiteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  productCode?: string;
}
