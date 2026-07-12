import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CertificatesModule } from '../certificates/certificates.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [CertificatesModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
