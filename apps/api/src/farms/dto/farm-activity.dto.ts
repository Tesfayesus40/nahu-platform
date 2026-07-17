import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const ACTIVITY_STATUSES = ['PLANNED', 'COMPLETED', 'CANCELLED', 'all'] as const;

export class QueryFarmActivitiesDto {
  @IsOptional()
  @IsIn(ACTIVITY_STATUSES)
  status?: (typeof ACTIVITY_STATUSES)[number] = 'all';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  activityTypeCode?: string;

  @IsOptional()
  @IsUUID()
  plotId?: string;

  @IsOptional()
  @IsUUID()
  croppingCycleId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  fromDate?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  toDate?: string;
}

export class CreateFarmActivityDto {
  @IsString()
  @MaxLength(40)
  activityTypeCode: string;

  @IsOptional()
  @IsIn(['PLANNED', 'COMPLETED'])
  status?: 'PLANNED' | 'COMPLETED';

  @IsOptional()
  @IsUUID()
  plotId?: string;

  @IsOptional()
  @IsUUID()
  croppingCycleId?: string;

  @IsOptional()
  @IsUUID()
  harvestSessionId?: string;

  @ValidateIf((o) => (o.status ?? 'COMPLETED') === 'COMPLETED')
  @IsISO8601({ strict: true })
  occurredOn?: string;

  @ValidateIf((o) => o.status === 'PLANNED')
  @IsISO8601({ strict: true })
  scheduledOn?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  measureQty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  measureUnitCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaHa?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  productCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  crewCount?: number;
}

export class UpdateFarmActivityDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  activityTypeCode?: string;

  @IsOptional()
  @IsIn(['PLANNED', 'COMPLETED', 'CANCELLED'])
  status?: 'PLANNED' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsUUID()
  plotId?: string | null;

  @IsOptional()
  @IsUUID()
  croppingCycleId?: string | null;

  @IsOptional()
  @IsUUID()
  harvestSessionId?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  occurredOn?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  scheduledOn?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  measureQty?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  measureUnitCode?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaHa?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  productCode?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  crewCount?: number | null;
}
