import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AdminAuthGuard, PermissionsGuard],
  exports: [AuditService],
})
export class AuditModule {}
