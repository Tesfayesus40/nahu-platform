import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const MUTABLE_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'LOCKED',
  'DEACTIVATED',
] as const;

export class UpdateUserStatusDto {
  @IsIn(MUTABLE_STATUSES)
  targetStatus: (typeof MUTABLE_STATUSES)[number];

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
