import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class VerifyMfaDto {
  @IsString()
  mfaToken: string;

  @IsOptional()
  @IsString()
  @Length(6, 8)
  totpCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  recoveryCode?: string;
}
