import { Module } from '@nestjs/common';
import { AdminDeliveryController } from './admin-delivery.controller';
import { AdminDeliveryService } from './admin-delivery.service';
import { AdminDispatchController } from './admin-dispatch.controller';
import { CourierDeliveryController } from './courier-delivery.controller';
import { SellerDeliveryController } from './seller-delivery.controller';
import { BuyerDeliveryController } from './buyer-delivery.controller';
import { DeliveryConfigService } from './delivery-config.service';
import { ShipmentAggregateService } from './shipment-aggregate.service';
import { DispatchService } from './dispatch.service';
import { DeliveryExecutionService } from './delivery-execution.service';
import { DeliveryEventsPublisher } from './delivery-events.publisher';
import { AdminOpsService } from './admin-ops.service';
import { PartyDeliveryService } from './party-delivery.service';
import { ProofOfDeliveryService } from './proof-of-delivery.service';
import { SettlementService } from './settlement.service';
import { AdminSettlementController } from './admin-settlement.controller';
import {
  COURIER_SELECTION_STRATEGY,
  RuleBasedCourierSelectionStrategy,
} from './courier-selection.strategy';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [AuditModule, IdentityModule],
  controllers: [
    AdminDeliveryController,
    AdminDispatchController,
    AdminSettlementController,
    CourierDeliveryController,
    SellerDeliveryController,
    BuyerDeliveryController,
  ],
  providers: [
    AdminDeliveryService,
    AdminOpsService,
    PartyDeliveryService,
    ProofOfDeliveryService,
    SettlementService,
    DeliveryConfigService,
    ShipmentAggregateService,
    DispatchService,
    DeliveryExecutionService,
    DeliveryEventsPublisher,
    RuleBasedCourierSelectionStrategy,
    {
      provide: COURIER_SELECTION_STRATEGY,
      useExisting: RuleBasedCourierSelectionStrategy,
    },
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    AdminDeliveryService,
    AdminOpsService,
    PartyDeliveryService,
    ProofOfDeliveryService,
    SettlementService,
    DeliveryConfigService,
    ShipmentAggregateService,
    DispatchService,
    DeliveryExecutionService,
    DeliveryEventsPublisher,
  ],
})
export class DeliveryModule {}
