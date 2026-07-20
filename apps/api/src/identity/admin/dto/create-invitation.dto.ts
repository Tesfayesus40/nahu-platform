import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\+251[0-9]{9}$/, {
    message: 'Phone must be Ethiopian format: +251XXXXXXXXX',
  })
  phone: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleCodes: string[];

  /** Recent re-auth: current password required for invite create. */
  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
