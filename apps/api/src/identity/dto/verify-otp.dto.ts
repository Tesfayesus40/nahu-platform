import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { RegistrationRole } from './request-otp.dto';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+251[0-9]{9}$/, {
    message: 'Phone must be Ethiopian format: +251XXXXXXXXX',
  })
  phone: string;

  @IsString()
  @Length(6, 6)
  otp: string;

  /** App that initiated login — JWT role matches this when the user has that role. */
  @IsOptional()
  @IsEnum(RegistrationRole)
  role?: RegistrationRole;
}
