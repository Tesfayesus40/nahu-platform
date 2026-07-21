import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [MarketplaceModule, OrdersModule],
  controllers: [AdminController],
  providers: [AdminAuthGuard, PermissionsGuard],
})
export class AdminModule {}
