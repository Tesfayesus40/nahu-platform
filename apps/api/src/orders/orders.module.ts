import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { BuyerConfirmService } from './buyer-confirm.service';
import { AdminDisputesController } from './admin-disputes.controller';
import { AdminDisputesService } from './admin-disputes.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { CertificatesModule } from '../certificates/certificates.module';
import { PaymentsModule } from '../payments/payments.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [
    CertificatesModule,
    PaymentsModule,
    InventoryModule,
    AuditModule,
    IdentityModule,
    DeliveryModule,
    PricingModule,
  ],
  controllers: [
    OrdersController,
    AdminDisputesController,
    AdminOrdersController,
  ],
  providers: [
    OrdersService,
    BuyerConfirmService,
    AdminDisputesService,
    AdminOrdersService,
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    OrdersService,
    BuyerConfirmService,
    AdminDisputesService,
    AdminOrdersService,
  ],
})
export class OrdersModule {}
