import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  roleCodes: string[];

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
