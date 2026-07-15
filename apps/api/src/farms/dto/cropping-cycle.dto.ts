import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
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
import { CroppingCycleStatus } from '@prisma/client';

export class CreateCycleLineDto {
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
  plannedQty: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unitCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedAreaHa?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCroppingCycleDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameAm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1990)
  @Max(2100)
  seasonYear: number;

  @IsString()
  @MaxLength(40)
  seasonCode: string;

  @IsISO8601({ strict: true })
  startsOn: string;

  @IsISO8601({ strict: true })
  endsOn: string;

  @IsOptional()
  @IsUUID()
  plotId?: string;

  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @IsOptional()
  @IsUUID()
  productionUnitId?: string;

  @IsOptional()
  @IsEnum(CroppingCycleStatus)
  status?: CroppingCycleStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCycleLineDto)
  lines?: CreateCycleLineDto[];
}

export class UpdateCroppingCycleDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameAm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1990)
  @Max(2100)
  seasonYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  seasonCode?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  startsOn?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  endsOn?: string;

  @IsOptional()
  @IsUUID()
  plotId?: string | null;

  @IsOptional()
  @IsUUID()
  fieldId?: string | null;

  @IsOptional()
  @IsUUID()
  productionUnitId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCycleLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  plannedQty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unitCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedAreaHa?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryCroppingCyclesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seasonYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  seasonCode?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
