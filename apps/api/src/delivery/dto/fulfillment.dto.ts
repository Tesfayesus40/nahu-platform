import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListFulfillmentQueryDto {
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
  @IsIn([
    'PENDING_HANDOFF',
    'READY',
    'IN_TRANSIT',
    'DELIVERED',
    'EXCEPTION',
    'CLOSED',
  ])
  status?: string;

  @IsOptional()
  @IsIn(['open', 'exceptions', 'all'])
  queue?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export class FulfillmentActionDto {
  @IsIn([
    'MARK_READY',
    'MARK_IN_TRANSIT',
    'MARK_DELIVERED',
    'RAISE_EXCEPTION',
    'CLOSE',
    'ASSIGN',
    'UPDATE_LOGISTICS',
  ])
  action: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsString()
  carrierCode?: string;

  @IsOptional()
  @IsString()
  trackingRef?: string;

  @IsOptional()
  @IsString()
  pickupNotes?: string;

  @IsOptional()
  @IsString()
  deliveryNotes?: string;

  @IsOptional()
  @IsString()
  exceptionCode?: string;
}
