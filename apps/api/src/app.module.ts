import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { JwtConfigModule } from './common/jwt/jwt-config.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CertificatesModule } from './certificates/certificates.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AdvisoryModule } from './advisory/advisory.module';
import { UploadsModule } from './uploads/uploads.module';
import { CatalogModule } from './catalog/catalog.module';
import { FarmsModule } from './farms/farms.module';
import { InventoryModule } from './inventory/inventory.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { HarvestModule } from './farms/harvest.module';
import { FarmActivitiesModule } from './farms/farm-activities.module';
import { DeliveryModule } from './delivery/delivery.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    JwtConfigModule,
    HealthModule,
    IdentityModule,
    AuditModule,
    AdminModule,
    CatalogModule,
    FarmsModule,
    InventoryModule,
    WarehouseModule,
    HarvestModule,
    FarmActivitiesModule,
    MarketplaceModule,
    CertificatesModule,
    OrdersModule,
    PaymentsModule,
    DeliveryModule,
    AdvisoryModule,
    UploadsModule,
  ],
})
export class AppModule {}
