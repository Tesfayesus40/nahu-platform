import { IsEnum, IsString, Matches } from 'class-validator';

export enum RegistrationRole {
  FARMER = 'FARMER',
  BUYER = 'BUYER',
  /** Delivery Phase 1 (D1) — OTP onboarding; invitations deferred. */
  COURIER = 'COURIER',
}

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+251[0-9]{9}$/, {
    message: 'Phone must be Ethiopian format: +251XXXXXXXXX',
  })
  phone: string;

  @IsEnum(RegistrationRole)
  role: RegistrationRole;
}
