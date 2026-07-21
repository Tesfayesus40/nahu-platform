import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class VerificationDecisionDto {
  @IsIn([
    'APPROVE',
    'REJECT',
    'REQUEST_INFO',
    'SUSPEND',
    'START_REVIEW',
  ])
  decision: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
