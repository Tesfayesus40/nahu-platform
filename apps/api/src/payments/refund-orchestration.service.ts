import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { allocateRefund } from '../pricing/pricing.rules';
import { EscrowService } from './escrow.service';
import { PaymentProviderRegistry } from './providers/provider.registry';
import {
  canRefundPayment,
  isRefundReason,
  nextPaymentStatus,
  PaymentOrchestrationError,
  RefundReason,
} from './payment-orchestration.rules';

/**
 * G9 — Refund orchestration with auditable history.
 * Reasons: seller rejection, buyer cancellation, delivery failure, admin cancellation.
 */
@Injectable()
export class RefundOrchestrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  async getRefund(orderId: string) {
    const pc = await this.requireByOrder(orderId);
    const events = await this.prisma.paymentEvent.findMany({
      where: {
        paymentCaseId: pc.id,
        eventType: { in: ['REFUND', 'REFUND_REQUESTED', 'REFUND_FAILED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      orderId,
      paymentCaseId: pc.id,
      paymentStatus: pc.paymentStatus,
      refundStatus: pc.refundStatus,
      escrowRefundedEtb: Number(pc.escrowRefundedEtb),
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actorUserId: e.actorUserId,
        reason: e.reason,
        message: e.message,
        createdAt: e.createdAt,
        metadata: e.metadataJson,
      })),
    };
  }

  async refundOrder(input: {
    orderId: string;
    actorUserId: string;
    reason: RefundReason | string;
    amountEtb?: number;
    refundGoodsEtb?: number;
    refundBuyerFeeEtb?: number;
    refundDeliveryEtb?: number;
    message?: string | null;
  }) {
    if (!isRefundReason(input.reason) && typeof input.reason === 'string') {
      // Allow ADMIN_CANCELLATION etc.; reject unknown
      if (!isRefundReason(input.reason)) {
        throw new BadRequestException(
          `Invalid refund reason. Use one of: SELLER_REJECTION, BUYER_CANCELLATION, DELIVERY_FAILURE, ADMIN_CANCELLATION`,
        );
      }
    }
    const reason = input.reason as RefundReason;
    const pc = await this.requireByOrder(input.orderId);
    if (pc.paymentStatus === 'REFUNDED') {
      return this.getRefund(input.orderId);
    }
    if (!canRefundPayment(pc.paymentStatus)) {
      throw new BadRequestException(
        `Cannot refund from payment status ${pc.paymentStatus}`,
      );
    }

    const allocation = allocateRefund({
      goodsSubtotalEtb: Number(pc.goodsSubtotalEtb),
      buyerFeeEtb: Number(pc.buyerFeeEtb),
      deliveryFeeEtb: Number(pc.deliveryFeeEtb),
      refundAmountEtb: input.amountEtb,
      refundGoodsEtb: input.refundGoodsEtb,
      refundBuyerFeeEtb: input.refundBuyerFeeEtb,
      refundDeliveryEtb: input.refundDeliveryEtb,
      policyCode: reason,
    });

    if (allocation.refundAmountEtb <= 0) {
      throw new BadRequestException('Refund amount must be positive');
    }

    const provider = this.providers.resolve(pc.providerCode);
    let toStatus: string;
    try {
      toStatus = nextPaymentStatus('REFUND', pc.paymentStatus);
    } catch (e) {
      if (e instanceof PaymentOrchestrationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentCase.update({
        where: { id: pc.id },
        data: {
          refundStatus: 'PROCESSING',
          updatedAt: now,
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentCaseId: pc.id,
          eventType: 'REFUND_REQUESTED',
          fromStatus: pc.paymentStatus,
          toStatus: pc.paymentStatus,
          actorUserId: input.actorUserId,
          reason,
          message: input.message ?? `Refund requested: ${reason}`,
          metadataJson: allocation as unknown as Prisma.InputJsonValue,
        },
      });

      if (Number(pc.escrowHeldEtb) > 0 || pc.escrowStatus === 'HELD' || pc.escrowStatus === 'PARTIALLY_RELEASED') {
        await this.escrow.refund({
          paymentCaseId: pc.id,
          amountEtb: allocation.refundAmountEtb,
          actorUserId: input.actorUserId,
          reason,
          tx,
        });
      }

      const providerResult = await provider.refund({
        orderId: pc.orderId,
        amountEtb: allocation.refundAmountEtb,
        externalReference: pc.externalReference,
        metadata: { reason, allocation },
      });

      if (!providerResult.ok) {
        await tx.paymentCase.update({
          where: { id: pc.id },
          data: { refundStatus: 'FAILED', updatedAt: new Date() },
        });
        await tx.paymentEvent.create({
          data: {
            paymentCaseId: pc.id,
            eventType: 'REFUND_FAILED',
            fromStatus: pc.paymentStatus,
            toStatus: pc.paymentStatus,
            actorUserId: input.actorUserId,
            reason,
            message: providerResult.message ?? 'Provider refund failed',
          },
        });
        throw new BadRequestException(
          providerResult.message ?? 'Provider refund failed',
        );
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
          reason,
          message: input.message ?? `Refund completed: ${reason}`,
          metadataJson: {
            allocation,
            provider: providerResult,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.getRefund(input.orderId);
  }

  private async requireByOrder(orderId: string) {
    const pc = await this.prisma.paymentCase.findUnique({
      where: { orderId },
    });
    if (!pc) throw new NotFoundException('Payment case not found');
    return pc;
  }
}
