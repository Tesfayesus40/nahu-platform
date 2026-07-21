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
import { AdminListingModerationService } from './admin-listing-moderation.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { ListModerationQueryDto } from './dto/list-moderation-query.dto';
import {
  BulkListingModerationDto,
  ListingModerationDecisionDto,
  ListingModeratorNoteDto,
} from './dto/listing-moderation.dto';

@Controller('admin/listings')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminListingModerationController {
  constructor(private readonly moderation: AdminListingModerationService) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get()
  @RequirePermissions('marketplace.listings.read')
  list(@Query() query: ListModerationQueryDto) {
    return this.moderation.list(query);
  }

  @Get(':id')
  @RequirePermissions('marketplace.listings.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderation.get(id);
  }

  @Post('moderation/bulk')
  @RequirePermissions('marketplace.listings.moderate')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  bulk(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: BulkListingModerationDto,
    @Req() req: Request,
  ) {
    return this.moderation.bulkDecide(admin, dto, this.meta(req));
  }

  @Post(':id/moderation-decisions')
  @RequirePermissions('marketplace.listings.moderate')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  decide(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ListingModerationDecisionDto,
    @Req() req: Request,
  ) {
    return this.moderation.decide(admin, id, dto, this.meta(req));
  }

  @Post(':id/moderation-notes')
  @RequirePermissions('marketplace.listings.moderate')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  note(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ListingModeratorNoteDto,
    @Req() req: Request,
  ) {
    return this.moderation.addNote(admin, id, dto, this.meta(req));
  }
}
