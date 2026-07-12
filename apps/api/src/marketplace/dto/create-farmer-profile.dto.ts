import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateFarmerProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  /** Father's name — stored as middle_name on the user record. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fathersName?: string;

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

  /** Comma-joined list of languages spoken, as sent by the mobile app's multi-select (e.g. "አማርኛ,ኦሮሚፋ"). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  primaryLanguage?: string;
}
