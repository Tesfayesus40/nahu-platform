import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EARNING_LEDGER_STATUSES } from '../shipment.domain.rules';

export class ListCourierEarningsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(['today', 'week', 'month'])
  period?: 'today' | 'week' | 'month';
}

export class ListAdminEarningsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsUUID()
  courierUserId?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @IsOptional()
  @IsIn([...EARNING_LEDGER_STATUSES])
  ledgerStatus?: (typeof EARNING_LEDGER_STATUSES)[number];

  @IsOptional()
  @IsString()
  q?: string;
}

export class SettlementReauthDto {
  @IsString()
  @MinLength(8)
  reauthPassword!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdjustEarningDto extends SettlementReauthDto {
  @Type(() => Number)
  @IsNumber()
  correctionAmount!: number;
}
