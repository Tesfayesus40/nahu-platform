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
import { AdminDisputesService } from './admin-disputes.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto';
import {
  BulkDisputeAssignDto,
  DisputeActionDto,
  DisputeAssignDto,
  DisputeEvidenceDto,
  DisputeNoteDto,
} from './dto/dispute-action.dto';

@Controller('admin/disputes')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminDisputesController {
  constructor(private readonly disputes: AdminDisputesService) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get()
  @RequirePermissions('orders.disputes.read')
  list(
    @CurrentAdmin() admin: AdminRequestUser,
    @Query() query: ListDisputesQueryDto,
  ) {
    return this.disputes.list(admin, query);
  }

  @Get(':id')
  @RequirePermissions('orders.disputes.read')
  get(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.disputes.get(admin, id);
  }

  @Post('assign/bulk')
  @RequirePermissions('orders.disputes.manage')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  bulkAssign(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: BulkDisputeAssignDto,
    @Req() req: Request,
  ) {
    return this.disputes.bulkAssign(admin, dto, this.meta(req));
  }

  @Post(':id/actions')
  @RequirePermissions('orders.disputes.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  action(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeActionDto,
    @Req() req: Request,
  ) {
    return this.disputes.applyAction(admin, id, dto, this.meta(req));
  }

  @Post(':id/assign')
  @RequirePermissions('orders.disputes.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  assign(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeAssignDto,
    @Req() req: Request,
  ) {
    return this.disputes.assign(admin, id, dto, this.meta(req));
  }

  @Post(':id/notes')
  @RequirePermissions('orders.disputes.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  note(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeNoteDto,
    @Req() req: Request,
  ) {
    return this.disputes.addNote(admin, id, dto, this.meta(req));
  }

  @Post(':id/evidence')
  @RequirePermissions('orders.disputes.manage')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  evidence(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeEvidenceDto,
    @Req() req: Request,
  ) {
    return this.disputes.addEvidence(admin, id, dto, this.meta(req));
  }
}
