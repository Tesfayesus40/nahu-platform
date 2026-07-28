import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EscrowService } from './escrow.service';
import { PaymentProviderRegistry } from './providers/provider.registry';
import { SettlementOrchestratorService } from './settlement-orchestrator.service';
import { RefundOrchestrationService } from './refund-orchestration.service';
import {
  computePlatformRevenue,
  escrowStatusAfter,
  nextPaymentStatus,
  PaymentAction,
  PaymentOrchestrationError,
  PaymentStatus,
  paymentStatusFromOrder,
  timestampFieldForPayment,
  canRefundPayment,
} from './payment-orchestration.rules';

type SnapshotInput = {
  amountEtb: number;
  goodsSubtotalEtb: number;
  buyerFeeEtb: number;
  farmerFeeEtb: number;
  farmerPayoutEtb: number;
  deliveryFeeEtb: number;
  deliveryCommissionEtb: number;
  courierPayoutEtb: number;
};

/**
 * G9 — Central payment orchestration authority.
 * Coordinates provider stubs, escrow, settlement, refunds; dual-writes RC1 where needed.
 */
@Injectable()
export class PaymentOrchestrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
    private readonly escrow: EscrowService,
    private readonly settlement: SettlementOrchestratorService,
    private readonly refunds: RefundOrchestrationService,
  ) {}

  async getStatus(orderId: string) {
    const pc = await this.ensureCase(orderId);
    return this.shape(pc);
  }

  async getEscrow(orderId: string) {
    const pc = await this.ensureCase(orderId);
    const ledger = await this.escrow.listLedger(pc.id);
    return {
      orderId,
      paymentCaseId: pc.id,
      escrowStatus: pc.escrowStatus,
      heldEtb: Number(pc.escrowHeldEtb),
      releasedEtb: Number(pc.escrowReleasedEtb),
      refundedEtb: Number(pc.escrowRefundedEtb),
      availableEtb:
        Number(pc.escrowHeldEtb) -
        Number(pc.escrowReleasedEtb) -
        Number(pc.escrowRefundedEtb),
      ledger,
    };
  }

  getSettlement(orderId: string) {
    return this.settlement.getSettlement(orderId);
  }

  getRefund(orderId: string) {
    return this.refunds.getRefund(orderId);
  }

  async getEvents(orderId: string) {
    const pc = await this.ensureCase(orderId);
    const events = await this.prisma.paymentEvent.findMany({
      where: { paymentCaseId: pc.id },
      orderBy: { createdAt: 'asc' },
    });
    return {
      orderId,
      paymentCaseId: pc.id,
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actorUserId: e.actorUserId,
        reason: e.reason,
        message: e.message,
        metadata: e.metadataJson,
        createdAt: e.createdAt,
      })),
    };
  }

  /**
   * Create / refresh payment case from order (checkout). CREATED → PENDING.
   */
  async ensureFromOrder(input: {
    orderId: string;
    actorUserId?: string | null;
    initiate?: boolean;
  }) {
    const pc = await this.ensureCase(input.orderId);
    if (input.initiate !== false && pc.paymentStatus === 'CREATED') {
      return this.transition({
        orderId: input.orderId,
        action: 'INITIATE',
        actorUserId: input.actorUserId ?? null,
        reason: 'Checkout initiated',
      });
    }
    return this.shape(pc);
  }

  /**
   * RC1 confirm-payment hook: provider capture stub + escrow hold → ESCROWED.
   */
  async syncCaptureToEscrow(input: {
    orderId: string;
    actorUserId: string;
    externalReference?: string | null;
  }) {
    const pc = await this.ensureCase(input.orderId);
    if (
      pc.paymentStatus === 'ESCROWED' ||
      pc.paymentStatus === 'PARTIALLY_SETTLED' ||
      pc.paymentStatus === 'SETTLED'
    ) {
      return this.shape(pc);
    }

    if (pc.paymentStatus === 'CREATED') {
      await this.transition({
        orderId: input.orderId,
        action: 'INITIATE',
        actorUserId: input.actorUserId,
        reason: 'Auto-initiate before capture',
      });
    }

    const provider = this.providers.resolve(pc.providerCode);
    const amount = Number(pc.amountEtb);
    const auth = await provider.authorize({
      orderId: input.orderId,
      amountEtb: amount,
      externalReference: input.externalReference ?? pc.externalReference,
      metadata: { phase: 'confirm_payment' },
    });
    if (!auth.ok) {
      await this.transition({
        orderId: input.orderId,
        action: 'FAIL',
        actorUserId: input.actorUserId,
        reason: auth.message ?? 'Authorize failed',
      });
      throw new BadRequestException(auth.message ?? 'Authorize failed');
    }

    const capture = await provider.capture({
      orderId: input.orderId,
      amountEtb: amount,
      externalReference: auth.externalReference ?? input.externalReference,
      metadata: { phase: 'confirm_payment' },
    });
    if (!capture.ok) {
      await this.transition({
        orderId: input.orderId,
        action: 'FAIL',
        actorUserId: input.actorUserId,
        reason: capture.message ?? 'Capture failed',
      });
      throw new BadRequestException(capture.message ?? 'Capture failed');
    }

    const shaped = await this.transition({
      orderId: input.orderId,
      action: 'CAPTURE_TO_ESCROW',
      actorUserId: input.actorUserId,
      reason: 'Buyer payment captured to escrow',
      externalReference:
        capture.externalReference ?? input.externalReference ?? undefined,
      holdEscrow: true,
    });
    return shaped;
  }

  settleOrder(input: {
    orderId: string;
    actorUserId: string;
    reason?: string | null;
    parties?: Array<'FARMER' | 'COURIER' | 'PLATFORM'>;
  }) {
    return this.settlement.settleOrder(input);
  }

  refundOrder(input: Parameters<RefundOrchestrationService['refundOrder']>[0]) {
    return this.refunds.refundOrder(input);
  }

  /**
   * Sync payment case after an external/RC1 refund intent was already recorded
   * (e.g. admin dispute REFUND). Does not call the provider again.
   */
  async acknowledgeExternalRefund(input: {
    orderId: string;
    actorUserId: string;
    reason: string;
    amountEtb: number;
    message?: string | null;
  }) {
    const pc = await this.ensureCase(input.orderId);
    if (pc.paymentStatus === 'REFUNDED') {
      return this.getRefund(input.orderId);
    }
    if (!canRefundPayment(pc.paymentStatus) && pc.paymentStatus !== 'SETTLED') {
      // Soft skip — dispute refund may run after settle in edge cases
      await this.prisma.paymentEvent.create({
        data: {
          paymentCaseId: pc.id,
          eventType: 'REFUND_ACK_SKIPPED',
          fromStatus: pc.paymentStatus,
          toStatus: pc.paymentStatus,
          actorUserId: input.actorUserId,
          reason: input.reason,
          message: `Refund ack skipped; payment is ${pc.paymentStatus}`,
        },
      });
      return this.getRefund(input.orderId);
    }

    if (pc.paymentStatus === 'SETTLED') {
      await this.prisma.paymentEvent.create({
        data: {
          paymentCaseId: pc.id,
          eventType: 'REFUND_ACK_SKIPPED',
          fromStatus: pc.paymentStatus,
          toStatus: pc.paymentStatus,
          actorUserId: input.actorUserId,
          reason: input.reason,
          message: 'Refund ack skipped; already settled',
        },
      });
      return this.getRefund(input.orderId);
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      let toStatus = pc.paymentStatus;
      try {
        toStatus = nextPaymentStatus('REFUND', pc.paymentStatus);
      } catch {
        toStatus = 'REFUNDED';
      }

      if (Number(pc.escrowHeldEtb) > Number(pc.escrowRefundedEtb)) {
        const amt = Math.min(
          input.amountEtb,
          Number(pc.escrowHeldEtb) -
            Number(pc.escrowReleasedEtb) -
            Number(pc.escrowRefundedEtb),
        );
        if (amt > 0) {
          await this.escrow.refund({
            paymentCaseId: pc.id,
            amountEtb: amt,
            actorUserId: input.actorUserId,
            reason: input.reason,
            tx,
          });
        }
      }

      await tx.paymentCase.update({
        where: { id: pc.id },
        data: {
          paymentStatus: toStatus,
          refundStatus: 'COMPLETED',
          refundedAt: now,
          updatedAt: now,
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentCaseId: pc.id,
          eventType: 'REFUND',
          fromStatus: pc.paymentStatus,
          toStatus,
          actorUserId: input.actorUserId,
          reason: input.reason,
          message: input.message ?? 'External refund acknowledged',
          metadataJson: {
            external: true,
            amountEtb: input.amountEtb,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return this.getRefund(input.orderId);
  }

  async cancelUnpaid(orderId: string, actorUserId: string, reason?: string) {
    return this.transition({
      orderId,
      action: 'CANCEL',
      actorUserId,
      reason: reason ?? 'Order cancelled before payment',
    });
  }

  // ─── core transition ─────────────────────────────────────────────────────

  private async transition(input: {
    orderId: string;
    action: PaymentAction;
    actorUserId?: string | null;
    reason?: string | null;
    externalReference?: string;
    holdEscrow?: boolean;
  }) {
    const pc = await this.ensureCase(input.orderId);
    let next: PaymentStatus;
    try {
      next = nextPaymentStatus(input.action, pc.paymentStatus);
    } catch (e) {
      if (e instanceof PaymentOrchestrationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const now = new Date();
    const data: Record<string, unknown> = {
      paymentStatus: next,
      updatedAt: now,
    };
    const ts = timestampFieldForPayment(next);
    if (ts) {
      data[ts] = (pc as Record<string, unknown>)[ts] ?? now;
    }
    if (input.externalReference) {
      data.externalReference = input.externalReference;
    }
    if (input.action === 'FAIL' && input.reason) {
      data.failureReason = input.reason;
    }

    const escrowNext = escrowStatusAfter(input.action);
    if (escrowNext) {
      data.escrowStatus = escrowNext;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.paymentCase.update({
        where: { id: pc.id },
        data: data as Prisma.PaymentCaseUpdateInput,
      });

      await tx.paymentEvent.create({
        data: {
          paymentCaseId: pc.id,
          eventType: input.action,
          fromStatus: pc.paymentStatus,
          toStatus: next,
          actorUserId: input.actorUserId ?? null,
          reason: input.reason ?? null,
          message: `Payment ${input.action}: ${pc.paymentStatus} → ${next}`,
          metadataJson: {
            action: input.action,
          } as Prisma.InputJsonValue,
        },
      });

      if (input.holdEscrow && (input.action === 'CAPTURE_TO_ESCROW' || input.action === 'ESCROW')) {
        await this.escrow.hold({
          paymentCaseId: pc.id,
          amountEtb: Number(pc.amountEtb),
          actorUserId: input.actorUserId,
          reason: input.reason ?? 'Escrow hold after capture',
          tx,
        });
      }

      return row;
    });

    return this.shape(updated);
  }

  async ensureCase(orderId: string) {
    const existing = await this.prisma.paymentCase.findUnique({
      where: { orderId },
    });
    if (existing) return existing;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const goods = Number(order.goodsSubtotalEtb ?? order.totalEtb) || 0;
    const buyerFee = Number(order.buyerFeeEtb) || 0;
    const farmerFee = Number(order.farmerFeeEtb ?? order.commissionEtb) || 0;
    const deliveryFee = Number(order.deliveryFeeEtb) || 0;
    const deliveryCommission = Number(order.deliveryCommissionEtb) || 0;
    const farmerPayout = Number(order.farmerPayoutEtb) || 0;
    const courierPayout = Number(order.courierPayoutEtb) || 0;
    const amount =
      Number(order.buyerChargeEtb) ||
      goods + buyerFee + deliveryFee;

    const snapshot: SnapshotInput = {
      amountEtb: amount,
      goodsSubtotalEtb: goods,
      buyerFeeEtb: buyerFee,
      farmerFeeEtb: farmerFee,
      farmerPayoutEtb: farmerPayout,
      deliveryFeeEtb: deliveryFee,
      deliveryCommissionEtb: deliveryCommission,
      courierPayoutEtb: courierPayout,
    };

    return this.prisma.paymentCase.create({
      data: {
        orderId,
        providerCode: String(order.paymentMethod),
        paymentStatus: paymentStatusFromOrder(order.status),
        escrowStatus:
          order.status === 'PAID_ESCROW' ||
          order.status === 'CONFIRMED' ||
          order.status === 'SHIPPED' ||
          order.status === 'DELIVERED' ||
          order.status === 'DISPUTED'
            ? 'HELD'
            : order.status === 'COMPLETED'
              ? 'RELEASED'
              : 'NONE',
        settlementStatus:
          order.status === 'COMPLETED' ? 'COMPLETED' : 'NOT_STARTED',
        amountEtb: snapshot.amountEtb,
        goodsSubtotalEtb: snapshot.goodsSubtotalEtb,
        buyerFeeEtb: snapshot.buyerFeeEtb,
        farmerFeeEtb: snapshot.farmerFeeEtb,
        farmerPayoutEtb: snapshot.farmerPayoutEtb,
        deliveryFeeEtb: snapshot.deliveryFeeEtb,
        deliveryCommissionEtb: snapshot.deliveryCommissionEtb,
        courierPayoutEtb: snapshot.courierPayoutEtb,
        platformRevenueEtb: computePlatformRevenue(snapshot),
        escrowHeldEtb:
          order.status === 'PAID_ESCROW' ||
          order.status === 'CONFIRMED' ||
          order.status === 'SHIPPED' ||
          order.status === 'DELIVERED' ||
          order.status === 'DISPUTED'
            ? snapshot.amountEtb
            : 0,
        escrowReleasedEtb:
          order.status === 'COMPLETED' ? snapshot.amountEtb : 0,
        externalReference: order.paymentReference,
        pendingAt:
          order.status === 'PENDING_PAYMENT' ? order.createdAt : null,
        escrowedAt: order.paidAt,
        settledAt: order.completedAt,
      },
    });
  }

  private shape(pc: {
    id: string;
    orderId: string;
    providerCode: string;
    paymentStatus: string;
    escrowStatus: string;
    settlementStatus: string;
    refundStatus: string;
    amountEtb: Prisma.Decimal | number;
    goodsSubtotalEtb: Prisma.Decimal | number;
    buyerFeeEtb: Prisma.Decimal | number;
    farmerFeeEtb: Prisma.Decimal | number;
    farmerPayoutEtb: Prisma.Decimal | number;
    deliveryFeeEtb: Prisma.Decimal | number;
    deliveryCommissionEtb: Prisma.Decimal | number;
    courierPayoutEtb: Prisma.Decimal | number;
    platformRevenueEtb: Prisma.Decimal | number;
    escrowHeldEtb: Prisma.Decimal | number;
    escrowReleasedEtb: Prisma.Decimal | number;
    escrowRefundedEtb: Prisma.Decimal | number;
    externalReference: string | null;
    pendingAt: Date | null;
    authorizedAt: Date | null;
    capturedAt: Date | null;
    escrowedAt: Date | null;
    settledAt: Date | null;
    refundedAt: Date | null;
    failedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: pc.id,
      orderId: pc.orderId,
      providerCode: pc.providerCode,
      paymentStatus: pc.paymentStatus,
      escrowStatus: pc.escrowStatus,
      settlementStatus: pc.settlementStatus,
      refundStatus: pc.refundStatus,
      amountEtb: Number(pc.amountEtb),
      snapshot: {
        goodsSubtotalEtb: Number(pc.goodsSubtotalEtb),
        buyerFeeEtb: Number(pc.buyerFeeEtb),
        farmerFeeEtb: Number(pc.farmerFeeEtb),
        farmerPayoutEtb: Number(pc.farmerPayoutEtb),
        deliveryFeeEtb: Number(pc.deliveryFeeEtb),
        deliveryCommissionEtb: Number(pc.deliveryCommissionEtb),
        courierPayoutEtb: Number(pc.courierPayoutEtb),
        platformRevenueEtb: Number(pc.platformRevenueEtb),
      },
      escrow: {
        heldEtb: Number(pc.escrowHeldEtb),
        releasedEtb: Number(pc.escrowReleasedEtb),
        refundedEtb: Number(pc.escrowRefundedEtb),
      },
      externalReference: pc.externalReference,
      timestamps: {
        pendingAt: pc.pendingAt,
        authorizedAt: pc.authorizedAt,
        capturedAt: pc.capturedAt,
        escrowedAt: pc.escrowedAt,
        settledAt: pc.settledAt,
        refundedAt: pc.refundedAt,
        failedAt: pc.failedAt,
        cancelledAt: pc.cancelledAt,
      },
      createdAt: pc.createdAt,
      updatedAt: pc.updatedAt,
    };
  }
}
