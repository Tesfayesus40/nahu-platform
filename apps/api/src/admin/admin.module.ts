import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  controllers: [AdminController],
  providers: [AdminAuthGuard, PermissionsGuard],
})
export class AdminModule {}
