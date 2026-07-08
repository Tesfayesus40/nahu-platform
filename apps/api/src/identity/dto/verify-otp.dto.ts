import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+251[0-9]{9}$/, {
    message: 'Phone must be Ethiopian format: +251XXXXXXXXX',
  })
  phone: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}
