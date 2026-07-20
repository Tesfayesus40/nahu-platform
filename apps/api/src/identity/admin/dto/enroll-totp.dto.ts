import { IsOptional, IsString, Length } from 'class-validator';

export class EnrollTotpDto {
  @IsString()
  enrollmentToken: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  label?: string;
}

export class ConfirmTotpDto {
  @IsString()
  enrollmentToken: string;

  @IsString()
  @Length(6, 8)
  totpCode: string;
}
