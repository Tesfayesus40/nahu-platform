import { IsString, MinLength } from 'class-validator';

export class AddReviewerNoteDto {
  @IsString()
  @MinLength(1)
  notes: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;
}
