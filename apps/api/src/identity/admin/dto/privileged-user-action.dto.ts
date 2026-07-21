import { IsOptional, IsString, MinLength } from 'class-validator';

/** Privileged user mutation that only needs reauth (+ optional reason). */
export class PrivilegedUserActionDto {
  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
