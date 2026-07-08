import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAddressDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  deliveryAddress: string;
}
