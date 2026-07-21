import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListVerificationQueryDto {
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
  @IsIn(['FARMER', 'BUYER', 'MERCHANT', 'ORGANIZATION'])
  subjectType?: string;

  @IsOptional()
  @IsIn([
    'PENDING',
    'IN_REVIEW',
    'NEEDS_INFO',
    'APPROVED',
    'REJECTED',
    'SUSPENDED',
  ])
  status?: string;

  /** When `pending`, restricts to PENDING | IN_REVIEW | NEEDS_INFO unless status set. */
  @IsOptional()
  @IsIn(['pending', 'all'])
  queue?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
