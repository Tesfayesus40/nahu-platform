import { IsOptional, IsString, MinLength } from 'class-validator';

export class AddVerificationDocumentDto {
  @IsString()
  @MinLength(1)
  label: string;

  /** Secure URL or same-origin /uploads/files/... reference. */
  @IsString()
  @MinLength(1)
  fileUrl: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}
