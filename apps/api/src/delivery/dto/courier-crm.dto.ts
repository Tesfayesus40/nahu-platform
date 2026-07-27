import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const VEHICLE_TYPES = [
  'MOTORCYCLE',
  'BICYCLE',
  'CAR',
  'VAN',
  'PICKUP',
  'TRUCK',
] as const;

export const PAYOUT_METHODS = [
  'BANK_ACCOUNT',
  'TELEBIRR',
  'CBE_BIRR',
  'CHAPA',
  'COMMERCIAL_BANK',
] as const;

export const DOCUMENT_TYPES = [
  'NATIONAL_ID',
  'DRIVING_LICENCE',
  'PASSPORT',
] as const;

export const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_SAY'] as const;

export class UpdateCourierProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsIn([...GENDERS])
  gender?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  emergencyContactPhone?: string;

  @IsOptional()
  @IsIn(['en', 'am'])
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  photoUrl?: string;
}

export class UpdateNotificationPrefsDto {
  @IsObject()
  prefs!: Record<string, boolean>;
}

export class UpsertVehicleDto {
  @IsIn([...VEHICLE_TYPES])
  vehicleType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1980)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  colour?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(40)
  plateNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registrationNumber?: string;

  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  photoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertPayoutAccountDto {
  @IsIn([...PAYOUT_METHODS])
  methodType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  accountName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class SubmitVerificationDto {
  @IsIn([...DOCUMENT_TYPES])
  documentType!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  documentNumber!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  frontImageUrl!: string;

  @ValidateIf((o) => o.documentType !== 'PASSPORT')
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  backImageUrl?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  selfieImageUrl!: string;
}

export class ListCourierNotificationsQueryDto {
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
  @IsIn(['true', 'false', '1', '0'])
  unreadOnly?: string;
}

export class ListCourierVerificationsQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: string;

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
}

export class RejectCourierVerificationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class CreateCourierAnnouncementDto {
  @IsIn(['ACCOUNT_MESSAGE', 'SYSTEM_ANNOUNCEMENT'])
  type!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titleEn!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titleAm!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  bodyEn!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  bodyAm!: string;

  @IsOptional()
  @IsString()
  courierUserId?: string;
}
