import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateFarmerProfileDto {
  @IsString()
  @MaxLength(100)
  region: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  zone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  woreda?: string;

  @IsOptional()
  @IsUUID()
  cooperativeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6000)
  altitudeM?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  farmSizeHa?: number;
}
