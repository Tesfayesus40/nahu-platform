import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export enum PaymentMethod {
  TELEBIRR = 'TELEBIRR',
  CBE_BIRR = 'CBE_BIRR',
}

export class CreateOrderDto {
  @IsUUID()
  listingId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(5000)
  quantityKg: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  deliveryAddress: string;
}
