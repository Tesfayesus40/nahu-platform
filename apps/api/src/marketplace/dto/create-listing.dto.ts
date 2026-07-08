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
  Max,
  MaxLength,
  Min,
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
}

export class CreateListingDto {
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

  @IsEnum(ProcessMethod)
  processMethod: ProcessMethod;

  @IsEnum(CoffeeGrade)
  grade: CoffeeGrade;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  variety?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(5000)
  quantityKg: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(10000)
  pricePerKg: number;

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
