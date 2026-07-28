import { Module } from '@nestjs/common';
import {
  AdminOpsMarketplaceController,
  AdminSellersController,
} from './admin-ops.controller';
import { OpsMarketplaceService } from './ops-marketplace.service';
import { OpsOrderInspectionService } from './ops-order-inspection.service';
import { OpsCourierPaymentService } from './ops-courier-payment.service';
import { AdminSellerOpsService } from './admin-seller-ops.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { IdentityModule } from '../identity/identity.module';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    DeliveryModule,
    IdentityModule,
  ],
  controllers: [AdminOpsMarketplaceController, AdminSellersController],
  providers: [
    OpsMarketplaceService,
    OpsOrderInspectionService,
    OpsCourierPaymentService,
    AdminSellerOpsService,
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    OpsMarketplaceService,
    OpsOrderInspectionService,
    AdminSellerOpsService,
  ],
})
export class OpsModule {}
