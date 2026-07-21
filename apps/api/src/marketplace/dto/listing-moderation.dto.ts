import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ListingModerationDecisionDto {
  @IsIn(['APPROVE', 'REJECT', 'SUSPEND', 'FLAG', 'CLEAR_FLAG'])
  decision: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkListingModerationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  listingIds: string[];

  @IsIn(['APPROVE', 'REJECT', 'SUSPEND', 'FLAG', 'CLEAR_FLAG'])
  decision: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListingModeratorNoteDto {
  @IsString()
  @MinLength(1)
  notes: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;
}
