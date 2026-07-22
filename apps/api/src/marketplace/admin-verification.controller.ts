import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminVerificationService } from './admin-verification.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequireAnyPermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { adminRequestMeta } from '../common/admin/admin-request-meta';
import { ListVerificationQueryDto } from './dto/list-verification-query.dto';
import { VerificationDecisionDto } from './dto/verification-decision.dto';
import { AddVerificationDocumentDto } from './dto/add-verification-document.dto';
import { AddReviewerNoteDto } from './dto/add-reviewer-note.dto';

const VERIFY_ANY = [
  'farmers.verify',
  'buyers.verify',
  'marketplace.merchants.verify',
  'identity.organizations.verify',
] as const;

@Controller('admin/verification')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminVerificationController {
  constructor(private readonly verification: AdminVerificationService) {}

  @Get('cases')
  @RequireAnyPermissions('verification.read', ...VERIFY_ANY)
  list(
    @CurrentAdmin() admin: AdminRequestUser,
    @Query() query: ListVerificationQueryDto,
  ) {
    return this.verification.listCases(admin, query);
  }

  @Get('cases/:id')
  @RequireAnyPermissions('verification.read', ...VERIFY_ANY)
  get(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.verification.getCase(admin, id);
  }

  @Post('cases/:id/decisions')
  @RequireAnyPermissions(...VERIFY_ANY)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  decide(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerificationDecisionDto,
    @Req() req: Request,
  ) {
    return this.verification.decide(admin, id, dto, adminRequestMeta(req));
  }

  @Post('cases/:id/notes')
  @RequireAnyPermissions(...VERIFY_ANY)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  addNote(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddReviewerNoteDto,
    @Req() req: Request,
  ) {
    return this.verification.addNote(admin, id, dto, adminRequestMeta(req));
  }

  @Post('cases/:id/documents')
  @RequireAnyPermissions(...VERIFY_ANY)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  addDocument(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddVerificationDocumentDto,
    @Req() req: Request,
  ) {
    return this.verification.addDocument(admin, id, dto, adminRequestMeta(req));
  }
}
