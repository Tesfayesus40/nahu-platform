import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class QueryProductsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryCode?: string;

  /** When true (default), only products with status ACTIVE are returned. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return true;
    if (value === 'false' || value === '0') return false;
    return value === true || value === 'true' || value === '1';
  })
  @IsBoolean()
  activeOnly?: boolean = true;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 1))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 20))
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
