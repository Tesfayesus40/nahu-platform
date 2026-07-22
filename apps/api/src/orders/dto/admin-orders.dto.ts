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

export class ListOrdersQueryDto {
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
  status?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  /** pending_payment | stalled_escrow | all */
  @IsOptional()
  @IsIn(['pending_payment', 'stalled_escrow', 'all'])
  queue?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export class OrderAdminActionDto {
  @IsIn([
    'CONFIRM_PAYMENT_SIMULATION',
    'CANCEL_UNPAID',
    'START_FULFILLMENT',
    'MARK_SHIPPED',
    'MARK_DELIVERED',
    'COMPLETE_ORDER',
  ])
  action: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class OrderAdminNoteDto {
  @IsString()
  @MinLength(1)
  body: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;
}
