import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignCourierDto {
  @IsOptional()
  @IsUUID()
  courierUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  timeoutMinutes?: number;
}

export class ConfirmPickupDto {
  @IsIn(['SELLER', 'COURIER'])
  party!: 'SELLER' | 'COURIER';
}

export class ConfirmDeliveryDto {
  @IsIn(['BUYER', 'COURIER'])
  party!: 'BUYER' | 'COURIER';
}

export class TimeoutReassignDto {
  @IsOptional()
  autoReassign?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
