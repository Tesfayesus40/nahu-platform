import {
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class AdminDispatchShipmentDto {
  @IsString()
  @MinLength(8)
  reauthPassword!: string;

  /** Omit to auto-select via rule-based strategy. */
  @IsOptional()
  @IsUUID()
  courierUserId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminUnassignShipmentDto {
  @IsString()
  @MinLength(8)
  reauthPassword!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminReleaseShipmentDto {
  @IsString()
  @MinLength(8)
  reauthPassword!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
