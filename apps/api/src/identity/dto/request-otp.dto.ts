import { IsEnum, IsString, Matches } from 'class-validator';

export enum RegistrationRole {
  FARMER = 'FARMER',
  BUYER = 'BUYER',
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
