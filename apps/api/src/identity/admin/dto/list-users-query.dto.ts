import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const USER_STATUSES = [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'LOCKED',
  'DEACTIVATED',
] as const;

const SORT_FIELDS = ['createdAt', 'email', 'status', 'updatedAt'] as const;
const SORT_ORDERS = ['asc', 'desc'] as const;

export class ListUsersQueryDto {
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
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: (typeof USER_STATUSES)[number];

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort?: (typeof SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: (typeof SORT_ORDERS)[number];
}
