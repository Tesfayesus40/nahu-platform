import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum PaymentMethod {
  TELEBIRR = 'TELEBIRR',
  CBE_BIRR = 'CBE_BIRR',
  MPESA = 'MPESA',
  CHAPA = 'CHAPA',
  SANTIMPAY = 'SANTIMPAY',
}

export enum DeliveryMethod {
  NAHU_COURIER = 'NAHU_COURIER',
  SELLER_DELIVERY = 'SELLER_DELIVERY',
  CUSTOMER_PICKUP = 'CUSTOMER_PICKUP',
}

export class CreateOrderDto {
  @IsUUID()
  listingId: string;

  /** Modern unit-aware quantity (G1/B1). Use with optional unitCode. */
  @ValidateIf((o) => o.quantityKg === undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1_000_000)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unitCode?: string;

  /** Legacy kg quantity — dual-written when modern quantity omitted. */
  @ValidateIf((o) => o.quantity === undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(5000)
  quantityKg?: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  /**
   * Required for NAHU_COURIER when deliveryAddressId is omitted.
   * When deliveryAddressId is set, may be omitted (auto-filled from saved address).
   */
  @ValidateIf(
    (o) =>
      !o.deliveryAddressId &&
      (o.deliveryMethod === undefined ||
        o.deliveryMethod === DeliveryMethod.NAHU_COURIER),
  )
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  deliveryAddress?: string;

  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

  @IsOptional()
  @IsEnum(DeliveryMethod)
  deliveryMethod?: DeliveryMethod;

  /** Required when delivery.dynamic_fee.enabled and deliveryMethod is NAHU_COURIER. */
  @IsOptional()
  @IsUUID()
  deliveryQuoteId?: string;
}
