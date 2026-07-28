/**
 * G8 — Fulfilment orchestration service.
 * Central owner of orchestration_status transitions; dual-writes RC1 OrderStatus
 * and coordinates DispatchService for assignment / timeout / reassign.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchService } from './dispatch.service';
import { ShipmentAggregateService } from './shipment-aggregate.service';
import { SettlementService } from './settlement.service';
import { fulfillmentStatusForOrder } from './fulfillment.rules';
import {
  DEFAULT_ASSIGNMENT_TIMEOUT_MINUTES,
  OrchestrationAction,
  OrchestrationError,
  OrchestrationStatus,
  assignmentOfferExpired,
  canSettle,
  deliveryFullyConfirmed,
  nextOrchestrationStatus,
  orchestrationFromOrderStatus,
  orderStatusForOrchestration,
  pickupFullyConfirmed,
  timestampFieldForStatus,
} from './orchestration.rules';

type Tx = Prisma.TransactionClient;

export type ConfirmParty = 'SELLER' | 'COURIER' | 'BUYER';

@Injectable()
export class FulfillmentOrchestrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: DispatchService,
    private readonly aggregate: ShipmentAggregateService,
    private readonly settlement: SettlementService,
  ) {}

  private throwRules(err: unknown): never {
    if (err instanceof OrchestrationError) {
      throw new BadRequestException(err.message);
    }
    throw err;
  }

  async getByOrderId(orderId: string) {
    const caseRow = await this.ensureCase(orderId);
    return this.shape(caseRow);
  }

  /** Called when buyer payment hits escrow (additive sync). */
  async syncPaid(orderId: string, actorUserId: string) {
    const fc = await this.ensureCase(orderId);
    if (fc.orchestrationStatus === 'PLACED') {
      return this.stripRaw(
        await this.applyAction(orderId, 'MARK_PAID', actorUserId),
      );
    }
    return this.shape(fc);
  }

  async sellerAccept(orderId: string, sellerUserId: string) {
    await this.assertSellerOwnsOrder(orderId, sellerUserId);
    await this.alignPaidIfNeeded(orderId, sellerUserId);
    const result = await this.applyAction(orderId, 'SELLER_ACCEPT', sellerUserId, {
      ensureShipment: true,
    });
    return this.stripRaw(result);
  }

  async startPreparing(orderId: string, sellerUserId: string) {
    await this.assertSellerOwnsOrder(orderId, sellerUserId);
    return this.stripRaw(
      await this.applyAction(orderId, 'START_PREPARING', sellerUserId),
    );
  }

  async markReadyForPickup(orderId: string, sellerUserId: string) {
    await this.assertSellerOwnsOrder(orderId, sellerUserId);
    return this.stripRaw(
      await this.applyAction(orderId, 'MARK_READY_FOR_PICKUP', sellerUserId, {
        ensureShipment: true,
        releaseForAssignment: true,
      }),
    );
  }

  async assignCourier(input: {
    orderId: string;
    actorUserId: string;
    courierUserId?: string | null;
    timeoutMinutes?: number;
  }) {
    const fc = await this.ensureCase(input.orderId);
    if (
      fc.orchestrationStatus !== 'READY_FOR_PICKUP' &&
      fc.orchestrationStatus !== 'COURIER_ASSIGNED'
    ) {
      throw new BadRequestException(
        `Cannot assign courier from orchestration status ${fc.orchestrationStatus}`,
      );
    }

    const shipment = await this.findActiveShipment(fc.id);
    if (!shipment) {
      throw new ConflictException(
        'No active outbound shipment — mark ready for pickup first',
      );
    }

    if (shipment.currentStatus === 'CREATED') {
      await this.dispatch.releaseForAssignment({
        shipmentId: shipment.id,
        actorUserId: input.actorUserId,
        reason: 'G8 ready for courier assignment',
      });
    }

    // If already ASSIGNED with expired offer, timeout first so assign can proceed.
    if (shipment.currentStatus === 'ASSIGNED') {
      const active = await this.prisma.shipmentAssignment.findFirst({
        where: {
          shipmentId: shipment.id,
          isActive: true,
          acceptedAt: null,
          rejectedAt: null,
        },
      });
      if (active && assignmentOfferExpired(active.offerExpiresAt)) {
        await this.dispatch.timeoutAssignment({
          shipmentId: shipment.id,
          actorUserId: input.actorUserId,
          reason: 'Offer expired before reassign',
        });
      }
    }

    const timeoutMin =
      input.timeoutMinutes ?? DEFAULT_ASSIGNMENT_TIMEOUT_MINUTES;
    await this.dispatch.assignShipment({
      shipmentId: shipment.id,
      courierUserId: input.courierUserId,
      actorUserId: input.actorUserId,
      reason: 'G8 orchestration assign',
      offerTimeoutMinutes: timeoutMin,
    });

    return this.applyAction(input.orderId, 'ASSIGN_COURIER', input.actorUserId).then(
      (r) => this.stripRaw(r),
    );
  }

  async listAvailableCouriers(orderId: string) {
    const fc = await this.ensureCase(orderId);
    const shipment = await this.findActiveShipment(fc.id);
    if (!shipment) {
      return { orderId, shipmentId: null, candidates: [] as unknown[] };
    }
    const ranked = await this.dispatch.rankCourierCandidates(shipment.id);
    return {
      orderId,
      shipmentId: shipment.id,
      strategy: ranked.strategy,
      deliveryZone: ranked.deliveryZone,
      maxActiveShipments: ranked.maxActiveShipments,
      candidates: ranked.candidates,
    };
  }

  async confirmPickup(input: {
    orderId: string;
    party: 'SELLER' | 'COURIER';
    actorUserId: string;
  }) {
    const fc = await this.ensureCase(input.orderId);
    if (input.party === 'SELLER') {
      await this.assertSellerOwnsOrder(input.orderId, input.actorUserId);
    } else {
      await this.assertCourierOnOrder(input.orderId, input.actorUserId);
    }

    const now = new Date();
    const data: Prisma.FulfillmentCaseUpdateInput =
      input.party === 'SELLER'
        ? { sellerPickupConfirmedAt: fc.sellerPickupConfirmedAt ?? now }
        : { courierPickupConfirmedAt: fc.courierPickupConfirmedAt ?? now };

    const updated = await this.prisma.fulfillmentCase.update({
      where: { id: fc.id },
      data: { ...data, updatedAt: now },
    });

    await this.appendEvent(fc.id, 'PICKUP_CONFIRM', {
      actorUserId: input.actorUserId,
      fromStatus: fc.orchestrationStatus,
      toStatus: fc.orchestrationStatus,
      message: `${input.party} confirmed pickup`,
      metadata: { party: input.party },
    });

    if (
      pickupFullyConfirmed(updated) &&
      updated.orchestrationStatus === 'COURIER_ASSIGNED'
    ) {
      return this.stripRaw(
        await this.applyAction(input.orderId, 'MARK_PICKED_UP', input.actorUserId, {
          syncShipmentPickup: true,
        }),
      );
    }

    return this.shape(updated);
  }

  async confirmDelivery(input: {
    orderId: string;
    party: 'BUYER' | 'COURIER';
    actorUserId: string;
  }) {
    const fc = await this.ensureCase(input.orderId);
    if (input.party === 'BUYER') {
      await this.assertBuyerOwnsOrder(input.orderId, input.actorUserId);
    } else {
      await this.assertCourierOnOrder(input.orderId, input.actorUserId);
    }

    const now = new Date();
    const data: Prisma.FulfillmentCaseUpdateInput =
      input.party === 'BUYER'
        ? { buyerDeliveryConfirmedAt: fc.buyerDeliveryConfirmedAt ?? now }
        : { courierDeliveryConfirmedAt: fc.courierDeliveryConfirmedAt ?? now };

    let updated = await this.prisma.fulfillmentCase.update({
      where: { id: fc.id },
      data: { ...data, updatedAt: now },
    });

    await this.appendEvent(fc.id, 'DELIVERY_CONFIRM', {
      actorUserId: input.actorUserId,
      fromStatus: fc.orchestrationStatus,
      toStatus: fc.orchestrationStatus,
      message: `${input.party} confirmed delivery`,
      metadata: { party: input.party },
    });

    if (
      ['PICKED_UP', 'IN_TRANSIT'].includes(updated.orchestrationStatus) &&
      deliveryFullyConfirmed(updated)
    ) {
      const delivered = await this.applyAction(
        input.orderId,
        'MARK_DELIVERED',
        input.actorUserId,
      );
      return canSettle({
        orchestrationStatus: delivered.raw.orchestrationStatus,
        deliveryFullyConfirmed: deliveryFullyConfirmed(delivered.raw),
      })
        ? this.settle(input.orderId, input.actorUserId)
        : this.shape(delivered.raw);
    }

    if (
      canSettle({
        orchestrationStatus: updated.orchestrationStatus,
        deliveryFullyConfirmed: deliveryFullyConfirmed(updated),
      })
    ) {
      return this.settle(input.orderId, input.actorUserId);
    }

    return this.shape(updated);
  }

  async markInTransit(orderId: string, actorUserId: string) {
    return this.stripRaw(
      await this.applyAction(orderId, 'MARK_IN_TRANSIT', actorUserId),
    );
  }

  async settle(orderId: string, actorUserId: string) {
    const fc = await this.ensureCase(orderId);
    if (
      !canSettle({
        orchestrationStatus: fc.orchestrationStatus,
        deliveryFullyConfirmed: deliveryFullyConfirmed(fc),
      })
    ) {
      throw new BadRequestException(
        'Settlement requires DELIVERED status and buyer + courier delivery confirmation',
      );
    }

    const shaped = this.stripRaw(
      await this.applyAction(orderId, 'SETTLE', actorUserId),
    );

    const shipment = await this.findActiveShipment(fc.id);
    if (shipment && shipment.currentStatus === 'COMPLETED') {
      await this.settlement
        .accrueOnCompleted({
          shipmentId: shipment.id,
          actorUserId,
        })
        .catch(() => undefined);
    }

    return shaped;
  }

  /**
   * Timeout expired assignment offers and optionally reassign to next available courier.
   */
  async timeoutAndReassign(input: {
    actorUserId: string;
    autoReassign?: boolean;
    limit?: number;
  }) {
    const now = new Date();
    const expired = await this.prisma.shipmentAssignment.findMany({
      where: {
        isActive: true,
        acceptedAt: null,
        rejectedAt: null,
        cancelledAt: null,
        offerExpiresAt: { lte: now },
      },
      take: input.limit ?? 50,
      orderBy: { offerExpiresAt: 'asc' },
    });

    const results: Array<{
      shipmentId: string;
      assignmentId: string;
      timedOut: boolean;
      reassigned: boolean;
      newCourierUserId?: string | null;
      error?: string;
    }> = [];

    for (const row of expired) {
      try {
        await this.dispatch.timeoutAssignment({
          shipmentId: row.shipmentId,
          actorUserId: input.actorUserId,
          reason: 'Assignment offer timed out',
        });

        let reassigned = false;
        let newCourierUserId: string | null = null;
        if (input.autoReassign !== false) {
          try {
            const ranked = await this.dispatch.rankCourierCandidates(
              row.shipmentId,
            );
            const next = ranked.candidates.find(
              (c) => c.userId !== row.courierUserId,
            );
            if (next) {
              await this.dispatch.assignShipment({
                shipmentId: row.shipmentId,
                courierUserId: next.userId,
                actorUserId: input.actorUserId,
                reason: 'G8 auto-reassign after timeout',
                offerTimeoutMinutes: DEFAULT_ASSIGNMENT_TIMEOUT_MINUTES,
              });
              reassigned = true;
              newCourierUserId = next.userId;

              const shipment = await this.prisma.shipment.findFirst({
                where: { id: row.shipmentId, deletedAt: null },
              });
              if (shipment) {
                const fc = await this.prisma.fulfillmentCase.findUnique({
                  where: { id: shipment.fulfillmentId },
                });
                if (
                  fc &&
                  (fc.orchestrationStatus === 'READY_FOR_PICKUP' ||
                    fc.orchestrationStatus === 'COURIER_ASSIGNED')
                ) {
                  await this.applyAction(
                    fc.orderId,
                    'ASSIGN_COURIER',
                    input.actorUserId,
                  );
                }
              }
            }
          } catch (e) {
            results.push({
              shipmentId: row.shipmentId,
              assignmentId: row.id,
              timedOut: true,
              reassigned: false,
              error: e instanceof Error ? e.message : 'reassign failed',
            });
            continue;
          }
        }

        results.push({
          shipmentId: row.shipmentId,
          assignmentId: row.id,
          timedOut: true,
          reassigned,
          newCourierUserId,
        });
      } catch (e) {
        results.push({
          shipmentId: row.shipmentId,
          assignmentId: row.id,
          timedOut: false,
          reassigned: false,
          error: e instanceof Error ? e.message : 'timeout failed',
        });
      }
    }

    return {
      processed: results.length,
      results,
    };
  }

  // ─── internals ───────────────────────────────────────────────────────────

  private stripRaw<T extends { raw?: unknown }>(result: T): Omit<T, 'raw'> {
    const { raw: _raw, ...rest } = result;
    return rest;
  }

  private async alignPaidIfNeeded(orderId: string, actorUserId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const fc = await this.ensureCase(orderId);
    if (
      (order.status === 'PAID_ESCROW' ||
        order.status === 'CONFIRMED' ||
        order.status === 'SHIPPED' ||
        order.status === 'DELIVERED' ||
        order.status === 'COMPLETED') &&
      fc.orchestrationStatus === 'PLACED'
    ) {
      await this.applyAction(orderId, 'MARK_PAID', actorUserId);
    }
  }

  private async applyAction(
    orderId: string,
    action: OrchestrationAction,
    actorUserId: string,
    opts: {
      ensureShipment?: boolean;
      releaseForAssignment?: boolean;
      syncShipmentPickup?: boolean;
    } = {},
  ) {
    let shaped: ReturnType<FulfillmentOrchestrationService['shape']> | null =
      null;
    let rawId: string | null = null;
    let rawCase: Parameters<FulfillmentOrchestrationService['shape']>[0] | null =
      null;

    await this.prisma.$transaction(async (tx) => {
      const fc = await this.ensureCaseTx(tx, orderId);
      let next: OrchestrationStatus;
      try {
        next = nextOrchestrationStatus(action, fc.orchestrationStatus);
      } catch (e) {
        this.throwRules(e);
      }

      const now = new Date();
      const data: Record<string, unknown> = {
        orchestrationStatus: next,
        updatedAt: now,
      };
      const tsField = timestampFieldForStatus(next);
      if (tsField) {
        const current = (fc as Record<string, unknown>)[tsField];
        data[tsField] = current ?? now;
      }

      // Mirror legacy fulfillment.status for coarse handoff
      if (next === 'SELLER_ACCEPTED' || next === 'PREPARING') {
        data.status = 'READY';
        data.readyAt = fc.readyAt ?? now;
      } else if (next === 'READY_FOR_PICKUP' || next === 'COURIER_ASSIGNED') {
        data.status = 'READY';
        data.readyAt = fc.readyAt ?? now;
      } else if (next === 'PICKED_UP' || next === 'IN_TRANSIT') {
        data.status = 'IN_TRANSIT';
        data.shippedAt = fc.shippedAt ?? now;
      } else if (next === 'DELIVERED') {
        data.status = 'DELIVERED';
        data.deliveredAt = fc.deliveredAt ?? now;
      } else if (next === 'SETTLED') {
        data.status = 'CLOSED';
        data.closedAt = fc.closedAt ?? now;
        data.settledAt = fc.settledAt ?? now;
      } else if (next === 'CANCELLED') {
        data.status = 'CLOSED';
        data.closedAt = fc.closedAt ?? now;
      } else if (next === 'EXCEPTION') {
        data.status = 'EXCEPTION';
      } else if (next === 'PAID') {
        data.status = fulfillmentStatusForOrder('PAID_ESCROW');
      }

      const updated = await tx.fulfillmentCase.update({
        where: { id: fc.id },
        data: data as Prisma.FulfillmentCaseUpdateInput,
      });

      const orderMirror = orderStatusForOrchestration(next);
      if (orderMirror) {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (order && order.status !== orderMirror && order.status !== 'DISPUTED') {
          const orderData: Prisma.OrderUpdateInput = {
            status: orderMirror as never,
            updatedAt: now,
          };
          if (next === 'PAID') {
            orderData.paidAt = order.paidAt ?? now;
          }
          if (next === 'DELIVERED') {
            orderData.deliveredAt = order.deliveredAt ?? now;
          }
          if (next === 'SETTLED') {
            orderData.completedAt = order.completedAt ?? now;
            orderData.deliveredAt = order.deliveredAt ?? now;
          }
          // Only advance order status (don't regress RC1 statuses)
          if (this.orderRank(order.status) <= this.orderRank(orderMirror)) {
            await tx.order.update({ where: { id: orderId }, data: orderData });
          }
        }
      }

      await tx.fulfillmentEvent.create({
        data: {
          fulfillmentId: fc.id,
          eventType: `ORCH_${action}`,
          fromStatus: fc.orchestrationStatus,
          toStatus: next,
          message: `Orchestration ${action} → ${next}`,
          actorUserId,
          metadataJson: { orchestration: true, action },
        },
      });

      if (opts.ensureShipment && (next === 'SELLER_ACCEPTED' || next === 'READY_FOR_PICKUP')) {
        await this.aggregate.createOutboundFromFulfillment(tx, {
          fulfillmentId: fc.id,
          actorUserId,
          source: `orchestration.${action.toLowerCase()}`,
        });
      }

      if (opts.syncShipmentPickup) {
        const shipment = await tx.shipment.findFirst({
          where: {
            fulfillmentId: fc.id,
            deletedAt: null,
            currentStatus: { in: ['ACCEPTED', 'ASSIGNED'] },
          },
        });
        if (shipment && shipment.currentStatus === 'ACCEPTED') {
          await this.aggregate.transitionStatus(tx, {
            shipmentId: shipment.id,
            fromStatus: 'ACCEPTED',
            toStatus: 'PICKED_UP',
            actorUserId,
            message: 'G8 dual pickup confirmation',
            timestampFields: { pickedUpAt: now },
          });
        }
      }

      rawId = updated.id;
      rawCase = updated;
      shaped = this.shape(updated);
    });

    if (opts.releaseForAssignment && rawId) {
      const shipment = await this.findActiveShipment(rawId);
      if (shipment && shipment.currentStatus === 'CREATED') {
        await this.dispatch.releaseForAssignment({
          shipmentId: shipment.id,
          actorUserId,
          reason: 'G8 ready for pickup',
        });
      }
    }

    return { ...shaped!, raw: rawCase! };
  }

  private orderRank(status: string): number {
    const order = [
      'PENDING_PAYMENT',
      'PAID_ESCROW',
      'CONFIRMED',
      'SHIPPED',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
      'DISPUTED',
    ];
    const i = order.indexOf(status);
    return i < 0 ? 0 : i;
  }

  private async ensureCase(orderId: string) {
    return this.prisma.$transaction((tx) => this.ensureCaseTx(tx, orderId));
  }

  private async ensureCaseTx(tx: Tx, orderId: string) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const existing = await tx.fulfillmentCase.findUnique({
      where: { orderId },
    });
    if (existing) return existing;

    const orch = orchestrationFromOrderStatus(order.status);
    const handoff = fulfillmentStatusForOrder(order.status);
    return tx.fulfillmentCase.create({
      data: {
        orderId,
        status: handoff,
        orchestrationStatus: orch,
      },
    });
  }

  private async findActiveShipment(fulfillmentId: string) {
    return this.prisma.shipment.findFirst({
      where: {
        fulfillmentId,
        deletedAt: null,
        shipmentType: 'OUTBOUND',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertSellerOwnsOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { farmer: { select: { userId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.farmer.userId !== userId) {
      throw new ForbiddenException('Only the seller may perform this action');
    }
  }

  private async assertBuyerOwnsOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId) {
      throw new ForbiddenException('Only the buyer may perform this action');
    }
  }

  private async assertCourierOnOrder(orderId: string, courierUserId: string) {
    const fc = await this.prisma.fulfillmentCase.findUnique({
      where: { orderId },
    });
    if (!fc) throw new NotFoundException('Fulfillment case not found');
    const shipment = await this.findActiveShipment(fc.id);
    if (!shipment || shipment.courierUserId !== courierUserId) {
      throw new ForbiddenException(
        'Only the assigned courier may perform this action',
      );
    }
  }

  private async appendEvent(
    fulfillmentId: string,
    eventType: string,
    input: {
      actorUserId: string;
      fromStatus: string;
      toStatus: string;
      message: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.prisma.fulfillmentEvent.create({
      data: {
        fulfillmentId,
        eventType,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        message: input.message,
        actorUserId: input.actorUserId,
        metadataJson: input.metadata
          ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  private shape(fc: {
    id: string;
    orderId: string;
    status: string;
    orchestrationStatus: string;
    sellerAcceptedAt: Date | null;
    preparingAt: Date | null;
    readyForPickupAt: Date | null;
    courierAssignedAt: Date | null;
    pickedUpAt: Date | null;
    inTransitAt: Date | null;
    deliveredAt: Date | null;
    settledAt: Date | null;
    sellerPickupConfirmedAt: Date | null;
    courierPickupConfirmedAt: Date | null;
    buyerDeliveryConfirmedAt: Date | null;
    courierDeliveryConfirmedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: fc.id,
      orderId: fc.orderId,
      status: fc.status,
      orchestrationStatus: fc.orchestrationStatus,
      timestamps: {
        sellerAcceptedAt: fc.sellerAcceptedAt,
        preparingAt: fc.preparingAt,
        readyForPickupAt: fc.readyForPickupAt,
        courierAssignedAt: fc.courierAssignedAt,
        pickedUpAt: fc.pickedUpAt,
        inTransitAt: fc.inTransitAt,
        deliveredAt: fc.deliveredAt,
        settledAt: fc.settledAt,
      },
      confirmations: {
        sellerPickupConfirmedAt: fc.sellerPickupConfirmedAt,
        courierPickupConfirmedAt: fc.courierPickupConfirmedAt,
        buyerDeliveryConfirmedAt: fc.buyerDeliveryConfirmedAt,
        courierDeliveryConfirmedAt: fc.courierDeliveryConfirmedAt,
        pickupFullyConfirmed: pickupFullyConfirmed(fc),
        deliveryFullyConfirmed: deliveryFullyConfirmed(fc),
      },
      createdAt: fc.createdAt,
      updatedAt: fc.updatedAt,
    };
  }
}
