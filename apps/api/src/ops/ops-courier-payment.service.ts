import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchService } from '../delivery/dispatch.service';
import { AuditService } from '../audit/audit.service';
import { auditActionPrefixesForDomain } from './ops.rules';

/**
 * G10 — Courier ops views + payment ops lists + audit domain search.
 */
@Injectable()
export class OpsCourierPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: DispatchService,
    private readonly audit: AuditService,
  ) {}

  async listCouriers(query: {
    page?: number;
    limit?: number;
    availability?: string;
    activeOnly?: boolean;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Record<string, unknown> = { deletedAt: null };
    if (query.activeOnly !== false) where.active = true;
    if (query.availability) where.availability = query.availability;

    const [total, rows] = await Promise.all([
      this.prisma.courierProfile.count({ where }),
      this.prisma.courierProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const items = await Promise.all(
      rows.map(async (c) => {
        const activeAssignments = await this.prisma.shipment.count({
          where: {
            deletedAt: null,
            courierUserId: c.userId,
            currentStatus: {
              in: [
                'ASSIGNED',
                'ACCEPTED',
                'PICKED_UP',
                'IN_TRANSIT',
                'ARRIVED',
              ],
            },
          },
        });
        return {
          userId: c.userId,
          displayName: c.displayName,
          phone: c.phone,
          active: c.active,
          verified: c.verified,
          verificationStatus: c.verificationStatus,
          availability: c.availability,
          activeAssignments,
          updatedAt: c.updatedAt,
        };
      }),
    );

    return { page, limit, total, items };
  }

  async getCourierAssignments(courierUserId: string) {
    const assignments = await this.prisma.shipmentAssignment.findMany({
      where: { courierUserId },
      orderBy: { assignedAt: 'desc' },
      take: 50,
      include: {
        shipment: {
          select: {
            id: true,
            currentStatus: true,
            fulfillmentId: true,
            deliveryZone: true,
          },
        },
      },
    });
    return {
      courierUserId,
      assignments: assignments.map((a) => ({
        id: a.id,
        shipmentId: a.shipmentId,
        shipmentStatus: a.shipment?.currentStatus ?? null,
        assignedAt: a.assignedAt,
        offerExpiresAt: a.offerExpiresAt,
        acceptedAt: a.acceptedAt,
        rejectedAt: a.rejectedAt,
        cancelledAt: a.cancelledAt,
        isActive: a.isActive,
        rejectReason: a.rejectReason,
      })),
    };
  }

  async reassignShipment(input: {
    shipmentId: string;
    courierUserId: string;
    actorUserId: string;
    reason?: string | null;
    sessionId?: string | null;
    meta?: { ip?: string; userAgent?: string; requestId?: string };
  }) {
    return this.dispatch.reassignShipment({
      shipmentId: input.shipmentId,
      courierUserId: input.courierUserId,
      actorUserId: input.actorUserId,
      reason: input.reason ?? 'Ops reassign',
      audit: true,
      sessionId: input.sessionId,
      meta: input.meta,
    });
  }

  async listPayments(query: {
    page?: number;
    limit?: number;
    paymentStatus?: string;
    escrowStatus?: string;
    settlementStatus?: string;
    refundStatus?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Record<string, unknown> = {};
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.escrowStatus) where.escrowStatus = query.escrowStatus;
    if (query.settlementStatus) where.settlementStatus = query.settlementStatus;
    if (query.refundStatus) where.refundStatus = query.refundStatus;

    const [total, rows] = await Promise.all([
      this.prisma.paymentCase.count({ where }),
      this.prisma.paymentCase.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          settlementLines: true,
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        providerCode: r.providerCode,
        paymentStatus: r.paymentStatus,
        escrowStatus: r.escrowStatus,
        settlementStatus: r.settlementStatus,
        refundStatus: r.refundStatus,
        amountEtb: Number(r.amountEtb),
        escrowHeldEtb: Number(r.escrowHeldEtb),
        escrowReleasedEtb: Number(r.escrowReleasedEtb),
        escrowRefundedEtb: Number(r.escrowRefundedEtb),
        isStubProvider: true,
        settlementNote:
          'Provider rails are stubs — intents are not live cash settlement.',
        settlementLines: r.settlementLines.map((l) => ({
          partyCode: l.partyCode,
          amountEtb: Number(l.amountEtb),
          status: l.status,
          releasedAt: l.releasedAt,
        })),
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
      })),
    };
  }

  async getPaymentDetail(orderId: string) {
    const pc = await this.prisma.paymentCase.findUnique({
      where: { orderId },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        escrowLedger: { orderBy: { createdAt: 'asc' } },
        settlementLines: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!pc) return null;
    return {
      id: pc.id,
      orderId: pc.orderId,
      paymentStatus: pc.paymentStatus,
      escrowStatus: pc.escrowStatus,
      settlementStatus: pc.settlementStatus,
      refundStatus: pc.refundStatus,
      providerCode: pc.providerCode,
      isStubProvider: true,
      settlementNote:
        'Provider rails are stubs — intents are not live cash settlement. Escrow/settlement statuses are platform ledger state only.',
      lifecycle: {
        pendingAt: pc.pendingAt,
        authorizedAt: pc.authorizedAt,
        capturedAt: pc.capturedAt,
        escrowedAt: pc.escrowedAt,
        settledAt: pc.settledAt,
        refundedAt: pc.refundedAt,
        failedAt: pc.failedAt,
        cancelledAt: pc.cancelledAt,
      },
      escrow: {
        heldEtb: Number(pc.escrowHeldEtb),
        releasedEtb: Number(pc.escrowReleasedEtb),
        refundedEtb: Number(pc.escrowRefundedEtb),
        ledger: pc.escrowLedger,
      },
      settlementHistory: pc.settlementLines,
      refundHistory: pc.events.filter((e) =>
        String(e.eventType).includes('REFUND'),
      ),
      events: pc.events,
    };
  }

  /**
   * Domain-scoped audit search (orders / fulfilment / payments / sellers).
   * Uses existing AuditService filters.
   */
  async searchAudit(query: {
    domain?: string;
    page?: number;
    limit?: number;
    actorUserId?: string;
    targetType?: string;
    targetId?: string;
    action?: string;
    from?: string;
    to?: string;
  }) {
    const prefixes = query.domain
      ? auditActionPrefixesForDomain(query.domain)
      : [];
    // When domain has multiple prefixes, use first as actionPrefix and rely on client
    // for others — or run parallel and merge. Prefer single prefix for simplicity.
    const actionPrefix =
      query.action ? undefined : prefixes[0] ?? undefined;

    return this.audit.listEvents({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      actorUserId: query.actorUserId,
      targetType: query.targetType,
      targetId: query.targetId,
      action: query.action,
      actionPrefix,
      from: query.from,
      to: query.to,
    });
  }
}
