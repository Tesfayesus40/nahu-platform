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
    CatalogModule,
    FarmsModule,
    MarketplaceModule,
    CertificatesModule,
    OrdersModule,
    PaymentsModule,
    AdvisoryModule,
    UploadsModule,
    // Next modules land here, one per package: Logistics, Finance, etc.
  ],
})
export class AppModule {}
