import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminFeatureFlagsController } from './admin-feature-flags.controller';
import { AdminReportingController } from './admin-reporting.controller';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminMonitoringController } from './admin-monitoring.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminSystemService } from './admin-system.service';
import { AdminFeatureFlagsService } from './admin-feature-flags.service';
import { AdminReportingService } from './admin-reporting.service';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminMonitoringService } from './admin-monitoring.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { OrdersModule } from '../orders/orders.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    MarketplaceModule,
    OrdersModule,
    DeliveryModule,
    AuditModule,
    IdentityModule,
  ],
  controllers: [
    AdminController,
    AdminFeatureFlagsController,
    AdminReportingController,
    AdminNotificationsController,
    AdminMonitoringController,
  ],
  providers: [
    AdminDashboardService,
    AdminSystemService,
    AdminFeatureFlagsService,
    AdminReportingService,
    AdminNotificationsService,
    AdminMonitoringService,
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [AdminNotificationsService, AdminMonitoringService],
})
export class AdminModule {}
