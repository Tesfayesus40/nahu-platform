import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AdminDisputesController } from './admin-disputes.controller';
import { AdminDisputesService } from './admin-disputes.service';
import { CertificatesModule } from '../certificates/certificates.module';
import { PaymentsModule } from '../payments/payments.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [
    CertificatesModule,
    PaymentsModule,
    InventoryModule,
    AuditModule,
    IdentityModule,
  ],
  controllers: [OrdersController, AdminDisputesController],
  providers: [
    OrdersService,
    AdminDisputesService,
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [OrdersService, AdminDisputesService],
})
export class OrdersModule {}
