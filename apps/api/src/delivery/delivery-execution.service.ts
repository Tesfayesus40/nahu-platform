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
import { DeliveryEventsPublisher } from './delivery-events.publisher';
import { ProofOfDeliveryService } from './proof-of-delivery.service';
import { SettlementService } from './settlement.service';
import {
  ExecutionAction,
  ExecutionDomainError,
  ExecutionErrorCode,
  assertCourierMayExecute,
  planExecutionAction,
} from './execution.rules';
import { ShipmentStatus, isShipmentStatus } from './shipment.domain.rules';
import { PodCaptureInput } from './pod.rules';

type Tx = Prisma.TransactionClient;

/**
 * D5 — Owns post-accept execution. Assignment remains DispatchService.
 * All status changes go through ShipmentAggregateService.
 * D10 — ARRIVED → DELIVERED is gated by ProofOfDeliveryService.
 * D11 — COMPLETED triggers SettlementService accrual.
 */
@Injectable()
export class DeliveryExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregate: ShipmentAggregateService,
    private readonly config: DeliveryConfigService,
    private readonly events: DeliveryEventsPublisher,
    private readonly pod: ProofOfDeliveryService,
    private readonly settlement: SettlementService,
  ) {}

  private throwDomain(err: ExecutionDomainError): never {
    const map: Partial<Record<ExecutionErrorCode, new (m: string) => Error>> = {
      SHIPMENT_NOT_FOUND: NotFoundException,
      NOT_ASSIGNED_COURIER: ForbiddenException,
      NO_ACTIVE_ASSIGNMENT: ForbiddenException,
      TERMINAL_SHIPMENT: ConflictException,
      BUYER_CONFIRM_REQUIRED: ConflictException,
      INVALID_STATUS: BadRequestException,
      ILLEGAL_TRANSITION: BadRequestException,
    };
    const Ctor = map[err.code] ?? BadRequestException;
    throw new Ctor(err.message);
  }

  private async authorizeCourier(
    tx: Tx,
    shipmentId: string,
    courierUserId: string,
  ) {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
    });
    if (!shipment) {
      this.throwDomain(
        new ExecutionDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
      );
    }
    const active = await this.aggregate.findActiveAssignment(tx, shipmentId);
    try {
      assertCourierMayExecute({
        shipmentStatus: shipment.currentStatus,
        courierUserId,
        assignmentCourierId: active?.courierUserId ?? null,
        denormCourierUserId: shipment.courierUserId,
      });
    } catch (e) {
      if (e instanceof ExecutionDomainError) this.throwDomain(e);
      throw e;
    }
    // Active assignment is mandatory for execution (denorm alone is insufficient).
    if (!active) {
      this.throwDomain(
        new ExecutionDomainError(
          'NO_ACTIVE_ASSIGNMENT',
          'No active assignment on shipment',
        ),
      );
    }
    if (active.courierUserId !== courierUserId) {
      this.throwDomain(
        new ExecutionDomainError(
          'NOT_ASSIGNED_COURIER',
          'Only the assigned courier may execute this shipment',
        ),
      );
    }
    return { shipment, assignment: active };
  }

  private async runAction(
    courierUserId: string,
    shipmentId: string,
    action: ExecutionAction,
    message?: string,
  ) {
    const buyerConfirmRequired = await this.config.buyerConfirmRequired();
    let publication: {
      shipmentId: string;
      eventType: string;
      fromStatus: string | null;
      toStatus: string | null;
      actorUserId: string | null;
      occurredAt: Date;
      payload?: Record<string, unknown> | null;
    } | null = null;
    let settlementPublication: {
      shipmentId: string;
      eventType: string;
      fromStatus: string | null;
      toStatus: string | null;
      actorUserId: string | null;
      occurredAt: Date;
      payload?: Record<string, unknown> | null;
    } | null = null;

    await this.prisma.$transaction(async (tx) => {
      const { shipment } = await this.authorizeCourier(
        tx,
        shipmentId,
        courierUserId,
      );

      if (!isShipmentStatus(shipment.currentStatus)) {
        this.throwDomain(
          new ExecutionDomainError(
            'INVALID_STATUS',
            `Invalid shipment status ${shipment.currentStatus}`,
          ),
        );
      }

      let hasPickupStarted = false;
      if (action === 'startPickup') {
        const prior = await tx.shipmentEvent.findFirst({
          where: {
            shipmentId,
            eventType: 'delivery.shipment.pickup_started',
          },
          select: { id: true },
        });
        hasPickupStarted = Boolean(prior);
      }

      const planned = planExecutionAction({
        action,
        currentStatus: shipment.currentStatus,
        buyerConfirmRequired,
        hasPickupStarted,
      });
      if (!planned.ok) {
        this.throwDomain(planned.error);
      }

      if (planned.idempotent) {
        // No new ShipmentEvent / no re-publish — status already correct.
        return;
      }

      const fromStatus = shipment.currentStatus as ShipmentStatus;
      const now = new Date();

      if (planned.nextStatus == null) {
        // Event-only (startPickup)
        await this.aggregate.appendDomainEvent(tx, {
          shipmentId,
          eventType: planned.eventType,
          fromStatus,
          toStatus: fromStatus,
          actorUserId: courierUserId,
          message: message ?? 'Pickup started',
          payload: { action, execution: true },
        });
        publication = {
          shipmentId,
          eventType: planned.eventType,
          fromStatus,
          toStatus: fromStatus,
          actorUserId: courierUserId,
          occurredAt: now,
          payload: { action, execution: true },
        };
        return;
      }

      const timestamps: Record<string, Date> = {};
      if (planned.nextStatus === 'PICKED_UP') timestamps.pickedUpAt = now;
      if (planned.nextStatus === 'ARRIVED') timestamps.arrivedAt = now;
      if (planned.nextStatus === 'DELIVERED') timestamps.deliveredAt = now;
      if (planned.nextStatus === 'COMPLETED') timestamps.completedAt = now;
      if (planned.nextStatus === 'FAILED') timestamps.failedAt = now;

      await this.aggregate.transitionStatus(tx, {
        shipmentId,
        fromStatus,
        toStatus: planned.nextStatus,
        actorUserId: courierUserId,
        message: message ?? `Execution: ${action}`,
        eventTypeOverride: planned.eventType,
        payload: { action, execution: true },
        timestampFields: timestamps,
      });

      if (planned.nextStatus === 'ARRIVED') {
        await this.pod.afterArrived(tx, shipmentId);
        const dropoff = await tx.shipmentStop.findFirst({
          where: {
            shipmentId,
            deletedAt: null,
            stopType: { in: ['DROPOFF', 'RETURN_DROPOFF'] },
          },
          orderBy: { sequence: 'desc' },
        });
        if (dropoff && dropoff.status === 'PENDING') {
          await this.aggregate.updateStopStatus(tx, {
            stopId: dropoff.id,
            status: 'ARRIVED',
            arrivedAt: now,
          });
        }
      }

      if (planned.nextStatus === 'COMPLETED') {
        const accrued = await this.settlement.accrueOnCompleted({
          shipmentId,
          actorUserId: courierUserId,
          tx,
        });
        settlementPublication = accrued.publication;
      }

      publication = {
        shipmentId,
        eventType: planned.eventType,
        fromStatus,
        toStatus: planned.nextStatus,
        actorUserId: courierUserId,
        occurredAt: now,
        payload: { action, execution: true },
      };
    });

    if (publication) {
      this.events.publish(publication);
    }
    if (settlementPublication) {
      this.events.publish(settlementPublication);
    }

    return this.aggregate.getCourierShipment(courierUserId, shipmentId);
  }

  startPickup(courierUserId: string, shipmentId: string) {
    return this.runAction(courierUserId, shipmentId, 'startPickup');
  }

  confirmPickup(courierUserId: string, shipmentId: string) {
    return this.runAction(courierUserId, shipmentId, 'confirmPickup');
  }

  startTransit(courierUserId: string, shipmentId: string) {
    return this.runAction(courierUserId, shipmentId, 'startTransit');
  }

  arriveAtDestination(courierUserId: string, shipmentId: string) {
    return this.runAction(courierUserId, shipmentId, 'arriveAtDestination');
  }

  /**
   * ARRIVED → DELIVERED only after ProofOfDeliveryService validates POD.
   */
  markDelivered(
    courierUserId: string,
    shipmentId: string,
    capture: PodCaptureInput = {},
  ) {
    return this.pod.completeDropoffAndDeliver(
      courierUserId,
      shipmentId,
      capture,
    );
  }

  completeDelivery(courierUserId: string, shipmentId: string) {
    return this.runAction(courierUserId, shipmentId, 'completeDelivery');
  }

  markFailed(courierUserId: string, shipmentId: string, reason?: string) {
    return this.runAction(courierUserId, shipmentId, 'markFailed', reason);
  }

  markReturned(courierUserId: string, shipmentId: string, reason?: string) {
    return this.runAction(courierUserId, shipmentId, 'markReturned', reason);
  }
}
