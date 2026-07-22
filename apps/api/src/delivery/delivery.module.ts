import { Module } from '@nestjs/common';
import { AdminDeliveryController } from './admin-delivery.controller';
import { AdminDeliveryService } from './admin-delivery.service';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [AuditModule, IdentityModule],
  controllers: [AdminDeliveryController],
  providers: [AdminDeliveryService, AdminAuthGuard, PermissionsGuard],
  exports: [AdminDeliveryService],
})
export class DeliveryModule {}
