import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DisputeActionDto {
  @IsIn([
    'START_REVIEW',
    'REQUEST_INFO',
    'REFUND',
    'RESOLVE',
    'REJECT',
    'CLOSE',
    'ESCALATE',
  ])
  action: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  resolutionCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  refundAmountEtb?: number;
}

export class DisputeAssignDto {
  @IsUUID()
  assigneeUserId: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkDisputeAssignDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  disputeIds: string[];

  @IsUUID()
  assigneeUserId: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class DisputeNoteDto {
  @IsString()
  @MinLength(1)
  body: string;

  @IsString()
  @MinLength(8)
  reauthPassword: string;
}

export class DisputeEvidenceDto {
  @IsString()
  @MinLength(1)
  label: string;

  @IsString()
  @MinLength(1)
  fileUrl: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}
