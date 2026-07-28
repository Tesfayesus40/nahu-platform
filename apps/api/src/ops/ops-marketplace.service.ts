import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  isExpiredCourierOffer,
  isStuckOrder,
  OPS_STUCK_ORDER_HOURS_DEFAULT,
} from './ops.rules';

/**
 * G10 — Operational marketplace dashboard + health aggregates.
 */
@Injectable()
export class OpsMarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary() {
    const now = new Date();
    const stuckCutoff = new Date(
      now.getTime() - OPS_STUCK_ORDER_HOURS_DEFAULT * 60 * 60 * 1000,
    );

    const [
      activeOrders,
      awaitingSeller,
      awaitingCourier,
      inTransit,
      paymentsPending,
      escrowHeld,
      settlementsPending,
      refundsPending,
      sellersPendingVerification,
      sellersSuspended,
      couriersOnline,
      expiredOffers,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          status: {
            in: ['PENDING_PAYMENT', 'PAID_ESCROW', 'CONFIRMED', 'SHIPPED', 'DELIVERED'],
          },
        },
      }),
      this.prisma.order.count({ where: { status: 'PAID_ESCROW' } }),
      this.prisma.shipment.count({
        where: {
          deletedAt: null,
          currentStatus: 'AWAITING_ASSIGNMENT',
        },
      }),
      this.prisma.shipment.count({
        where: {
          deletedAt: null,
          currentStatus: { in: ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED'] },
        },
      }),
      this.prisma.paymentCase.count({
        where: {
          paymentStatus: { in: ['CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED'] },
        },
      }),
      this.prisma.paymentCase.aggregate({
        where: { escrowStatus: { in: ['HELD', 'PARTIALLY_RELEASED'] } },
        _sum: { escrowHeldEtb: true },
        _count: true,
      }),
      this.prisma.paymentCase.count({
        where: {
          OR: [
            { paymentStatus: { in: ['ESCROWED', 'PARTIALLY_SETTLED'] } },
            { settlementStatus: { in: ['IN_PROGRESS', 'PARTIAL'] } },
          ],
        },
      }),
      this.prisma.paymentCase.count({
        where: { refundStatus: { in: ['REQUESTED', 'PROCESSING'] } },
      }),
      this.prisma.sellerParty.count({
        where: { verificationStatus: 'PENDING', status: { not: 'SUSPENDED' } },
      }),
      this.prisma.sellerParty.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.courierProfile.count({
        where: {
          deletedAt: null,
          active: true,
          availability: { in: ['ONLINE', 'AVAILABLE'] },
        },
      }),
      this.countExpiredOffers(now),
    ]);

    const stuckOrders = await this.prisma.order.count({
      where: {
        updatedAt: { lte: stuckCutoff },
        status: {
          notIn: ['COMPLETED', 'CANCELLED', 'DISPUTED'],
        },
      },
    });

    const heldSum = Number(escrowHeld._sum.escrowHeldEtb ?? 0);
    const releasedAgg = await this.prisma.paymentCase.aggregate({
      where: { escrowStatus: { in: ['HELD', 'PARTIALLY_RELEASED'] } },
      _sum: { escrowReleasedEtb: true, escrowRefundedEtb: true },
    });
    const availableEscrow = Math.max(
      0,
      heldSum -
        Number(releasedAgg._sum.escrowReleasedEtb ?? 0) -
        Number(releasedAgg._sum.escrowRefundedEtb ?? 0),
    );

    return {
      asOf: now.toISOString(),
      summaries: {
        activeOrders,
        ordersAwaitingSellerAction: awaitingSeller,
        ordersAwaitingCourierAssignment: awaitingCourier,
        deliveriesInTransit: inTransit,
        paymentsPending,
        escrowBalances: {
          casesHeld: escrowHeld._count,
          heldEtb: heldSum,
          availableEtb: availableEscrow,
        },
        settlementsPending,
        refundsPending,
        sellersPendingVerification,
        sellersSuspended,
        couriersOnline,
        stuckOrders,
        expiredCourierOffers: expiredOffers,
      },
    };
  }

  async getHealth() {
    const now = new Date();
    const stuckCutoff = new Date(
      now.getTime() - OPS_STUCK_ORDER_HOURS_DEFAULT * 60 * 60 * 1000,
    );

    const [
      stuckOrders,
      expiredOffers,
      pendingSettlements,
      failedPayments,
      orchestrationExceptions,
      shipmentFailed,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          updatedAt: { lte: stuckCutoff },
          status: { notIn: ['COMPLETED', 'CANCELLED', 'DISPUTED'] },
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          createdAt: true,
        },
        take: 50,
        orderBy: { updatedAt: 'asc' },
      }),
      this.listExpiredOffers(now, 50),
      this.prisma.paymentCase.findMany({
        where: {
          OR: [
            { paymentStatus: { in: ['ESCROWED', 'PARTIALLY_SETTLED'] } },
            { settlementStatus: { in: ['IN_PROGRESS', 'PARTIAL'] } },
          ],
        },
        select: {
          id: true,
          orderId: true,
          paymentStatus: true,
          settlementStatus: true,
          updatedAt: true,
        },
        take: 50,
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.paymentCase.count({ where: { paymentStatus: 'FAILED' } }),
      this.prisma.fulfillmentCase.count({
        where: {
          OR: [
            { orchestrationStatus: 'EXCEPTION' },
            { status: 'EXCEPTION' },
          ],
        },
      }),
      this.prisma.shipment.count({
        where: { deletedAt: null, currentStatus: 'FAILED' },
      }),
    ]);

    const stuck = stuckOrders.filter((o) =>
      isStuckOrder({ orderStatus: o.status, updatedAt: o.updatedAt, now }),
    );

    const healthy =
      stuck.length === 0 &&
      expiredOffers.length === 0 &&
      pendingSettlements.length < 100 &&
      failedPayments === 0;

    return {
      asOf: now.toISOString(),
      healthy,
      workflowHealth: {
        stuckOrders: stuck.length,
        failedPayments,
        orchestrationExceptions,
        failedShipments: shipmentFailed,
      },
      queueHealth: {
        expiredCourierOffers: expiredOffers.length,
        pendingSettlements: pendingSettlements.length,
      },
      samples: {
        stuckOrders: stuck.map((o) => ({
          orderId: o.id,
          status: o.status,
          updatedAt: o.updatedAt,
        })),
        expiredCourierOffers: expiredOffers,
        pendingSettlements: pendingSettlements.map((p) => ({
          paymentCaseId: p.id,
          orderId: p.orderId,
          paymentStatus: p.paymentStatus,
          settlementStatus: p.settlementStatus,
          updatedAt: p.updatedAt,
        })),
      },
    };
  }

  private async countExpiredOffers(now: Date) {
    return this.prisma.shipmentAssignment.count({
      where: {
        isActive: true,
        acceptedAt: null,
        rejectedAt: null,
        cancelledAt: null,
        offerExpiresAt: { lte: now },
      },
    });
  }

  private async listExpiredOffers(now: Date, take: number) {
    const rows = await this.prisma.shipmentAssignment.findMany({
      where: {
        isActive: true,
        acceptedAt: null,
        rejectedAt: null,
        cancelledAt: null,
        offerExpiresAt: { lte: now },
      },
      select: {
        id: true,
        shipmentId: true,
        courierUserId: true,
        offerExpiresAt: true,
        assignedAt: true,
        isActive: true,
        acceptedAt: true,
        rejectedAt: true,
      },
      take,
      orderBy: { offerExpiresAt: 'asc' },
    });
    return rows
      .filter((r) =>
        isExpiredCourierOffer({
          offerExpiresAt: r.offerExpiresAt,
          acceptedAt: r.acceptedAt,
          rejectedAt: r.rejectedAt,
          isActive: r.isActive,
          now,
        }),
      )
      .map((r) => ({
        assignmentId: r.id,
        shipmentId: r.shipmentId,
        courierUserId: r.courierUserId,
        offerExpiresAt: r.offerExpiresAt,
        assignedAt: r.assignedAt,
      }));
  }
}
