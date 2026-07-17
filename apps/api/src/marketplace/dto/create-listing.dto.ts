import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export enum ProcessMethod {
  WASHED = 'WASHED',
  NATURAL = 'NATURAL',
  HONEY = 'HONEY',
  SEMI_WASHED = 'SEMI_WASHED',
  HULLED = 'HULLED',
  ANAEROBIC = 'ANAEROBIC',
  CARBONIC_MACERATION = 'CARBONIC_MACERATION',
}

export enum CoffeeGrade {
  GRADE_1 = 'GRADE_1',
  GRADE_2 = 'GRADE_2',
  GRADE_3 = 'GRADE_3',
  GRADE_4 = 'GRADE_4',
  GRADE_5 = 'GRADE_5',
  GRADE_6 = 'GRADE_6',
  GRADE_7 = 'GRADE_7',
  GRADE_8 = 'GRADE_8',
  GRADE_9 = 'GRADE_9',
  GRADE_UNKNOWN = 'GRADE_UNKNOWN',
}

export class CreateListingDto {
  /** Defaults to COFFEE when omitted — preserves legacy mobile app behaviour. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryCode?: string;

  /** Optional product code; defaults to the category's default ACTIVE product. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  productCode?: string;

  /** Optional Phase 4.4 bind — reserve this lot for the listing qty. */
  @IsOptional()
  @IsUUID()
  stockLotId?: string;

  @IsString()
  @MaxLength(100)
  region: string;

  /** English name of the region/origin, alongside the Amharic `region`. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  regionEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  washingStation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cooperative?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  woreda?: string;

  /**
   * Coffee extension — required when resolved category is COFFEE.
   * Prefer qualityGrade for new clients; grade remains for legacy.
   */
  @ValidateIf((o) => o.qualityGrade === undefined)
  @IsEnum(CoffeeGrade)
  grade?: CoffeeGrade;

  /** Generic quality grade alias (maps to listing.grade). */
  @ValidateIf((o) => o.grade === undefined)
  @IsEnum(CoffeeGrade)
  qualityGrade?: CoffeeGrade;

  /** Coffee extension — required when resolved category is COFFEE. */
  @IsOptional()
  @IsEnum(ProcessMethod)
  processMethod?: ProcessMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  variety?: string;

  /** Canonical quantity (G1). Use with unitCode + pricePerUnit. */
  @ValidateIf((o) => o.quantityKg === undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1_000_000)
  quantity?: number;

  @ValidateIf((o) => o.quantityKg === undefined)
  @IsString()
  @MaxLength(20)
  unitCode?: string;

  @ValidateIf((o) => o.pricePerKg === undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1_000_000)
  pricePerUnit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  packagingLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(1_000_000)
  packagingQuantity?: number;

  /** Legacy kg quantity — dual-written to quantity/unitCode=KG when modern fields omitted. */
  @ValidateIf((o) => o.quantity === undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(5000)
  quantityKg?: number;

  @ValidateIf((o) => o.pricePerUnit === undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(10000)
  pricePerKg?: number;

  /** Format: YYYY-MM-DD */
  @IsISO8601({ strict: true })
  harvestDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(500)
  @Max(4000)
  altitudeM?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(60)
  @Max(100)
  cupScore?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  photoUrls?: string[] = [];
}
