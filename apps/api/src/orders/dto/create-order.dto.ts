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

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  deliveryAddress: string;
}
