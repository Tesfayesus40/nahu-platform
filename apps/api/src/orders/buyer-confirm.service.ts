import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';
import { ShipmentAggregateService } from '../delivery/shipment-aggregate.service';
import { DeliveryEventsPublisher } from '../delivery/delivery-events.publisher';
import { SettlementService } from '../delivery/settlement.service';
import { PaymentRailsService } from '../pricing/payment-rails.service';
import { PaymentOrchestrationService } from '../payments/payment-orchestration.service';
import {
  ACTIVE_OUTBOUND_STATUSES,
  ShipmentStatus,
} from '../delivery/shipment.domain.rules';
import {
  BuyerConfirmDomainError,
  canConfirmDelivery,
  planBuyerConfirm,
} from './buyer-confirm.rules';

type Tx = Prisma.TransactionClient;

export type BuyerConfirmActor = {
  userId: string;
  kind: 'BUYER' | 'ADMIN';
};

/**
 * Shared AD-1 confirmation orchestration for buyer confirm-delivery
 * and Admin COMPLETE_ORDER.
 *
 * Shipment closeout always records BUYER_CONFIRMED as its own transition
 * before COMPLETED (never collapsed into one event).
 */
@Injectable()
export class BuyerConfirmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificates: CertificatesService,
    private readonly aggregate: ShipmentAggregateService,
    private readonly events: DeliveryEventsPublisher,
    private readonly settlement: SettlementService,
    private readonly paymentRails: PaymentRailsService,
    private readonly paymentOrch: PaymentOrchestrationService,
  ) {}

  canConfirm(input: {
    orderStatus: string;
    orderDisputed?: boolean;
    activeShipmentStatus?: string | null;
  }) {
    return canConfirmDelivery(input);
  }

  async findActiveOutboundShipment(orderId: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    const fulfillment = await db.fulfillmentCase.findUnique({
      where: { orderId },
      select: { id: true },
    });
    if (!fulfillment) return null;

    return db.shipment.findFirst({
      where: {
        fulfillmentId: fulfillment.id,
        deletedAt: null,
        currentStatus: { in: [...ACTIVE_OUTBOUND_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private throwDomain(err: BuyerConfirmDomainError): never {
    if (err.code === 'ALREADY_COMPLETED' || err.code === 'ORDER_DISPUTED') {
      throw new ConflictException(err.message);
    }
    if (err.code === 'CONFIRM_NOT_AVAILABLE') {
      throw new NotFoundException(err.message);
    }
    throw new BadRequestException(err.message);
  }

  /**
   * Completes the commercial order and advances the shipment through
   * distinct BUYER_CONFIRMED then COMPLETED transitions when applicable.
   */
  async confirmOrderDelivery(input: {
    orderId: string;
    actor: BuyerConfirmActor;
    /** When set, order must belong to this buyer. */
    requireBuyerId?: string | null;
    reason?: string | null;
  }) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: input.orderId,
        ...(input.requireBuyerId
          ? { buyerId: input.requireBuyerId }
          : {}),
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const activeShipment = await this.findActiveOutboundShipment(order.id);
    const planned = planBuyerConfirm({
      orderStatus: order.status,
      orderDisputed: order.status === 'DISPUTED',
      activeShipmentStatus: activeShipment?.currentStatus ?? null,
    });
    if (!planned.ok) {
      this.throwDomain(planned.error);
    }

    const now = new Date();
    const publications: Array<{
      shipmentId: string;
      eventType: string;
      fromStatus: string | null;
      toStatus: string | null;
      actorUserId: string | null;
      occurredAt: Date;
      payload?: Record<string, unknown> | null;
    }> = [];

    const shipmentId = activeShipment?.id ?? null;

    await this.prisma.$transaction(async (tx) => {
      if (planned.orderToStatus === 'COMPLETED') {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'COMPLETED',
            completedAt: order.completedAt ?? now,
            deliveredAt: order.deliveredAt ?? now,
            updatedAt: now,
          },
        });
      }

      let shipmentStatus = activeShipment?.currentStatus ?? null;

      for (const step of planned.shipmentTransitions) {
        if (!shipmentId || !shipmentStatus) {
          throw new BadRequestException('No shipment to transition');
        }
        if (shipmentStatus !== step.from) {
          throw new BadRequestException(
            `Shipment status drift: expected ${step.from}, got ${shipmentStatus}`,
          );
        }

        await this.aggregate.transitionStatus(tx, {
          shipmentId,
          fromStatus: step.from as ShipmentStatus,
          toStatus: step.to as ShipmentStatus,
          actorUserId: input.actor.userId,
          message:
            step.to === 'BUYER_CONFIRMED'
              ? input.reason?.trim() ||
                (input.actor.kind === 'ADMIN'
                  ? 'Admin completed order — buyer acknowledgement recorded'
                  : 'Buyer confirmed delivery')
              : input.reason?.trim() ||
                (input.actor.kind === 'ADMIN'
                  ? 'Shipment completed after admin order completion'
                  : 'Shipment completed after buyer confirmation'),
          payload: {
            orderId: order.id,
            path: planned.path,
            actorKind: input.actor.kind,
            acknowledgement: step.to === 'BUYER_CONFIRMED' ? true : undefined,
          },
          timestampFields:
            step.to === 'COMPLETED' ? { completedAt: now } : undefined,
        });

        publications.push({
          shipmentId,
          eventType:
            step.to === 'BUYER_CONFIRMED'
              ? 'delivery.shipment.buyer_confirmed'
              : 'delivery.shipment.completed',
          fromStatus: step.from,
          toStatus: step.to,
          actorUserId: input.actor.userId,
          occurredAt: now,
          payload: {
            orderId: order.id,
            path: planned.path,
            actorKind: input.actor.kind,
          },
        });

        shipmentStatus = step.to;
      }
    });

    for (const pub of publications) {
      this.events.publish(pub);
    }

    if (planned.orderToStatus === 'COMPLETED') {
      const existing = await this.prisma.originCertificate.findUnique({
        where: { orderId: order.id },
      });
      if (!existing) {
        await this.certificates.issueCertificateForOrder(order.id);
      }

      // Phase 3/5: accrue courier from order snapshot; record disbursement intents.
      if (shipmentId) {
        try {
          await this.settlement.accrueOnCompleted({
            shipmentId,
            actorUserId: input.actor.userId,
          });
        } catch {
          // Accrual may already exist from courier completeDelivery — ignore conflicts.
        }
      }

      const fresh = await this.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });

      // G9 — settle from Revenue Engine snapshot (records disbursement stubs)
      await this.paymentOrch
        .settleOrder({
          orderId: order.id,
          actorUserId: input.actor.userId,
          reason: 'Order completed — settlement orchestration',
        })
        .catch(() => undefined);

      // RC1 dual-write: keep rails intents if settlement skipped (no payment case)
      const farmerPayout = Number(fresh.farmerPayoutEtb) || 0;
      if (farmerPayout > 0) {
        const existingFarmer = await this.prisma.paymentIntent.findFirst({
          where: {
            orderId: order.id,
            intentType: 'FARMER_DISBURSEMENT',
          },
        });
        if (!existingFarmer) {
          await this.paymentRails.recordIntent({
            orderId: order.id,
            providerCode: 'INTERNAL_DISBURSEMENT',
            intentType: 'FARMER_DISBURSEMENT',
            amountEtb: farmerPayout,
            metadataJson: { simulated: true, trigger: 'order_completed' },
          });
        }
      }
      const courierPayout = Number(fresh.courierPayoutEtb) || 0;
      if (courierPayout > 0 && shipmentId) {
        const existingCourier = await this.prisma.paymentIntent.findFirst({
          where: {
            orderId: order.id,
            intentType: 'COURIER_DISBURSEMENT',
          },
        });
        if (!existingCourier) {
          await this.paymentRails.recordIntent({
            orderId: order.id,
            providerCode: 'INTERNAL_DISBURSEMENT',
            intentType: 'COURIER_DISBURSEMENT',
            amountEtb: courierPayout,
            metadataJson: {
              simulated: true,
              trigger: 'order_completed',
              shipmentId,
            },
          });
        }
      }
    }

    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    const shipment = shipmentId
      ? await this.prisma.shipment.findUnique({ where: { id: shipmentId } })
      : null;

    return {
      order: updated,
      shipment,
      path: planned.path,
      shipmentTransitions: planned.shipmentTransitions,
    };
  }
}
