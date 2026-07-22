import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { QueryAuditEventsDto } from './dto/query-audit-events.dto';

@Controller('admin/audit')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('events')
  @RequirePermissions('audit.read')
  listEvents(@Query() query: QueryAuditEventsDto) {
    return this.audit.listEvents({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      action: query.action,
      actionPrefix: query.actionPrefix,
      outcome: query.outcome,
      actorUserId: query.actorUserId,
      targetType: query.targetType,
      targetId: query.targetId,
      requestId: query.requestId,
      permissionCode: query.permissionCode,
      from: query.from,
      to: query.to,
    });
  }

  @Get('events/export')
  @RequirePermissions('audit.export')
  exportEvents(
    @CurrentAdmin() admin: AdminRequestUser,
    @Query() query: QueryAuditEventsDto,
    @Req() req: Request,
  ) {
    return this.audit.exportCsv(
      admin,
      {
        page: 1,
        limit: 1000,
        action: query.action,
        actionPrefix: query.actionPrefix,
        outcome: query.outcome,
        actorUserId: query.actorUserId,
        targetType: query.targetType,
        targetId: query.targetId,
        requestId: query.requestId,
        permissionCode: query.permissionCode,
        from: query.from,
        to: query.to,
      },
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'] as string | undefined,
      },
    );
  }

  @Get('summary')
  @RequirePermissions('audit.read')
  summary(@Query('days') days?: string) {
    const n = days ? Number(days) : 7;
    return this.audit.summary(Number.isFinite(n) ? n : 7);
  }

  @Get('events/:id')
  @RequirePermissions('audit.read')
  getEvent(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.getEvent(id);
  }
}
