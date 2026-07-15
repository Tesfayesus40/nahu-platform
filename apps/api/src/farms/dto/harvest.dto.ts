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
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class HarvestLineInputDto {
  @IsString()
  @MaxLength(80)
  productCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  varietyCode?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unitCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  moisturePct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  harvestGradeClass?: string;

  @IsOptional()
  @IsString()
  qualityNote?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsUUID()
  storageSiteId?: string;

  @IsOptional()
  @IsUUID()
  croppingCycleLineId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateHarvestSessionDto {
  @IsISO8601({ strict: true })
  harvestedOn: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  harvestedAt?: string;

  @IsOptional()
  @IsUUID()
  plotId?: string;

  @IsOptional()
  @IsUUID()
  croppingCycleId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  crewCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HarvestLineInputDto)
  lines?: HarvestLineInputDto[];
}

export class UpdateHarvestSessionDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  harvestedOn?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  harvestedAt?: string;

  @IsOptional()
  @IsUUID()
  plotId?: string | null;

  @IsOptional()
  @IsUUID()
  croppingCycleId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  crewCount?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}

export class QueryHarvestSessionsDto {
  @IsOptional()
  @IsIn(['DRAFT', 'POSTED', 'all'])
  status?: 'DRAFT' | 'POSTED' | 'all';

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
