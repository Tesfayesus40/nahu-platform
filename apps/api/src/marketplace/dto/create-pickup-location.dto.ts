import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum PickupLocationKind {
  FARM = 'FARM',
  WAREHOUSE = 'WAREHOUSE',
  COLLECTION_CENTRE = 'COLLECTION_CENTRE',
  OTHER = 'OTHER',
}

export class CreatePickupLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  addressText: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  landmark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(PickupLocationKind)
  locationKind?: PickupLocationKind;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  googlePlaceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  formattedAddress?: string;
}
