import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import {
  AdminPaymentOrchestrationController,
  PaymentOrchestrationController,
} from './payment-orchestration.controller';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import { EscrowService } from './escrow.service';
import { SettlementOrchestratorService } from './settlement-orchestrator.service';
import { RefundOrchestrationService } from './refund-orchestration.service';
import { PaymentProviderRegistry } from './providers/provider.registry';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [PrismaModule, PricingModule, IdentityModule],
  controllers: [
    PaymentsController,
    PaymentOrchestrationController,
    AdminPaymentOrchestrationController,
  ],
  providers: [
    PaymentsService,
    PaymentProviderRegistry,
    EscrowService,
    SettlementOrchestratorService,
    RefundOrchestrationService,
    PaymentOrchestrationService,
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    PaymentsService,
    PaymentOrchestrationService,
    EscrowService,
    SettlementOrchestratorService,
    RefundOrchestrationService,
    PaymentProviderRegistry,
  ],
})
export class PaymentsModule {}
