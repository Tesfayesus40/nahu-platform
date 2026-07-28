import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  availableEscrowRelease,
  EscrowStatus,
} from './payment-orchestration.rules';

type Tx = Prisma.TransactionClient;

/**
 * G9 — Central escrow hold / release / refund ledger.
 */
@Injectable()
export class EscrowService {
  constructor(private readonly prisma: PrismaService) {}

  async hold(input: {
    paymentCaseId: string;
    amountEtb: number;
    actorUserId?: string | null;
    reason?: string | null;
    tx?: Tx;
  }) {
    const amount = this.requirePositive(input.amountEtb);
    const run = async (tx: Tx) => {
      const pc = await this.requireCase(tx, input.paymentCaseId);
      const held = Number(pc.escrowHeldEtb) + amount;
      await tx.escrowLedger.create({
        data: {
          paymentCaseId: pc.id,
          entryType: 'HOLD',
          amountEtb: amount,
          actorUserId: input.actorUserId ?? null,
          reason: input.reason ?? 'Funds held in escrow',
        },
      });
      return tx.paymentCase.update({
        where: { id: pc.id },
        data: {
          escrowHeldEtb: held,
          escrowStatus: 'HELD',
          updatedAt: new Date(),
        },
      });
    };
    return input.tx ? run(input.tx) : this.prisma.$transaction(run);
  }

  async release(input: {
    paymentCaseId: string;
    amountEtb: number;
    partyCode?: string | null;
    actorUserId?: string | null;
    reason?: string | null;
    partial?: boolean;
    tx?: Tx;
  }) {
    const amount = this.requirePositive(input.amountEtb);
    const run = async (tx: Tx) => {
      const pc = await this.requireCase(tx, input.paymentCaseId);
      const available = availableEscrowRelease(
        Number(pc.escrowHeldEtb),
        Number(pc.escrowReleasedEtb),
        Number(pc.escrowRefundedEtb),
      );
      if (amount > available + 0.001) {
        throw new BadRequestException(
          `Cannot release ${amount}: only ${available} available in escrow`,
        );
      }
      const released = Number(pc.escrowReleasedEtb) + amount;
      const remaining = availableEscrowRelease(
        Number(pc.escrowHeldEtb),
        released,
        Number(pc.escrowRefundedEtb),
      );
      const escrowStatus: EscrowStatus =
        remaining <= 0.001 ? 'RELEASED' : 'PARTIALLY_RELEASED';

      await tx.escrowLedger.create({
        data: {
          paymentCaseId: pc.id,
          entryType: input.partial ? 'PARTIAL_RELEASE' : 'RELEASE',
          amountEtb: amount,
          partyCode: input.partyCode ?? null,
          actorUserId: input.actorUserId ?? null,
          reason: input.reason ?? 'Escrow release',
        },
      });
      return tx.paymentCase.update({
        where: { id: pc.id },
        data: {
          escrowReleasedEtb: released,
          escrowStatus,
          updatedAt: new Date(),
        },
      });
    };
    return input.tx ? run(input.tx) : this.prisma.$transaction(run);
  }

  async refund(input: {
    paymentCaseId: string;
    amountEtb: number;
    actorUserId?: string | null;
    reason?: string | null;
    tx?: Tx;
  }) {
    const amount = this.requirePositive(input.amountEtb);
    const run = async (tx: Tx) => {
      const pc = await this.requireCase(tx, input.paymentCaseId);
      const available = availableEscrowRelease(
        Number(pc.escrowHeldEtb),
        Number(pc.escrowReleasedEtb),
        Number(pc.escrowRefundedEtb),
      );
      // Allow refund of held remainder; if never escrowed, refund capture amount via ledger still.
      const refundable =
        Number(pc.escrowHeldEtb) > 0
          ? available
          : Number(pc.amountEtb) - Number(pc.escrowRefundedEtb);
      if (amount > refundable + 0.001) {
        throw new BadRequestException(
          `Cannot refund ${amount}: only ${refundable} refundable`,
        );
      }
      const refunded = Number(pc.escrowRefundedEtb) + amount;
      await tx.escrowLedger.create({
        data: {
          paymentCaseId: pc.id,
          entryType: 'REFUND',
          amountEtb: amount,
          actorUserId: input.actorUserId ?? null,
          reason: input.reason ?? 'Escrow refund',
        },
      });
      return tx.paymentCase.update({
        where: { id: pc.id },
        data: {
          escrowRefundedEtb: refunded,
          escrowStatus: 'REFUNDED',
          updatedAt: new Date(),
        },
      });
    };
    return input.tx ? run(input.tx) : this.prisma.$transaction(run);
  }

  async listLedger(paymentCaseId: string) {
    const rows = await this.prisma.escrowLedger.findMany({
      where: { paymentCaseId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      entryType: r.entryType,
      amountEtb: Number(r.amountEtb),
      partyCode: r.partyCode,
      actorUserId: r.actorUserId,
      reason: r.reason,
      createdAt: r.createdAt,
    }));
  }

  private requirePositive(amount: number) {
    const n = Math.round((Number(amount) || 0) * 100) / 100;
    if (n <= 0) throw new BadRequestException('amountEtb must be positive');
    return n;
  }

  private async requireCase(tx: Tx, id: string) {
    const pc = await tx.paymentCase.findUnique({ where: { id } });
    if (!pc) throw new NotFoundException('Payment case not found');
    return pc;
  }
}
