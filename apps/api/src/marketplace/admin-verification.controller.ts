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
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { ListVerificationQueryDto } from './dto/list-verification-query.dto';
import { VerificationDecisionDto } from './dto/verification-decision.dto';
import { AddVerificationDocumentDto } from './dto/add-verification-document.dto';
import { AddReviewerNoteDto } from './dto/add-reviewer-note.dto';

@Controller('admin/verification')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminVerificationController {
  constructor(private readonly verification: AdminVerificationService) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get('cases')
  @RequirePermissions('verification.read')
  list(
    @CurrentAdmin() admin: AdminRequestUser,
    @Query() query: ListVerificationQueryDto,
  ) {
    return this.verification.listCases(admin, query);
  }

  @Get('cases/:id')
  @RequirePermissions('verification.read')
  get(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.verification.getCase(admin, id);
  }

  @Post('cases/:id/decisions')
  @RequirePermissions('verification.read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  decide(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerificationDecisionDto,
    @Req() req: Request,
  ) {
    // Subject-specific decide permission enforced in service.
    return this.verification.decide(admin, id, dto, this.meta(req));
  }

  @Post('cases/:id/notes')
  @RequirePermissions('verification.read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  addNote(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddReviewerNoteDto,
    @Req() req: Request,
  ) {
    return this.verification.addNote(admin, id, dto, this.meta(req));
  }

  @Post('cases/:id/documents')
  @RequirePermissions('verification.read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  addDocument(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddVerificationDocumentDto,
    @Req() req: Request,
  ) {
    return this.verification.addDocument(admin, id, dto, this.meta(req));
  }
}
