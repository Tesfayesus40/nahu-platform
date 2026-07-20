import { IsOptional, IsString, IsUUID } from 'class-validator';

export class LogoutAllDto {
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
