import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EscrowService } from './escrow.service';
import { PaymentProviderRegistry } from './providers/provider.registry';
import {
  canSettlePayment,
  nextPaymentStatus,
  planSettlementFromSnapshot,
  settlementCompleteness,
  PaymentOrchestrationError,
} from './payment-orchestration.rules';

/**
 * G9 — Settlement orchestrator driven by Revenue Engine order snapshot.
 * Distributes escrow → Farmer / Courier / Platform.
 */
@Injectable()
export class SettlementOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  async getSettlement(orderId: string) {
    const pc = await this.requireByOrder(orderId);
    const lines = await this.prisma.settlementLine.findMany({
      where: { paymentCaseId: pc.id },
      orderBy: { createdAt: 'asc' },
    });
    return {
      orderId,
      paymentCaseId: pc.id,
      paymentStatus: pc.paymentStatus,
      settlementStatus: pc.settlementStatus,
      lines: lines.map((l) => ({
        id: l.id,
        partyCode: l.partyCode,
        amountEtb: Number(l.amountEtb),
        status: l.status,
        releasedAt: l.releasedAt,
      })),
    };
  }

  /**
   * Full settlement from Revenue Engine snapshot on the payment case.
   * Idempotent when already SETTLED.
   */
  async settleOrder(input: {
    orderId: string;
    actorUserId: string;
    reason?: string | null;
    /** Release only specific parties (partial). */
    parties?: Array<'FARMER' | 'COURIER' | 'PLATFORM'>;
  }) {
    const pc = await this.requireByOrder(input.orderId);
    if (pc.paymentStatus === 'SETTLED') {
      return this.getSettlement(input.orderId);
    }
    if (!canSettlePayment(pc.paymentStatus)) {
      throw new BadRequestException(
        `Cannot settle from payment status ${pc.paymentStatus}`,
      );
    }

    const plan = planSettlementFromSnapshot({
      farmerPayoutEtb: Number(pc.farmerPayoutEtb),
      courierPayoutEtb: Number(pc.courierPayoutEtb),
      buyerFeeEtb: Number(pc.buyerFeeEtb),
      farmerFeeEtb: Number(pc.farmerFeeEtb),
      deliveryCommissionEtb: Number(pc.deliveryCommissionEtb),
    });

    const filter = input.parties?.length
      ? new Set(input.parties)
      : null;
    const toRelease = filter
      ? plan.filter((l) => filter.has(l.partyCode))
      : plan;

    const provider = this.providers.resolve(pc.providerCode);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentCase.update({
        where: { id: pc.id },
        data: {
          settlementStatus: 'IN_PROGRESS',
          updatedAt: now,
        },
      });

      for (const line of toRelease) {
        const existing = await tx.settlementLine.findFirst({
          where: {
            paymentCaseId: pc.id,
            partyCode: line.partyCode,
            status: 'RELEASED',
          },
        });
        if (existing) continue;

        let row = await tx.settlementLine.findFirst({
          where: { paymentCaseId: pc.id, partyCode: line.partyCode },
        });
        if (!row) {
          row = await tx.settlementLine.create({
            data: {
              paymentCaseId: pc.id,
              partyCode: line.partyCode,
              amountEtb: line.amountEtb,
              status: 'PENDING',
            },
          });
        }

        if (line.amountEtb <= 0) {
          await tx.settlementLine.update({
            where: { id: row.id },
            data: { status: 'SKIPPED', updatedAt: now },
          });
          continue;
        }

        if (line.partyCode !== 'PLATFORM') {
          await this.escrow.release({
            paymentCaseId: pc.id,
            amountEtb: line.amountEtb,
            partyCode: line.partyCode,
            actorUserId: input.actorUserId,
            reason: input.reason ?? `Settlement to ${line.partyCode}`,
            partial: true,
            tx,
          });
        } else {
          // Platform revenue retained from escrow remainder / fees — ledger RELEASE for audit.
          await this.escrow.release({
            paymentCaseId: pc.id,
            amountEtb: line.amountEtb,
            partyCode: 'PLATFORM',
            actorUserId: input.actorUserId,
            reason: input.reason ?? 'Platform revenue retained',
            partial: true,
            tx,
          });
        }

        await provider.disburse({
          orderId: pc.orderId,
          amountEtb: line.amountEtb,
          partyCode: line.partyCode,
          externalReference: pc.externalReference,
          metadata: { settlementLineId: row.id },
        });

        await tx.settlementLine.update({
          where: { id: row.id },
          data: {
            status: 'RELEASED',
            amountEtb: line.amountEtb,
            releasedAt: now,
            updatedAt: now,
          },
        });
      }

      const allLines = await tx.settlementLine.findMany({
        where: { paymentCaseId: pc.id },
      });
      const completeness = settlementCompleteness(
        allLines.map((l) => ({
          status: l.status,
          amountEtb: Number(l.amountEtb),
        })),
      );

      // Ensure planned parties exist for completeness check against full plan
      const plannedCodes = new Set(plan.map((p) => p.partyCode));
      const releasedCodes = new Set(
        allLines.filter((l) => l.status === 'RELEASED').map((l) => l.partyCode),
      );
      const fullPlanDone = [...plannedCodes].every((c) => releasedCodes.has(c));

      let paymentStatus = pc.paymentStatus;
      let settlementStatus = completeness.settlementStatus;
      if (fullPlanDone) {
        try {
          paymentStatus = nextPaymentStatus('SETTLE', pc.paymentStatus);
        } catch (e) {
          if (e instanceof PaymentOrchestrationError) {
            throw new BadRequestException(e.message);
          }
          throw e;
        }
        settlementStatus = 'COMPLETED';
      } else if (completeness.anyReleased) {
        paymentStatus = nextPaymentStatus('PARTIAL_SETTLE', pc.paymentStatus);
        settlementStatus = 'PARTIAL';
      }

      await tx.paymentCase.update({
        where: { id: pc.id },
        data: {
          paymentStatus,
          settlementStatus,
          settledAt:
            paymentStatus === 'SETTLED' ? (pc.settledAt ?? now) : pc.settledAt,
          updatedAt: now,
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentCaseId: pc.id,
          eventType: fullPlanDone ? 'SETTLE' : 'PARTIAL_SETTLE',
          fromStatus: pc.paymentStatus,
          toStatus: paymentStatus,
          actorUserId: input.actorUserId,
          reason: input.reason ?? null,
          message: fullPlanDone
            ? 'Settlement completed from Revenue Engine snapshot'
            : 'Partial settlement applied',
          metadataJson: {
            parties: toRelease.map((l) => l.partyCode),
            fullPlanDone,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return this.getSettlement(input.orderId);
  }

  private async requireByOrder(orderId: string) {
    const pc = await this.prisma.paymentCase.findUnique({
      where: { orderId },
    });
    if (!pc) throw new NotFoundException('Payment case not found');
    return pc;
  }
}
