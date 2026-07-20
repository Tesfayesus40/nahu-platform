import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
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
    });
  }
}
