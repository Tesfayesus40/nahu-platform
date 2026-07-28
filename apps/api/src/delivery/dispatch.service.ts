import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentAggregateService } from './shipment-aggregate.service';
import { DeliveryConfigService, DeliverySettings } from './delivery-config.service';
import {
  DeliveryEventsPublisher,
  DeliveryLifecyclePublication,
} from './delivery-events.publisher';
import {
  COURIER_SELECTION_STRATEGY,
  CourierSelectionStrategy,
} from './courier-selection.strategy';
import {
  DispatchDomainError,
  DispatchErrorCode,
  DISPATCH_ACTIVE_STATUSES,
  assertCanAccept,
  assertCanAssign,
  assertCanReassign,
  assertCanReject,
  assertCanUnassign,
  assertCourierEligibleForDispatch,
  parseMaxActiveShipments,
} from './dispatch.rules';
import { ShipmentStatus, isShipmentStatus } from './shipment.domain.rules';
import { AuditService } from '../audit/audit.service';
import { CourierNotificationsService } from './courier-notifications.service';

type Tx = Prisma.TransactionClient;

/**
 * D4 — Single owner of assignment / reassignment / unassignment / courier selection.
 * All shipment status mutations go through ShipmentAggregateService.
 * D9 — Fans out via DeliveryEventsPublisher after ShipmentEvent is persisted.
 */
@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregate: ShipmentAggregateService,
    private readonly config: DeliveryConfigService,
    private readonly events: DeliveryEventsPublisher,
    private readonly audit: AuditService,
    private readonly courierNotifications: CourierNotificationsService,
    @Inject(COURIER_SELECTION_STRATEGY)
    private readonly selection: CourierSelectionStrategy,
  ) {}
  private throwDomain(err: DispatchDomainError): never {
    const map: Partial<Record<DispatchErrorCode, new (m: string) => Error>> = {
      SHIPMENT_NOT_FOUND: NotFoundException,
      COURIER_NOT_FOUND: NotFoundException,
      COURIER_NOT_ONLINE: ForbiddenException,
      COURIER_INACTIVE: ForbiddenException,
      COURIER_WORKLOAD_EXCEEDED: ConflictException,
      ACTIVE_ASSIGNMENT_EXISTS: ConflictException,
      NO_ACTIVE_ASSIGNMENT: BadRequestException,
      ASSIGNMENT_WRONG_COURIER: ForbiddenException,
      NO_ELIGIBLE_COURIER: NotFoundException,
    };
    const Ctor = map[err.code] ?? BadRequestException;
    throw new Ctor(err.message);
  }

  private async maxActive(): Promise<number> {
    const raw = await this.config.getSettingText(
      DeliverySettings.maxActiveShipments,
      '3',
    );
    return parseMaxActiveShipments(raw);
  }

  private async countActiveForCourier(tx: Tx, courierUserId: string) {
    return tx.shipment.count({
      where: {
        deletedAt: null,
        courierUserId,
        currentStatus: { in: [...DISPATCH_ACTIVE_STATUSES] },
      },
    });
  }

  private async loadCourierOrThrow(tx: Tx, courierUserId: string) {
    const profile = await tx.courierProfile.findUnique({
      where: { userId: courierUserId },
    });
    const max = await this.maxActive();
    const activeCount = await this.countActiveForCourier(tx, courierUserId);
    try {
      assertCourierEligibleForDispatch({
        exists: Boolean(profile),
        active: profile?.active ?? false,
        deleted: Boolean(profile?.deletedAt),
        availabilityDb: profile?.availability ?? 'OFFLINE',
        activeShipmentCount: activeCount,
        maxActiveShipments: max,
      });
    } catch (e) {
      if (e instanceof DispatchDomainError) this.throwDomain(e);
      throw e;
    }
    return profile!;
  }

  async selectCourier(shipmentId: string) {
    const ranked = await this.rankCourierCandidates(shipmentId);
    const picked = ranked.candidates[0] ?? null;
    if (!picked) {
      this.throwDomain(
        new DispatchDomainError(
          'NO_ELIGIBLE_COURIER',
          'No eligible ONLINE courier for this shipment zone/workload',
        ),
      );
    }
    return {
      courierUserId: picked.userId,
      score: picked.score,
      strategy: ranked.strategy,
      deliveryZone: ranked.deliveryZone,
      maxActiveShipments: ranked.maxActiveShipments,
      candidates: ranked.candidates,
    };
  }

  async rankCourierCandidates(shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
    });
    if (!shipment) {
      this.throwDomain(
        new DispatchDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
      );
    }
    const max = await this.maxActive();
    const profiles = await this.prisma.courierProfile.findMany({
      where: { deletedAt: null, active: true },
    });
    const candidates = await Promise.all(
      profiles.map(async (p) => ({
        userId: p.userId,
        availabilityDb: p.availability,
        active: p.active,
        deletedAt: p.deletedAt,
        serviceRegions: p.serviceRegions ?? [],
        activeShipmentCount: await this.prisma.shipment.count({
          where: {
            deletedAt: null,
            courierUserId: p.userId,
            currentStatus: { in: [...DISPATCH_ACTIVE_STATUSES] },
          },
        }),
      })),
    );
    const scored = candidates
      .map((c) => {
        const result = this.selection.select([c], {
          deliveryZone: shipment.deliveryZone,
          maxActiveShipments: max,
        });
        return result
          ? { userId: c.userId, score: result.score, activeShipmentCount: c.activeShipmentCount }
          : null;
      })
      .filter(Boolean) as Array<{
      userId: string;
      score: number;
      activeShipmentCount: number;
    }>;
    scored.sort((a, b) => b.score - a.score);
    return {
      strategy: this.selection.name,
      deliveryZone: shipment.deliveryZone,
      maxActiveShipments: max,
      candidates: scored,
    };
  }

  /**
   * Assign courier to shipment in AWAITING_ASSIGNMENT.
   * If courierUserId omitted, uses selection strategy.
   */
  async assignShipment(input: {
    shipmentId: string;
    courierUserId?: string | null;
    actorUserId: string;
    reason?: string | null;
    /** G8 — minutes until offer expires (default 15). */
    offerTimeoutMinutes?: number | null;
    audit?: boolean;
    sessionId?: string | null;
    meta?: { ip?: string; userAgent?: string; requestId?: string };
  }) {
    let courierUserId = input.courierUserId ?? null;
    if (!courierUserId) {
      const selected = await this.selectCourier(input.shipmentId);
      courierUserId = selected.courierUserId;
    }

    let publication: DeliveryLifecyclePublication | null = null;
    await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, deletedAt: null },
      });
      if (!shipment) {
        this.throwDomain(
          new DispatchDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
        );
      }

      const active = await this.aggregate.findActiveAssignment(tx, shipment.id);
      try {
        assertCanAssign({
          shipmentStatus: shipment.currentStatus,
          hasActiveAssignment: Boolean(active),
        });
      } catch (e) {
        if (e instanceof DispatchDomainError) this.throwDomain(e);
        throw e;
      }

      await this.loadCourierOrThrow(tx, courierUserId!);

      const timeoutMin = input.offerTimeoutMinutes ?? 15;
      const offerExpiresAt =
        timeoutMin > 0
          ? new Date(Date.now() + timeoutMin * 60_000)
          : null;

      const assignment = await this.aggregate.createActiveAssignment(tx, {
        shipmentId: shipment.id,
        courierUserId: courierUserId!,
        assignedByUserId: input.actorUserId,
        offerExpiresAt,
      });

      const now = new Date();
      await this.aggregate.transitionStatus(tx, {
        shipmentId: shipment.id,
        fromStatus: 'AWAITING_ASSIGNMENT',
        toStatus: 'ASSIGNED',
        actorUserId: input.actorUserId,
        message: input.reason?.trim() || 'Shipment assigned',
        payload: {
          assignmentId: assignment.id,
          courierUserId,
          dispatch: true,
        },
        timestampFields: { assignedAt: now, acceptedAt: null },
        courierUserId,
      });
      publication = {
        shipmentId: shipment.id,
        eventType: 'delivery.shipment.assigned',
        fromStatus: 'AWAITING_ASSIGNMENT',
        toStatus: 'ASSIGNED',
        actorUserId: input.actorUserId,
        occurredAt: now,
        payload: { assignmentId: assignment.id, courierUserId, dispatch: true },
      };
    });

    if (publication) this.events.publish(publication);

    if (courierUserId) {
      await this.courierNotifications
        .notifyShipmentAssigned(courierUserId, input.shipmentId)
        .catch(() => undefined);
      await this.courierNotifications
        .notifyPickupReminder(courierUserId, input.shipmentId)
        .catch(() => undefined);
    }

    if (input.audit) {
      await this.audit.appendEvent({
        actorUserId: input.actorUserId,
        actorSessionId: input.sessionId ?? null,
        permissionCode: 'delivery.manage',
        action: 'delivery.shipment.assign',
        targetType: 'shipment',
        targetId: input.shipmentId,
        reason: input.reason ?? null,
        outcome: 'SUCCESS',
        afterJson: { courierUserId },
        ip: input.meta?.ip,
        userAgent: input.meta?.userAgent,
        requestId: input.meta?.requestId,
      });
    }

    return this.aggregate.getShipmentForDispatch(input.shipmentId);
  }

  async reassignShipment(input: {
    shipmentId: string;
    courierUserId?: string | null;
    actorUserId: string;
    reason?: string | null;
    audit?: boolean;
    sessionId?: string | null;
    meta?: { ip?: string; userAgent?: string; requestId?: string };
  }) {
    let courierUserId = input.courierUserId ?? null;
    if (!courierUserId) {
      const selected = await this.selectCourier(input.shipmentId);
      courierUserId = selected.courierUserId;
    }

    let publication: DeliveryLifecyclePublication | null = null;
    await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, deletedAt: null },
      });
      if (!shipment) {
        this.throwDomain(
          new DispatchDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
        );
      }

      const active = await this.aggregate.findActiveAssignment(tx, shipment.id);
      try {
        assertCanReassign({
          shipmentStatus: shipment.currentStatus,
          hasActiveAssignment: Boolean(active),
        });
      } catch (e) {
        if (e instanceof DispatchDomainError) this.throwDomain(e);
        throw e;
      }

      await this.loadCourierOrThrow(tx, courierUserId!);

      const priorCourierId = active!.courierUserId;
      await this.aggregate.deactivateAssignment(tx, {
        assignmentId: active!.id,
        mode: 'cancel',
        reason: input.reason?.trim() || 'Reassigned',
      });

      const assignment = await this.aggregate.createActiveAssignment(tx, {
        shipmentId: shipment.id,
        courierUserId: courierUserId!,
        assignedByUserId: input.actorUserId,
        offerExpiresAt: new Date(Date.now() + 15 * 60_000),
      });

      const now = new Date();
      const fromStatus = shipment.currentStatus as ShipmentStatus;
      const payload = {
        priorAssignmentId: active!.id,
        priorCourierUserId: priorCourierId,
        assignmentId: assignment.id,
        courierUserId,
      };

      if (fromStatus === 'ACCEPTED') {
        // Return to ASSIGNED for the new courier to accept.
        await this.aggregate.transitionStatus(tx, {
          shipmentId: shipment.id,
          fromStatus: 'ACCEPTED',
          toStatus: 'ASSIGNED',
          actorUserId: input.actorUserId,
          message: input.reason?.trim() || 'Shipment reassigned',
          eventTypeOverride: 'delivery.shipment.reassigned',
          payload,
          timestampFields: { assignedAt: now, acceptedAt: null },
          courierUserId,
        });
        publication = {
          shipmentId: shipment.id,
          eventType: 'delivery.shipment.reassigned',
          fromStatus: 'ACCEPTED',
          toStatus: 'ASSIGNED',
          actorUserId: input.actorUserId,
          occurredAt: now,
          payload,
        };
      } else {
        // Stay ASSIGNED — append reassigned event without status rewrite conflict.
        await tx.shipment.update({
          where: { id: shipment.id },
          data: {
            courierUserId,
            assignedAt: now,
            acceptedAt: null,
            updatedAt: now,
          },
        });
        await this.aggregate.appendDomainEvent(tx, {
          shipmentId: shipment.id,
          eventType: 'delivery.shipment.reassigned',
          fromStatus: 'ASSIGNED',
          toStatus: 'ASSIGNED',
          actorUserId: input.actorUserId,
          assignmentId: assignment.id,
          message: input.reason?.trim() || 'Shipment reassigned',
          payload,
        });
        publication = {
          shipmentId: shipment.id,
          eventType: 'delivery.shipment.reassigned',
          fromStatus: 'ASSIGNED',
          toStatus: 'ASSIGNED',
          actorUserId: input.actorUserId,
          occurredAt: now,
          payload,
        };
      }
    });

    if (publication) this.events.publish(publication);

    if (input.audit) {
      await this.audit.appendEvent({
        actorUserId: input.actorUserId,
        actorSessionId: input.sessionId ?? null,
        permissionCode: 'delivery.manage',
        action: 'delivery.shipment.reassign',
        targetType: 'shipment',
        targetId: input.shipmentId,
        reason: input.reason ?? null,
        outcome: 'SUCCESS',
        afterJson: { courierUserId },
        ip: input.meta?.ip,
        userAgent: input.meta?.userAgent,
        requestId: input.meta?.requestId,
      });
    }

    return this.aggregate.getShipmentForDispatch(input.shipmentId);
  }

  async unassignShipment(input: {
    shipmentId: string;
    actorUserId: string;
    reason?: string | null;
    audit?: boolean;
    sessionId?: string | null;
    meta?: { ip?: string; userAgent?: string; requestId?: string };
  }) {
    let publication: DeliveryLifecyclePublication | null = null;
    let fromStatus: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, deletedAt: null },
      });
      if (!shipment) {
        this.throwDomain(
          new DispatchDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
        );
      }

      const active = await this.aggregate.findActiveAssignment(tx, shipment.id);
      try {
        assertCanUnassign({
          shipmentStatus: shipment.currentStatus,
          hasActiveAssignment: Boolean(active),
        });
      } catch (e) {
        if (e instanceof DispatchDomainError) this.throwDomain(e);
        throw e;
      }

      await this.aggregate.deactivateAssignment(tx, {
        assignmentId: active!.id,
        mode: 'cancel',
        reason: input.reason?.trim() || 'Unassigned',
      });

      if (!isShipmentStatus(shipment.currentStatus)) {
        throw new BadRequestException('Invalid shipment status');
      }

      fromStatus = shipment.currentStatus;
      const now = new Date();
      await this.aggregate.transitionStatus(tx, {
        shipmentId: shipment.id,
        fromStatus: shipment.currentStatus as ShipmentStatus,
        toStatus: 'AWAITING_ASSIGNMENT',
        actorUserId: input.actorUserId,
        message: input.reason?.trim() || 'Shipment unassigned',
        payload: {
          priorAssignmentId: active!.id,
          unassigned: true,
        },
        timestampFields: { acceptedAt: null },
        courierUserId: null,
      });
      publication = {
        shipmentId: shipment.id,
        eventType: 'delivery.shipment.awaiting_assignment',
        fromStatus,
        toStatus: 'AWAITING_ASSIGNMENT',
        actorUserId: input.actorUserId,
        occurredAt: now,
        payload: { priorAssignmentId: active!.id, unassigned: true },
      };
    });

    if (publication) this.events.publish(publication);

    if (input.audit) {
      await this.audit.appendEvent({
        actorUserId: input.actorUserId,
        actorSessionId: input.sessionId ?? null,
        permissionCode: 'delivery.manage',
        action: 'delivery.shipment.unassign',
        targetType: 'shipment',
        targetId: input.shipmentId,
        reason: input.reason ?? null,
        outcome: 'SUCCESS',
        ip: input.meta?.ip,
        userAgent: input.meta?.userAgent,
        requestId: input.meta?.requestId,
      });
    }

    return this.aggregate.getShipmentForDispatch(input.shipmentId);
  }

  /**
   * G8 — expire an unaccepted assignment offer and return shipment to AWAITING_ASSIGNMENT.
   */
  async timeoutAssignment(input: {
    shipmentId: string;
    actorUserId: string;
    reason?: string | null;
  }) {
    let publication: DeliveryLifecyclePublication | null = null;
    await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, deletedAt: null },
      });
      if (!shipment) {
        this.throwDomain(
          new DispatchDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
        );
      }

      const active = await this.aggregate.findActiveAssignment(tx, shipment.id);
      if (!active) {
        this.throwDomain(
          new DispatchDomainError(
            'NO_ACTIVE_ASSIGNMENT',
            'No active assignment to timeout',
          ),
        );
      }
      if (active.acceptedAt) {
        throw new ConflictException('Cannot timeout an accepted assignment');
      }

      await this.aggregate.deactivateAssignment(tx, {
        assignmentId: active.id,
        mode: 'cancel',
        reason: input.reason?.trim() || 'Assignment offer timed out',
      });

      if (!isShipmentStatus(shipment.currentStatus)) {
        throw new BadRequestException('Invalid shipment status');
      }

      const fromStatus = shipment.currentStatus as ShipmentStatus;
      if (fromStatus !== 'ASSIGNED' && fromStatus !== 'AWAITING_ASSIGNMENT') {
        throw new BadRequestException(
          `Cannot timeout assignment while shipment is ${fromStatus}`,
        );
      }

      const now = new Date();
      if (fromStatus === 'ASSIGNED') {
        await this.aggregate.transitionStatus(tx, {
          shipmentId: shipment.id,
          fromStatus: 'ASSIGNED',
          toStatus: 'AWAITING_ASSIGNMENT',
          actorUserId: input.actorUserId,
          message: input.reason?.trim() || 'Assignment offer timed out',
          eventTypeOverride: 'delivery.shipment.assignment_timed_out',
          payload: {
            priorAssignmentId: active.id,
            timedOut: true,
          },
          timestampFields: { acceptedAt: null },
          courierUserId: null,
        });
      } else {
        await tx.shipment.update({
          where: { id: shipment.id },
          data: { courierUserId: null, assignedAt: null, updatedAt: now },
        });
        await this.aggregate.appendDomainEvent(tx, {
          shipmentId: shipment.id,
          eventType: 'delivery.shipment.assignment_timed_out',
          fromStatus: 'AWAITING_ASSIGNMENT',
          toStatus: 'AWAITING_ASSIGNMENT',
          actorUserId: input.actorUserId,
          assignmentId: active.id,
          message: input.reason?.trim() || 'Assignment offer timed out',
          payload: { priorAssignmentId: active.id, timedOut: true },
        });
      }

      publication = {
        shipmentId: shipment.id,
        eventType: 'delivery.shipment.assignment_timed_out',
        fromStatus,
        toStatus: 'AWAITING_ASSIGNMENT',
        actorUserId: input.actorUserId,
        occurredAt: now,
        payload: { priorAssignmentId: active.id, timedOut: true },
      };
    });

    if (publication) this.events.publish(publication);
    return this.aggregate.getShipmentForDispatch(input.shipmentId);
  }

  async acceptAssignment(courierUserId: string, shipmentId: string) {
    let publication: DeliveryLifecyclePublication | null = null;
    await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, deletedAt: null },
      });
      if (!shipment) {
        this.throwDomain(
          new DispatchDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
        );
      }

      let active = await this.aggregate.findActiveAssignment(tx, shipmentId);
      if (!active && shipment.courierUserId === courierUserId) {
        active = await this.aggregate.createActiveAssignment(tx, {
          shipmentId,
          courierUserId,
        });
      }

      try {
        assertCanAccept({
          shipmentStatus: shipment.currentStatus,
          assignmentCourierId: active?.courierUserId ?? shipment.courierUserId,
          actorCourierId: courierUserId,
        });
      } catch (e) {
        if (e instanceof DispatchDomainError) this.throwDomain(e);
        throw e;
      }

      if (!active) {
        this.throwDomain(
          new DispatchDomainError(
            'NO_ACTIVE_ASSIGNMENT',
            'No active assignment for this courier',
          ),
        );
      }

      if (
        active.offerExpiresAt &&
        active.offerExpiresAt.getTime() <= Date.now() &&
        !active.acceptedAt
      ) {
        throw new ConflictException(
          'Assignment offer has expired — wait for reassignment',
        );
      }

      if (shipment.currentStatus === 'ACCEPTED') {
        return;
      }

      await this.aggregate.markAssignmentAccepted(tx, active.id);
      const now = new Date();
      await this.aggregate.transitionStatus(tx, {
        shipmentId,
        fromStatus: 'ASSIGNED',
        toStatus: 'ACCEPTED',
        actorUserId: courierUserId,
        message: 'Courier accepted shipment',
        payload: { assignmentId: active.id },
        timestampFields: { acceptedAt: now },
        courierUserId,
      });
      publication = {
        shipmentId,
        eventType: 'delivery.shipment.accepted',
        fromStatus: 'ASSIGNED',
        toStatus: 'ACCEPTED',
        actorUserId: courierUserId,
        occurredAt: now,
        payload: { assignmentId: active.id },
      };
    });

    if (publication) this.events.publish(publication);

    if (publication) {
      await this.courierNotifications
        .notifyShipmentAccepted(courierUserId, shipmentId)
        .catch(() => undefined);
    }

    return this.aggregate.getCourierShipment(courierUserId, shipmentId);
  }

  async rejectAssignment(
    courierUserId: string,
    shipmentId: string,
    reason?: string,
  ) {
    let publication: DeliveryLifecyclePublication | null = null;
    let fromStatus: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, deletedAt: null },
      });
      if (!shipment) {
        this.throwDomain(
          new DispatchDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
        );
      }

      const active = await this.aggregate.findActiveAssignment(tx, shipmentId);
      try {
        assertCanReject({
          shipmentStatus: shipment.currentStatus,
          assignmentCourierId: active?.courierUserId ?? shipment.courierUserId,
          actorCourierId: courierUserId,
        });
      } catch (e) {
        if (e instanceof DispatchDomainError) this.throwDomain(e);
        throw e;
      }

      if (active) {
        await this.aggregate.deactivateAssignment(tx, {
          assignmentId: active.id,
          mode: 'reject',
          reason: reason?.trim() || null,
        });
      }

      fromStatus = shipment.currentStatus;
      const now = new Date();
      await this.aggregate.transitionStatus(tx, {
        shipmentId,
        fromStatus: shipment.currentStatus as ShipmentStatus,
        toStatus: 'AWAITING_ASSIGNMENT',
        actorUserId: courierUserId,
        message: reason?.trim() || 'Courier rejected shipment',
        eventTypeOverride: 'delivery.shipment.rejected',
        payload: {
          assignmentId: active?.id ?? null,
          rejected: true,
        },
        timestampFields: { acceptedAt: null },
        courierUserId: null,
      });
      publication = {
        shipmentId,
        eventType: 'delivery.shipment.rejected',
        fromStatus,
        toStatus: 'AWAITING_ASSIGNMENT',
        actorUserId: courierUserId,
        occurredAt: now,
        payload: { assignmentId: active?.id ?? null, rejected: true },
      };
    });

    if (publication) this.events.publish(publication);

    return this.aggregate.getCourierShipment(courierUserId, shipmentId);
  }

  /** CREATED → AWAITING_ASSIGNMENT so assignShipment can run. */
  async releaseForAssignment(input: {
    shipmentId: string;
    actorUserId: string;
    reason?: string | null;
  }) {
    let publication: DeliveryLifecyclePublication | null = null;
    await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, deletedAt: null },
      });
      if (!shipment) {
        this.throwDomain(
          new DispatchDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
        );
      }
      if (shipment.currentStatus === 'AWAITING_ASSIGNMENT') {
        return;
      }
      if (shipment.currentStatus !== 'CREATED') {
        throw new BadRequestException(
          `Cannot release shipment in status ${shipment.currentStatus}`,
        );
      }
      const now = new Date();
      await this.aggregate.transitionStatus(tx, {
        shipmentId: shipment.id,
        fromStatus: 'CREATED',
        toStatus: 'AWAITING_ASSIGNMENT',
        actorUserId: input.actorUserId,
        message: input.reason?.trim() || 'Released for assignment',
        payload: { dispatch: true },
      });
      publication = {
        shipmentId: shipment.id,
        eventType: 'delivery.shipment.awaiting_assignment',
        fromStatus: 'CREATED',
        toStatus: 'AWAITING_ASSIGNMENT',
        actorUserId: input.actorUserId,
        occurredAt: now,
        payload: { dispatch: true },
      };
    });
    if (publication) this.events.publish(publication);
    return this.aggregate.getShipmentForDispatch(input.shipmentId);
  }
}
