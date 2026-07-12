import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  /** Father's name — stored as middle_name in the database. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fathersName?: string;
}
