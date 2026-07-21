import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListModerationQueryDto {
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
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'FLAGGED'])
  moderationStatus?: string;

  /** pending = PENDING|FLAGGED unless moderationStatus set */
  @IsOptional()
  @IsIn(['pending', 'all'])
  queue?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'RESERVED', 'SOLD', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
