import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PaymentIntentType =
  | 'BUYER_CAPTURE'
  | 'FARMER_DISBURSEMENT'
  | 'COURIER_DISBURSEMENT'
  | 'BUYER_REFUND';

/**
 * Phase 5 — payment rail stubs.
 * Records provider intents only; no live Telebirr/CBE/Chapa calls yet.
 */
@Injectable()
export class PaymentRailsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All recorded intents are stubs until live providers ship (post-pilot). */
  private shapeIntent(row: {
    id: string;
    orderId: string;
    providerCode: string;
    intentType: string;
    amountEtb: Prisma.Decimal | number;
    status: string;
    externalReference: string | null;
    createdAt: Date;
    updatedAt?: Date;
  }) {
    return {
      id: row.id,
      orderId: row.orderId,
      providerCode: row.providerCode,
      intentType: row.intentType,
      amountEtb: Number(row.amountEtb),
      status: row.status,
      externalReference: row.externalReference,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isStub: true,
      settlementNote:
        'STUB intent — not live cash movement. Do not treat as settled bank/M-Pesa funds.',
    };
  }

  async recordIntent(input: {
    orderId: string;
    providerCode: string;
    intentType: PaymentIntentType;
    amountEtb: number;
    externalReference?: string | null;
    metadataJson?: Record<string, unknown>;
  }) {
    const row = await this.prisma.paymentIntent.create({
      data: {
        orderId: input.orderId,
        providerCode: input.providerCode,
        intentType: input.intentType,
        amountEtb: input.amountEtb,
        status: 'RECORDED_PENDING_PROVIDER',
        externalReference: input.externalReference ?? null,
        metadataJson: {
          ...(input.metadataJson ?? {}),
          stub: true,
          settlementNote: 'Not live cash',
        } as Prisma.InputJsonValue,
      },
    });
    return this.shapeIntent(row);
  }

  async listForOrder(orderId: string) {
    const rows = await this.prisma.paymentIntent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.shapeIntent(r));
  }
}
