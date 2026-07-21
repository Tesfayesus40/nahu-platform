import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { SmsService } from './sms/sms.service';
import { AdminAuthController } from './admin/admin-auth.controller';
import { AdminAuthService } from './admin/admin-auth.service';
import {
  AdminRolesController,
  AdminUsersController,
} from './admin/admin-users.controller';
import { AdminUsersService } from './admin/admin-users.service';
import { AuditModule } from '../audit/audit.module';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [AuditModule],
  controllers: [
    IdentityController,
    AdminAuthController,
    AdminUsersController,
    AdminRolesController,
  ],
  providers: [
    IdentityService,
    SmsService,
    AdminAuthService,
    AdminUsersService,
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [IdentityService, AdminAuthService, AdminUsersService],
})
export class IdentityModule {}
