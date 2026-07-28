import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type TimelineItem = {
  at: string;
  source: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: string | null;
  message?: string | null;
  reason?: string | null;
};

/**
 * G10 — Unified admin order inspection (order + fulfilment + payment + audit).
 */
@Injectable()
export class OpsOrderInspectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async inspectOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        farmer: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            sellerParty: true,
          },
        },
        sellerParty: true,
        fulfillmentCase: {
          include: {
            events: { orderBy: { createdAt: 'asc' }, take: 100 },
            shipments: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              include: {
                stops: {
                  where: { deletedAt: null },
                  orderBy: { sequence: 'asc' },
                },
                assignments: { orderBy: { assignedAt: 'desc' }, take: 20 },
                events: { orderBy: { occurredAt: 'asc' }, take: 100 },
              },
            },
          },
        },
        paymentCase: {
          include: {
            events: { orderBy: { createdAt: 'asc' }, take: 100 },
            escrowLedger: { orderBy: { createdAt: 'asc' }, take: 100 },
            settlementLines: { orderBy: { createdAt: 'asc' } },
          },
        },
        adminNotes: { orderBy: { createdAt: 'asc' }, take: 50 },
        disputeCase: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const audit = await this.audit.listEvents({
      page: 1,
      limit: 50,
      targetType: 'order',
      targetId: orderId,
    });

    const timeline = this.buildTimeline(order, audit.items ?? []);

    return {
      order: {
        id: order.id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentReference: order.paymentReference,
        buyerChargeEtb: Number(order.buyerChargeEtb ?? order.totalEtb),
        farmerPayoutEtb: Number(order.farmerPayoutEtb),
        courierPayoutEtb: Number(order.courierPayoutEtb),
        paidAt: order.paidAt,
        deliveredAt: order.deliveredAt,
        completedAt: order.completedAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        buyer: order.buyer,
        farmer: order.farmer
          ? {
              id: order.farmer.id,
              userId: order.farmer.userId,
              user: order.farmer.user,
              sellerPartyId: order.farmer.sellerPartyId,
            }
          : null,
        sellerParty: order.sellerParty
          ? {
              id: order.sellerParty.id,
              displayName: order.sellerParty.displayName,
              status: order.sellerParty.status,
              verificationStatus: order.sellerParty.verificationStatus,
              verified: order.sellerParty.verified,
            }
          : null,
      },
      fulfilment: order.fulfillmentCase
        ? {
            id: order.fulfillmentCase.id,
            status: order.fulfillmentCase.status,
            orchestrationStatus: order.fulfillmentCase.orchestrationStatus,
            timestamps: {
              sellerAcceptedAt: order.fulfillmentCase.sellerAcceptedAt,
              readyForPickupAt: order.fulfillmentCase.readyForPickupAt,
              courierAssignedAt: order.fulfillmentCase.courierAssignedAt,
              pickedUpAt: order.fulfillmentCase.pickedUpAt,
              deliveredAt: order.fulfillmentCase.deliveredAt,
              settledAt: order.fulfillmentCase.settledAt,
            },
            confirmations: {
              sellerPickupConfirmedAt:
                order.fulfillmentCase.sellerPickupConfirmedAt,
              courierPickupConfirmedAt:
                order.fulfillmentCase.courierPickupConfirmedAt,
              buyerDeliveryConfirmedAt:
                order.fulfillmentCase.buyerDeliveryConfirmedAt,
              courierDeliveryConfirmedAt:
                order.fulfillmentCase.courierDeliveryConfirmedAt,
            },
            shipments: order.fulfillmentCase.shipments.map((s) => ({
              id: s.id,
              currentStatus: s.currentStatus,
              courierUserId: s.courierUserId,
              assignments: s.assignments,
              events: s.events,
            })),
            events: order.fulfillmentCase.events,
          }
        : null,
      payment: order.paymentCase
        ? {
            id: order.paymentCase.id,
            paymentStatus: order.paymentCase.paymentStatus,
            escrowStatus: order.paymentCase.escrowStatus,
            settlementStatus: order.paymentCase.settlementStatus,
            refundStatus: order.paymentCase.refundStatus,
            amountEtb: Number(order.paymentCase.amountEtb),
            escrow: {
              heldEtb: Number(order.paymentCase.escrowHeldEtb),
              releasedEtb: Number(order.paymentCase.escrowReleasedEtb),
              refundedEtb: Number(order.paymentCase.escrowRefundedEtb),
            },
            settlementLines: order.paymentCase.settlementLines,
            escrowLedger: order.paymentCase.escrowLedger,
            events: order.paymentCase.events,
          }
        : null,
      dispute: order.disputeCase
        ? {
            id: order.disputeCase.id,
            status: order.disputeCase.status,
            refundStatus: order.disputeCase.refundStatus,
          }
        : null,
      adminNotes: order.adminNotes,
      audit: audit.items ?? [],
      timeline,
    };
  }

  private buildTimeline(
    order: {
      createdAt: Date;
      paidAt: Date | null;
      deliveredAt: Date | null;
      completedAt: Date | null;
      status: string;
      adminNotes: Array<{
        createdAt: Date;
        body: string;
        authorUserId: string;
      }>;
      fulfillmentCase: {
        events: Array<{
          createdAt: Date;
          eventType: string;
          fromStatus: string | null;
          toStatus: string | null;
          actorUserId: string | null;
          message: string | null;
        }>;
        shipments: Array<{
          events: Array<{
            occurredAt: Date;
            eventType: string;
            fromStatus: string | null;
            toStatus: string | null;
            actorUserId: string | null;
            message: string | null;
          }>;
        }>;
      } | null;
      paymentCase: {
        events: Array<{
          createdAt: Date;
          eventType: string;
          fromStatus: string | null;
          toStatus: string | null;
          actorUserId: string | null;
          reason: string | null;
          message: string | null;
        }>;
      } | null;
    },
    auditItems: Array<{
      occurredAt: Date;
      action: string;
      actorUserId: string | null;
      reason: string | null;
      outcome: string;
    }>,
  ): TimelineItem[] {
    const items: TimelineItem[] = [];

    items.push({
      at: order.createdAt.toISOString(),
      source: 'order',
      eventType: 'ORDER_PLACED',
      toStatus: 'PENDING_PAYMENT',
      message: 'Order created',
    });
    if (order.paidAt) {
      items.push({
        at: order.paidAt.toISOString(),
        source: 'order',
        eventType: 'ORDER_PAID',
        toStatus: 'PAID_ESCROW',
        message: 'Payment confirmed (escrow)',
      });
    }
    if (order.deliveredAt) {
      items.push({
        at: order.deliveredAt.toISOString(),
        source: 'order',
        eventType: 'ORDER_DELIVERED',
        toStatus: 'DELIVERED',
      });
    }
    if (order.completedAt) {
      items.push({
        at: order.completedAt.toISOString(),
        source: 'order',
        eventType: 'ORDER_COMPLETED',
        toStatus: 'COMPLETED',
      });
    }

    for (const n of order.adminNotes) {
      items.push({
        at: n.createdAt.toISOString(),
        source: 'admin_note',
        eventType: 'ADMIN_NOTE',
        actorUserId: n.authorUserId,
        message: n.body,
      });
    }

    if (order.fulfillmentCase) {
      for (const e of order.fulfillmentCase.events) {
        items.push({
          at: e.createdAt.toISOString(),
          source: 'fulfilment',
          eventType: e.eventType,
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          actorUserId: e.actorUserId,
          message: e.message,
        });
      }
      for (const s of order.fulfillmentCase.shipments) {
        for (const e of s.events) {
          items.push({
            at: e.occurredAt.toISOString(),
            source: 'shipment',
            eventType: e.eventType,
            fromStatus: e.fromStatus,
            toStatus: e.toStatus,
            actorUserId: e.actorUserId,
            message: e.message,
          });
        }
      }
    }

    if (order.paymentCase) {
      for (const e of order.paymentCase.events) {
        items.push({
          at: e.createdAt.toISOString(),
          source: 'payment',
          eventType: e.eventType,
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          actorUserId: e.actorUserId,
          reason: e.reason,
          message: e.message,
        });
      }
    }

    for (const a of auditItems) {
      items.push({
        at: new Date(a.occurredAt).toISOString(),
        source: 'audit',
        eventType: a.action,
        actorUserId: a.actorUserId,
        reason: a.reason,
        message: a.outcome,
      });
    }

    items.sort((a, b) => a.at.localeCompare(b.at));
    return items;
  }
}
