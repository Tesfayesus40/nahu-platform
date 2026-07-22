import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class LogoutAllDto {
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;
}
