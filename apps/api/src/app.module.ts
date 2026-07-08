import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { JwtConfigModule } from './common/jwt/jwt-config.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CertificatesModule } from './certificates/certificates.module';
import { OrdersModule } from './orders/orders.module';
import { AdvisoryModule } from './advisory/advisory.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    JwtConfigModule,
    HealthModule,
    IdentityModule,
    MarketplaceModule,
    CertificatesModule,
    OrdersModule,
    AdvisoryModule,
    // Next modules land here, one per package: Logistics, Finance, etc.
  ],
})
export class AppModule {}
