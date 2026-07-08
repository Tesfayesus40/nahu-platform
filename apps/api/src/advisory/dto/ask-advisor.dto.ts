import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AskAdvisorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  language?: string = 'amharic';
}
