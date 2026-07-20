import { IsString, MinLength } from 'class-validator';

/** Raw invitation token (not a JWT) used to begin MFA enrollment after bootstrap. */
export class BeginEnrollmentSessionDto {
  @IsString()
  @MinLength(32)
  token: string;
}
