import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { OPS_BUCKETS } from '../admin-ops.rules';
import { SHIPMENT_STATUSES } from '../shipment.domain.rules';

const SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'currentStatus',
  'assignedAt',
] as const;
const SORT_ORDERS = ['asc', 'desc'] as const;

export class ListShipmentsQueryDto {
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
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...SHIPMENT_STATUSES])
  status?: (typeof SHIPMENT_STATUSES)[number];

  @IsOptional()
  @IsIn([...OPS_BUCKETS])
  bucket?: (typeof OPS_BUCKETS)[number];

  @IsOptional()
  @IsUUID()
  courierUserId?: string;

  @IsOptional()
  @IsUUID()
  fulfillmentId?: string;

  @IsOptional()
  @IsIn([...SORT_FIELDS])
  sort?: (typeof SORT_FIELDS)[number];

  @IsOptional()
  @IsIn([...SORT_ORDERS])
  order?: (typeof SORT_ORDERS)[number];

  /** Age filter in hours (updatedAt <= now - staleHours). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  staleHours?: number;
}

export class ListCouriersQueryDto {
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
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  availability?: string;
}

export class AdminCancelShipmentDto {
  @IsString()
  @MinLength(8)
  reauthPassword!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminRetryShipmentDto {
  @IsString()
  @MinLength(8)
  reauthPassword!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminBulkShipmentsDto {
  @IsString()
  @MinLength(8)
  reauthPassword!: string;

  @IsIn(['cancel', 'retry'])
  action!: 'cancel' | 'retry';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  shipmentIds!: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}
