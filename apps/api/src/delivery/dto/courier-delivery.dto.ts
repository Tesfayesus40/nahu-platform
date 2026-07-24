import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateCourierAvailabilityDto {
  @IsString()
  availability!: string;
}

export class RejectShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ExecutionNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** D10 — POD capture payload for ARRIVED → DELIVERED. */
export class MarkDeliveredDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  otpCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipientName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accuracyM?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  stopId?: string;
}

const QUEUE_SECTIONS = [
  'available',
  'accepted',
  'active',
  'completed_today',
  'failed',
  'returned',
] as const;

export class ListCourierShipmentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn([...QUEUE_SECTIONS])
  section?: (typeof QUEUE_SECTIONS)[number];

  @IsOptional()
  @IsString()
  status?: string;
}
