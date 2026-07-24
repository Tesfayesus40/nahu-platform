import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentAggregateService } from './shipment-aggregate.service';
import { DeliveryConfigService } from './delivery-config.service';
import {
  DeliveryEventsPublisher,
  DeliveryLifecyclePublication,
} from './delivery-events.publisher';
import { AuditService } from '../audit/audit.service';
import {
  SettlementDomainError,
  assertCanAccrue,
  assertCanApprove,
  assertCanMarkPaid,
  assertCanReverse,
  isPrimaryDeliveryEarning,
  periodBounds,
  planAdjustment,
  planApproveMarker,
  planDeliveryAccrual,
  planPaidMarker,
  planReversal,
  resolveSettlementStatus,
  sumEarningLedger,
} from './settlement.rules';

type AuditMeta = {
  ip?: string;
  userAgent?: string;
  requestId?: string;
};

/**
 * D11 — Courier earnings & settlement on the immutable ShipmentEarnings ledger.
 * Accrues only after POD verified + shipment COMPLETED.
 */
@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregate: ShipmentAggregateService,
    private readonly config: DeliveryConfigService,
    private readonly events: DeliveryEventsPublisher,
    private readonly audit: AuditService,
  ) {}

  private throwDomain(err: SettlementDomainError): never {
    const map: Partial<
      Record<SettlementDomainError['code'], new (m: string) => Error>
    > = {
      SHIPMENT_NOT_FOUND: NotFoundException,
      EARNING_NOT_FOUND: NotFoundException,
      POD_REQUIRED: ConflictException,
      NOT_COMPLETED: ConflictException,
      ALREADY_ACCRUED: ConflictException,
      NOT_ELIGIBLE: ConflictException,
      ALREADY_REVERSED: ConflictException,
      INVALID_AMOUNT: BadRequestException,
      FORBIDDEN: ForbiddenException,
    };
    const Ctor = map[err.code] ?? BadRequestException;
    throw new Ctor(err.message);
  }

  private toAmount(v: Prisma.Decimal | number | string): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v);
    return v.toNumber();
  }

  private publish(pub: DeliveryLifecyclePublication) {
    this.events.publish(pub);
  }

  /**
   * Accrue DELIVERY_EARNING after COMPLETED (idempotent).
   * Requires verified POD row on shipment.
   * When `tx` is provided (nested in DeliveryExecutionService), fan-out is deferred
   * until after the outer transaction commits.
   */
  async accrueOnCompleted(input: {
    shipmentId: string;
    actorUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<{
    earning: { id: string } | null;
    created: boolean;
    publication: DeliveryLifecyclePublication | null;
  }> {
    const run = async (tx: Prisma.TransactionClient) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, deletedAt: null },
        include: {
          pods: { orderBy: { capturedAt: 'desc' }, take: 1 },
          stops: {
            where: {
              deletedAt: null,
              stopType: { in: ['DROPOFF', 'RETURN_DROPOFF'] },
            },
            orderBy: { sequence: 'desc' },
            take: 1,
          },
        },
      });
      if (!shipment) {
        this.throwDomain(
          new SettlementDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
        );
      }

      const existing = await tx.shipmentEarning.findFirst({
        where: {
          shipmentId: shipment.id,
          earningType: { in: ['DELIVERY_EARNING', 'DROPOFF_FLAT'] },
          replacesEarningId: null,
        },
      });

      try {
        assertCanAccrue({
          shipmentStatus: shipment.currentStatus,
          hasVerifiedPod: Boolean(shipment.pods.length > 0),
          alreadyAccrued: Boolean(existing),
        });
      } catch (e) {
        if (e instanceof SettlementDomainError) {
          if (e.code === 'ALREADY_ACCRUED') {
            return { earning: existing, created: false };
          }
          this.throwDomain(e);
        }
        throw e;
      }

      if (!shipment.courierUserId) {
        this.throwDomain(
          new SettlementDomainError(
            'SHIPMENT_NOT_FOUND',
            'Shipment has no courier for earnings',
          ),
        );
      }

      const flatEtb = await this.config.earningFlatEtb();
      const planned = planDeliveryAccrual({
        shipmentId: shipment.id,
        stopId: shipment.stops[0]?.id ?? shipment.pods[0]?.stopId ?? null,
        courierUserId: shipment.courierUserId,
        flatEtb,
      });

      let row;
      let created = true;
      try {
        row = await this.aggregate.appendEarning(tx, {
          shipmentId: shipment.id,
          stopId: shipment.stops[0]?.id ?? null,
          courierUserId: shipment.courierUserId,
          earningType: planned.earningType,
          amount: planned.amount,
          currency: planned.currency,
          ledgerStatus: planned.ledgerStatus,
          policyCode: planned.policyCode,
          reference: `delivery:${shipment.id}`,
          metadataJson: {
            settlement: true,
            flatEtb,
            podId: shipment.pods[0]?.id ?? null,
          },
        });
      } catch (err) {
        // Concurrent complete: unique primary accrual index (D12)
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          const raced = await tx.shipmentEarning.findFirst({
            where: {
              shipmentId: shipment.id,
              earningType: { in: ['DELIVERY_EARNING', 'DROPOFF_FLAT'] },
              replacesEarningId: null,
            },
          });
          if (raced) {
            return { earning: raced, created: false };
          }
        }
        throw err;
      }

      await this.aggregate.appendDomainEvent(tx, {
        shipmentId: shipment.id,
        stopId: row.stopId,
        eventType: 'delivery.earning.accrued',
        fromStatus: 'COMPLETED',
        toStatus: 'COMPLETED',
        actorUserId: input.actorUserId,
        message: 'Delivery earning accrued (ELIGIBLE)',
        payload: {
          earningId: row.id,
          amount: planned.amount,
          ledgerStatus: planned.ledgerStatus,
        },
      });

      return { earning: row, created };
    };

    const result = input.tx
      ? await run(input.tx)
      : await this.prisma.$transaction((tx) => run(tx));

    const publication: DeliveryLifecyclePublication | null =
      result.created && result.earning
        ? {
            shipmentId: input.shipmentId,
            eventType: 'delivery.earning.accrued',
            fromStatus: 'COMPLETED',
            toStatus: 'COMPLETED',
            actorUserId: input.actorUserId,
            occurredAt: new Date(),
            payload: { earningId: result.earning.id },
          }
        : null;

    // Nested TX: caller publishes after commit. Standalone: publish now.
    if (publication && !input.tx) {
      this.publish(publication);
    }

    return {
      earning: result.earning,
      created: result.created,
      publication: input.tx ? publication : null,
    };
  }

  async listCourierEarnings(
    courierUserId: string,
    query?: { page?: number; limit?: number; period?: 'today' | 'week' | 'month' },
  ) {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 20, 100);
    const period = query?.period ?? 'month';
    const { from } = periodBounds(period);

    const where: Prisma.ShipmentEarningWhereInput = {
      courierUserId,
      createdAt: { gte: from },
    };

    const [total, rows, allForBalance] = await Promise.all([
      this.prisma.shipmentEarning.count({ where }),
      this.prisma.shipmentEarning.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shipmentEarning.findMany({
        where: { courierUserId, createdAt: { gte: from } },
        select: { amount: true, ledgerStatus: true, earningType: true },
      }),
    ]);

    const [todayRows, weekRows, monthRows, completedCount] = await Promise.all([
      this.prisma.shipmentEarning.findMany({
        where: {
          courierUserId,
          createdAt: { gte: periodBounds('today').from },
          earningType: { in: ['DELIVERY_EARNING', 'DROPOFF_FLAT', 'BONUS'] },
        },
        select: { amount: true, ledgerStatus: true },
      }),
      this.prisma.shipmentEarning.findMany({
        where: {
          courierUserId,
          createdAt: { gte: periodBounds('week').from },
          earningType: { in: ['DELIVERY_EARNING', 'DROPOFF_FLAT', 'BONUS'] },
        },
        select: { amount: true, ledgerStatus: true },
      }),
      this.prisma.shipmentEarning.findMany({
        where: {
          courierUserId,
          createdAt: { gte: periodBounds('month').from },
          earningType: { in: ['DELIVERY_EARNING', 'DROPOFF_FLAT', 'BONUS'] },
        },
        select: { amount: true, ledgerStatus: true },
      }),
      this.prisma.shipment.count({
        where: {
          deletedAt: null,
          courierUserId,
          currentStatus: 'COMPLETED',
        },
      }),
    ]);

    const pending = await this.prisma.shipmentEarning.count({
      where: {
        courierUserId,
        ledgerStatus: { in: ['ELIGIBLE', 'ACCRUED', 'APPROVED'] },
        earningType: { in: ['DELIVERY_EARNING', 'DROPOFF_FLAT'] },
        replacesEarningId: null,
      },
    });

    const toLedgerRow = (r: { amount: Prisma.Decimal; ledgerStatus: string }) => ({
      amount: this.toAmount(r.amount),
      ledgerStatus: r.ledgerStatus,
    });

    return {
      page,
      limit,
      total,
      summary: {
        todayEtb: sumEarningLedger(todayRows.map(toLedgerRow)),
        weekEtb: sumEarningLedger(weekRows.map(toLedgerRow)),
        monthEtb: sumEarningLedger(monthRows.map(toLedgerRow)),
        periodBalanceEtb: sumEarningLedger(allForBalance.map(toLedgerRow)),
        completedDeliveries: completedCount,
        pendingSettlements: pending,
      },
      items: rows.map((r) => ({
        id: r.id,
        shipmentId: r.shipmentId,
        earningType: r.earningType,
        amount: this.toAmount(r.amount),
        currency: r.currency,
        ledgerStatus: r.ledgerStatus,
        reference: r.reference,
        createdAt: r.createdAt,
      })),
    };
  }

  async listAdminEarnings(query: {
    page?: number;
    limit?: number;
    courierUserId?: string;
    shipmentId?: string;
    ledgerStatus?: string;
    q?: string;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.ShipmentEarningWhereInput = {};
    if (query.courierUserId) where.courierUserId = query.courierUserId;
    if (query.shipmentId) where.shipmentId = query.shipmentId;
    if (query.ledgerStatus) where.ledgerStatus = query.ledgerStatus;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { reference: { contains: q, mode: 'insensitive' } },
        { policyCode: { contains: q, mode: 'insensitive' } },
      ];
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          q,
        )
      ) {
        where.OR.push({ id: q }, { shipmentId: q }, { courierUserId: q });
      }
    }

    const [total, rows, byStatus] = await Promise.all([
      this.prisma.shipmentEarning.count({ where }),
      this.prisma.shipmentEarning.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shipmentEarning.groupBy({
        by: ['ledgerStatus'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    const shipmentIds = [...new Set(rows.map((r) => r.shipmentId))];
    const chainRows =
      shipmentIds.length === 0
        ? []
        : await this.prisma.shipmentEarning.findMany({
            where: { shipmentId: { in: shipmentIds } },
            orderBy: { createdAt: 'asc' },
          });
    const chainsByShipment = new Map<string, typeof chainRows>();
    for (const c of chainRows) {
      const list = chainsByShipment.get(c.shipmentId) ?? [];
      list.push(c);
      chainsByShipment.set(c.shipmentId, list);
    }

    return {
      page,
      limit,
      total,
      operationalSummary: {
        byStatus: Object.fromEntries(
          byStatus.map((g) => [
            g.ledgerStatus,
            {
              count: g._count._all,
              sumEtb: g._sum.amount ? this.toAmount(g._sum.amount) : 0,
            },
          ]),
        ),
      },
      items: rows.map((r) => {
        const chain = chainsByShipment.get(r.shipmentId) ?? [r];
        return {
          id: r.id,
          shipmentId: r.shipmentId,
          courierUserId: r.courierUserId,
          earningType: r.earningType,
          amount: this.toAmount(r.amount),
          currency: r.currency,
          ledgerStatus: r.ledgerStatus,
          settlementStatus: resolveSettlementStatus(
            chain.map((c) => ({
              id: c.id,
              earningType: c.earningType,
              amount: this.toAmount(c.amount),
              ledgerStatus: c.ledgerStatus,
              replacesEarningId: c.replacesEarningId,
            })),
          ),
          replacesEarningId: r.replacesEarningId,
          reference: r.reference,
          policyCode: r.policyCode,
          createdAt: r.createdAt,
        };
      }),
    };
  }

  async getEarningDetail(earningId: string) {
    const row = await this.prisma.shipmentEarning.findUnique({
      where: { id: earningId },
    });
    if (!row) {
      this.throwDomain(
        new SettlementDomainError('EARNING_NOT_FOUND', 'Earning not found'),
      );
    }
    const chain = await this.prisma.shipmentEarning.findMany({
      where: {
        shipmentId: row.shipmentId,
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...row,
      amount: this.toAmount(row.amount),
      settlementStatus: resolveSettlementStatus(
        chain.map((c) => ({
          id: c.id,
          earningType: c.earningType,
          amount: this.toAmount(c.amount),
          ledgerStatus: c.ledgerStatus,
          replacesEarningId: c.replacesEarningId,
        })),
      ),
      history: chain.map((c) => ({
        id: c.id,
        earningType: c.earningType,
        amount: this.toAmount(c.amount),
        ledgerStatus: c.ledgerStatus,
        replacesEarningId: c.replacesEarningId,
        reference: c.reference,
        createdAt: c.createdAt,
      })),
    };
  }

  private async primaryForShipmentOrId(earningId: string) {
    const row = await this.prisma.shipmentEarning.findUnique({
      where: { id: earningId },
    });
    if (!row) {
      this.throwDomain(
        new SettlementDomainError('EARNING_NOT_FOUND', 'Earning not found'),
      );
    }
    if (isPrimaryDeliveryEarning(row.earningType) && !row.replacesEarningId) {
      return row;
    }
    if (row.replacesEarningId) {
      const root = await this.prisma.shipmentEarning.findUnique({
        where: { id: row.replacesEarningId },
      });
      if (root) return root;
    }
    const primary = await this.prisma.shipmentEarning.findFirst({
      where: {
        shipmentId: row.shipmentId,
        earningType: { in: ['DELIVERY_EARNING', 'DROPOFF_FLAT'] },
        replacesEarningId: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    return primary ?? row;
  }

  async approveEarning(input: {
    earningId: string;
    actorUserId: string;
    sessionId?: string | null;
    reason?: string | null;
    meta?: AuditMeta;
  }) {
    const primary = await this.primaryForShipmentOrId(input.earningId);
    const chain = await this.prisma.shipmentEarning.findMany({
      where: { shipmentId: primary.shipmentId },
    });
    const status = resolveSettlementStatus(
      chain.map((c) => ({
        id: c.id,
        earningType: c.earningType,
        amount: this.toAmount(c.amount),
        ledgerStatus: c.ledgerStatus,
      })),
    );

    const marker = planApproveMarker(primary.id);
    const existingMarker = await this.prisma.shipmentEarning.findFirst({
      where: { reference: marker.reference },
    });
    if (existingMarker || status === 'APPROVED' || status === 'PAID') {
      return this.getEarningDetail(primary.id);
    }

    try {
      assertCanApprove(status);
    } catch (e) {
      if (e instanceof SettlementDomainError) this.throwDomain(e);
      throw e;
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await this.aggregate.appendEarning(tx, {
        shipmentId: primary.shipmentId,
        stopId: primary.stopId,
        courierUserId: primary.courierUserId,
        earningType: marker.earningType,
        amount: marker.amount,
        ledgerStatus: marker.ledgerStatus,
        replacesEarningId: marker.replacesEarningId,
        reference: marker.reference,
        policyCode: marker.policyCode,
        metadataJson: { reason: input.reason ?? null },
      });
      await this.aggregate.appendDomainEvent(tx, {
        shipmentId: primary.shipmentId,
        eventType: 'delivery.earning.adjusted',
        fromStatus: null,
        toStatus: null,
        actorUserId: input.actorUserId,
        message: 'Earning approved',
        payload: { earningId: created.id, action: 'approve' },
      });
      return created;
    });

    this.publish({
      shipmentId: primary.shipmentId,
      eventType: 'delivery.earning.adjusted',
      fromStatus: null,
      toStatus: null,
      actorUserId: input.actorUserId,
      occurredAt: new Date(),
      payload: { action: 'approve', earningId: row.id },
    });

    await this.audit.appendEvent({
      actorUserId: input.actorUserId,
      actorSessionId: input.sessionId ?? null,
      permissionCode: 'delivery.earnings.manage',
      action: 'delivery.earning.approve',
      targetType: 'shipment_earning',
      targetId: primary.id,
      reason: input.reason ?? null,
      outcome: 'SUCCESS',
      ip: input.meta?.ip,
      userAgent: input.meta?.userAgent,
      requestId: input.meta?.requestId,
    });

    return this.getEarningDetail(primary.id);
  }

  async markPaid(input: {
    earningId: string;
    actorUserId: string;
    sessionId?: string | null;
    reason?: string | null;
    meta?: AuditMeta;
  }) {
    const primary = await this.primaryForShipmentOrId(input.earningId);
    const chain = await this.prisma.shipmentEarning.findMany({
      where: { shipmentId: primary.shipmentId },
    });
    const status = resolveSettlementStatus(
      chain.map((c) => ({
        id: c.id,
        earningType: c.earningType,
        amount: this.toAmount(c.amount),
        ledgerStatus: c.ledgerStatus,
      })),
    );

    const marker = planPaidMarker(primary.id);
    const existingMarker = await this.prisma.shipmentEarning.findFirst({
      where: { reference: marker.reference },
    });
    if (existingMarker || status === 'PAID') {
      return this.getEarningDetail(primary.id);
    }

    try {
      assertCanMarkPaid(status);
    } catch (e) {
      if (e instanceof SettlementDomainError) this.throwDomain(e);
      throw e;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.aggregate.appendEarning(tx, {
        shipmentId: primary.shipmentId,
        stopId: primary.stopId,
        courierUserId: primary.courierUserId,
        earningType: marker.earningType,
        amount: marker.amount,
        ledgerStatus: marker.ledgerStatus,
        replacesEarningId: marker.replacesEarningId,
        reference: marker.reference,
        policyCode: marker.policyCode,
        metadataJson: { reason: input.reason ?? null },
      });
      await this.aggregate.appendDomainEvent(tx, {
        shipmentId: primary.shipmentId,
        eventType: 'delivery.earning.adjusted',
        actorUserId: input.actorUserId,
        message: 'Earning marked PAID (ops marker — no payout rail)',
        payload: { action: 'paid', primaryId: primary.id },
      });
    });

    this.publish({
      shipmentId: primary.shipmentId,
      eventType: 'delivery.earning.adjusted',
      fromStatus: null,
      toStatus: null,
      actorUserId: input.actorUserId,
      occurredAt: new Date(),
      payload: { action: 'paid' },
    });

    await this.audit.appendEvent({
      actorUserId: input.actorUserId,
      actorSessionId: input.sessionId ?? null,
      permissionCode: 'delivery.earnings.manage',
      action: 'delivery.earning.mark_paid',
      targetType: 'shipment_earning',
      targetId: primary.id,
      reason: input.reason ?? null,
      outcome: 'SUCCESS',
      ip: input.meta?.ip,
      userAgent: input.meta?.userAgent,
      requestId: input.meta?.requestId,
    });

    return this.getEarningDetail(primary.id);
  }

  async adjustEarning(input: {
    earningId: string;
    correctionAmount: number;
    actorUserId: string;
    sessionId?: string | null;
    reason?: string | null;
    meta?: AuditMeta;
  }) {
    const primary = await this.primaryForShipmentOrId(input.earningId);
    let planned;
    try {
      planned = planAdjustment({
        originalId: primary.id,
        originalAmount: this.toAmount(primary.amount),
        correctionAmount: input.correctionAmount,
        reference: input.reason ?? undefined,
      });
    } catch (e) {
      if (e instanceof SettlementDomainError) this.throwDomain(e);
      throw e;
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await this.aggregate.appendEarning(tx, {
        shipmentId: primary.shipmentId,
        stopId: primary.stopId,
        courierUserId: primary.courierUserId,
        earningType: planned.earningType,
        amount: planned.amount,
        ledgerStatus: planned.ledgerStatus,
        replacesEarningId: planned.replacesEarningId,
        reference: planned.reference,
        policyCode: 'settlement.adjustment',
        metadataJson: { reason: input.reason ?? null },
      });
      await this.aggregate.appendDomainEvent(tx, {
        shipmentId: primary.shipmentId,
        eventType: 'delivery.earning.adjusted',
        actorUserId: input.actorUserId,
        message: 'Earning adjustment',
        payload: {
          earningId: created.id,
          amount: planned.amount,
        },
      });
      return created;
    });

    this.publish({
      shipmentId: primary.shipmentId,
      eventType: 'delivery.earning.adjusted',
      fromStatus: null,
      toStatus: null,
      actorUserId: input.actorUserId,
      occurredAt: new Date(),
      payload: { earningId: row.id },
    });

    await this.audit.appendEvent({
      actorUserId: input.actorUserId,
      actorSessionId: input.sessionId ?? null,
      permissionCode: 'delivery.earnings.manage',
      action: 'delivery.earning.adjust',
      targetType: 'shipment_earning',
      targetId: primary.id,
      reason: input.reason ?? null,
      outcome: 'SUCCESS',
      afterJson: { amount: planned.amount },
      ip: input.meta?.ip,
      userAgent: input.meta?.userAgent,
      requestId: input.meta?.requestId,
    });

    return this.getEarningDetail(primary.id);
  }

  async reverseEarning(input: {
    earningId: string;
    actorUserId: string;
    sessionId?: string | null;
    reason?: string | null;
    meta?: AuditMeta;
  }) {
    const primary = await this.primaryForShipmentOrId(input.earningId);
    const chain = await this.prisma.shipmentEarning.findMany({
      where: { shipmentId: primary.shipmentId },
    });
    const status = resolveSettlementStatus(
      chain.map((c) => ({
        id: c.id,
        earningType: c.earningType,
        amount: this.toAmount(c.amount),
        ledgerStatus: c.ledgerStatus,
      })),
    );
    try {
      assertCanReverse(status);
    } catch (e) {
      if (e instanceof SettlementDomainError) this.throwDomain(e);
      throw e;
    }

    const planned = planReversal({
      originalId: primary.id,
      originalAmount: this.toAmount(primary.amount),
      reference: input.reason ?? undefined,
    });

    await this.prisma.$transaction(async (tx) => {
      await this.aggregate.appendEarning(tx, {
        shipmentId: primary.shipmentId,
        stopId: primary.stopId,
        courierUserId: primary.courierUserId,
        earningType: planned.earningType,
        amount: planned.amount,
        ledgerStatus: planned.ledgerStatus,
        replacesEarningId: planned.replacesEarningId,
        reference: planned.reference,
        policyCode: 'settlement.reversal',
        metadataJson: { reason: input.reason ?? null },
      });
      await this.aggregate.appendDomainEvent(tx, {
        shipmentId: primary.shipmentId,
        eventType: 'delivery.earning.voided',
        actorUserId: input.actorUserId,
        message: 'Earning reversed',
        payload: { primaryId: primary.id, amount: planned.amount },
      });
    });

    this.publish({
      shipmentId: primary.shipmentId,
      eventType: 'delivery.earning.voided',
      fromStatus: null,
      toStatus: null,
      actorUserId: input.actorUserId,
      occurredAt: new Date(),
      payload: { primaryId: primary.id },
    });

    await this.audit.appendEvent({
      actorUserId: input.actorUserId,
      actorSessionId: input.sessionId ?? null,
      permissionCode: 'delivery.earnings.manage',
      action: 'delivery.earning.reverse',
      targetType: 'shipment_earning',
      targetId: primary.id,
      reason: input.reason ?? null,
      outcome: 'SUCCESS',
      ip: input.meta?.ip,
      userAgent: input.meta?.userAgent,
      requestId: input.meta?.requestId,
    });

    return this.getEarningDetail(primary.id);
  }
}
