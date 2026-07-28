import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { REFUND_REASONS } from '../payment-orchestration.rules';

export class AdminSettlePaymentDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsIn(['FARMER', 'COURIER', 'PLATFORM'], { each: true })
  parties?: Array<'FARMER' | 'COURIER' | 'PLATFORM'>;
}

export class AdminRefundPaymentDto {
  @IsIn([...REFUND_REASONS])
  reason!: (typeof REFUND_REASONS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountEtb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  refundGoodsEtb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  refundBuyerFeeEtb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  refundDeliveryEtb?: number;

  @IsOptional()
  @IsString()
  message?: string;
}

export class OrderIdParamDto {
  @IsUUID()
  orderId!: string;
}
