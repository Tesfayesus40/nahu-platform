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
import { ShipmentStatus } from './shipment.domain.rules';
import {
  assertCourierMayExecute,
  ExecutionDomainError,
} from './execution.rules';
import {
  PodCaptureInput,
  PodDomainError,
  PodRequirements,
  POD_EVENT_TYPES,
  generateDeliveryOtp,
  hashDeliveryOtp,
  toAdminPodView,
  toPartyPodStatus,
  validatePodAgainstRequirements,
  verifyDeliveryOtp,
} from './pod.rules';

type Tx = Prisma.TransactionClient;

/**
 * D10 — Owns POD create / validate / verify / complete inside the Shipment aggregate.
 * ARRIVED → DELIVERED is gated here; DeliveryExecutionService delegates deliver here.
 */
@Injectable()
export class ProofOfDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregate: ShipmentAggregateService,
    private readonly config: DeliveryConfigService,
    private readonly events: DeliveryEventsPublisher,
  ) {}

  private throwDomain(err: PodDomainError | ExecutionDomainError): never {
    if (err instanceof ExecutionDomainError) {
      const map: Record<string, new (m: string) => Error> = {
        SHIPMENT_NOT_FOUND: NotFoundException,
        NOT_ASSIGNED_COURIER: ForbiddenException,
        NO_ACTIVE_ASSIGNMENT: ForbiddenException,
        TERMINAL_SHIPMENT: ConflictException,
        INVALID_STATUS: BadRequestException,
      };
      const Ctor = map[err.code] ?? BadRequestException;
      throw new Ctor(err.message);
    }
    const map: Partial<Record<PodDomainError['code'], new (m: string) => Error>> =
      {
        SHIPMENT_NOT_FOUND: NotFoundException,
        STOP_NOT_FOUND: NotFoundException,
        NOT_ASSIGNED_COURIER: ForbiddenException,
        INVALID_STATUS: BadRequestException,
        POD_REQUIREMENTS_FAILED: BadRequestException,
        OTP_INVALID: BadRequestException,
        OTP_REQUIRED: BadRequestException,
        PHOTO_REQUIRED: BadRequestException,
        GPS_REQUIRED: BadRequestException,
        RECIPIENT_REQUIRED: BadRequestException,
        SIGNATURE_NOT_SUPPORTED: BadRequestException,
      };
    const Ctor = map[err.code] ?? BadRequestException;
    throw new Ctor(err.message);
  }

  async getRequirements(): Promise<PodRequirements> {
    return this.config.podRequirements();
  }

  private metaOf(shipment: { metadataJson: Prisma.JsonValue | null }) {
    if (shipment.metadataJson && typeof shipment.metadataJson === 'object') {
      return shipment.metadataJson as Record<string, unknown>;
    }
    return {};
  }

  /**
   * Issue (or refresh) delivery OTP into shipment.metadataJson when OTP is required.
   * Plaintext is returned once to caller for buyer handoff storage; never written as plaintext.
   */
  async issueDeliveryOtp(
    tx: Tx,
    shipmentId: string,
  ): Promise<{ otpCode: string; otpHash: string } | null> {
    const requirements = await this.getRequirements();
    if (!requirements.otpRequired) return null;

    const otpCode = generateDeliveryOtp(6);
    const otpHash = hashDeliveryOtp(otpCode);
    await this.aggregate.patchShipmentMetadata(tx, shipmentId, {
      podOtpHash: otpHash,
      podOtpIssuedAt: new Date().toISOString(),
      // Buyer-facing pin kept until delivery completes (cleared on verify).
      // Not returned to farmer/courier list APIs — only buyer tracking.
      podDeliveryPin: otpCode,
    });
    return { otpCode, otpHash };
  }

  async authorizeCourier(
    tx: Tx,
    shipmentId: string,
    courierUserId: string,
  ) {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
    });
    if (!shipment) {
      this.throwDomain(
        new PodDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
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
    if (!active || active.courierUserId !== courierUserId) {
      this.throwDomain(
        new PodDomainError(
          'NOT_ASSIGNED_COURIER',
          'Only the assigned courier may capture POD',
        ),
      );
    }
    return { shipment, assignment: active };
  }

  private async resolveDropoffStop(
    tx: Tx,
    shipmentId: string,
    stopId?: string | null,
  ) {
    const stops = await tx.shipmentStop.findMany({
      where: { shipmentId, deletedAt: null },
      orderBy: { sequence: 'asc' },
    });
    if (stopId) {
      const match = stops.find((s) => s.id === stopId);
      if (!match) {
        this.throwDomain(
          new PodDomainError('STOP_NOT_FOUND', 'Stop not found on shipment'),
        );
      }
      return match;
    }
    const dropoff = [...stops]
      .reverse()
      .find(
        (s) => s.stopType === 'DROPOFF' || s.stopType === 'RETURN_DROPOFF',
      );
    if (!dropoff) {
      this.throwDomain(
        new PodDomainError('STOP_NOT_FOUND', 'No dropoff stop on shipment'),
      );
    }
    return dropoff;
  }

  /**
   * Validate + persist DROPOFF POD and transition ARRIVED → DELIVERED.
   */
  async completeDropoffAndDeliver(
    courierUserId: string,
    shipmentId: string,
    capture: PodCaptureInput,
  ) {
    const requirements = await this.getRequirements();
    const publications: DeliveryLifecyclePublication[] = [];
    const now = new Date();

    // Pre-load for validation (failed POD events recorded in their own TX).
    const existing = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
    });
    if (!existing) {
      this.throwDomain(
        new PodDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
      );
    }
    if (existing.currentStatus === 'DELIVERED') {
      return this.aggregate.getCourierShipment(courierUserId, shipmentId);
    }
    if (existing.currentStatus !== 'ARRIVED') {
      this.throwDomain(
        new PodDomainError(
          'INVALID_STATUS',
          `Cannot capture POD from status ${existing.currentStatus}`,
        ),
      );
    }

    const meta = this.metaOf(existing);
    const otpHash =
      typeof meta.podOtpHash === 'string' ? meta.podOtpHash : null;
    let otpVerified = false;
    let otpVerifiedAt: Date | null = null;

    if (requirements.otpRequired) {
      if (!verifyDeliveryOtp(capture.otpCode, otpHash)) {
        await this.recordPodFailed(
          shipmentId,
          courierUserId,
          capture.stopId,
          'OTP_INVALID',
          'POD OTP verification failed',
        );
        this.throwDomain(
          new PodDomainError('OTP_INVALID', 'Invalid delivery OTP'),
        );
      }
      otpVerified = true;
      otpVerifiedAt = now;
    }

    const validated = validatePodAgainstRequirements({
      requirements,
      capture,
      otpVerified,
      capturedAt: now,
    });
    if (!validated.ok) {
      await this.recordPodFailed(
        shipmentId,
        courierUserId,
        capture.stopId,
        validated.error.code,
        validated.error.message,
      );
      this.throwDomain(validated.error);
    }

    await this.prisma.$transaction(async (tx) => {
      const { shipment, assignment } = await this.authorizeCourier(
        tx,
        shipmentId,
        courierUserId,
      );

      if (shipment.currentStatus === 'DELIVERED') {
        return;
      }
      if (shipment.currentStatus !== 'ARRIVED') {
        this.throwDomain(
          new PodDomainError(
            'INVALID_STATUS',
            `Cannot capture POD from status ${shipment.currentStatus}`,
          ),
        );
      }

      const dropoff = await this.resolveDropoffStop(
        tx,
        shipmentId,
        capture.stopId,
      );

      await this.aggregate.appendDomainEvent(tx, {
        shipmentId,
        stopId: dropoff.id,
        eventType: POD_EVENT_TYPES.started,
        fromStatus: 'ARRIVED',
        toStatus: 'ARRIVED',
        actorUserId: courierUserId,
        assignmentId: assignment.id,
        message: 'POD capture started',
        payload: { pod: true, phase: 'started' },
      });
      publications.push({
        shipmentId,
        eventType: POD_EVENT_TYPES.started,
        fromStatus: 'ARRIVED',
        toStatus: 'ARRIVED',
        actorUserId: courierUserId,
        occurredAt: now,
        payload: { pod: true, phase: 'started' },
      });

      const pod = await this.aggregate.createPod(tx, {
        shipmentId,
        stopId: dropoff.id,
        method: validated.method,
        photoUrl: capture.photoUrl?.trim() || null,
        mediaUrls: capture.mediaUrls?.filter(Boolean) ?? [],
        otpVerified,
        otpVerifiedAt,
        otpReference: otpVerified ? 'verified' : null,
        recipientName: capture.recipientName?.trim() || null,
        lat: capture.lat ?? null,
        lng: capture.lng ?? null,
        accuracyM: capture.accuracyM ?? null,
        capturedAt: now,
        capturedByUserId: courierUserId,
        notes: capture.notes?.trim() || null,
        metadataJson: {
          requirements,
        } as Prisma.InputJsonValue,
      });

      if (dropoff.status !== 'COMPLETED') {
        await this.aggregate.updateStopStatus(tx, {
          stopId: dropoff.id,
          status: 'COMPLETED',
          completedAt: now,
          arrivedAt: dropoff.arrivedAt ?? now,
        });
      }

      await this.aggregate.appendDomainEvent(tx, {
        shipmentId,
        stopId: dropoff.id,
        eventType: POD_EVENT_TYPES.verified,
        fromStatus: 'ARRIVED',
        toStatus: 'ARRIVED',
        actorUserId: courierUserId,
        message: 'POD verified',
        payload: { pod: true, podId: pod.id, method: validated.method },
      });
      await this.aggregate.appendDomainEvent(tx, {
        shipmentId,
        stopId: dropoff.id,
        eventType: POD_EVENT_TYPES.captured,
        fromStatus: 'ARRIVED',
        toStatus: 'ARRIVED',
        actorUserId: courierUserId,
        message: 'POD captured',
        payload: { pod: true, podId: pod.id },
      });
      publications.push(
        {
          shipmentId,
          eventType: POD_EVENT_TYPES.verified,
          fromStatus: 'ARRIVED',
          toStatus: 'ARRIVED',
          actorUserId: courierUserId,
          occurredAt: now,
          payload: { pod: true, podId: pod.id },
        },
        {
          shipmentId,
          eventType: POD_EVENT_TYPES.captured,
          fromStatus: 'ARRIVED',
          toStatus: 'ARRIVED',
          actorUserId: courierUserId,
          occurredAt: now,
          payload: { pod: true, podId: pod.id },
        },
      );

      await this.aggregate.transitionStatus(tx, {
        shipmentId,
        fromStatus: 'ARRIVED' as ShipmentStatus,
        toStatus: 'DELIVERED',
        actorUserId: courierUserId,
        message: 'Delivered with verified POD',
        payload: { action: 'markDelivered', execution: true, podId: pod.id },
        timestampFields: { deliveredAt: now },
      });
      publications.push({
        shipmentId,
        eventType: 'delivery.shipment.delivered',
        fromStatus: 'ARRIVED',
        toStatus: 'DELIVERED',
        actorUserId: courierUserId,
        occurredAt: now,
        payload: { action: 'markDelivered', podId: pod.id },
      });

      await this.aggregate.patchShipmentMetadata(tx, shipmentId, {
        podDeliveryPin: null,
        podVerifiedAt: now.toISOString(),
        lastPodId: pod.id,
      });
    });

    for (const pub of publications) {
      this.events.publish(pub);
    }

    return this.aggregate.getCourierShipment(courierUserId, shipmentId);
  }

  private async recordPodFailed(
    shipmentId: string,
    actorUserId: string,
    stopId: string | null | undefined,
    reason: string,
    message: string,
  ) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      let resolvedStopId = stopId ?? null;
      if (!resolvedStopId) {
        const dropoff = await tx.shipmentStop.findFirst({
          where: {
            shipmentId,
            deletedAt: null,
            stopType: { in: ['DROPOFF', 'RETURN_DROPOFF'] },
          },
          orderBy: { sequence: 'desc' },
        });
        resolvedStopId = dropoff?.id ?? null;
      }
      await this.aggregate.appendDomainEvent(tx, {
        shipmentId,
        stopId: resolvedStopId,
        eventType: POD_EVENT_TYPES.failed,
        fromStatus: 'ARRIVED',
        toStatus: 'ARRIVED',
        actorUserId,
        message,
        payload: { pod: true, reason },
      });
    });
    this.events.publish({
      shipmentId,
      eventType: POD_EVENT_TYPES.failed,
      fromStatus: 'ARRIVED',
      toStatus: 'ARRIVED',
      actorUserId,
      occurredAt: now,
      payload: { pod: true, reason },
    });
  }

  /** Called after ARRIVED transition to issue OTP when required. */
  async afterArrived(tx: Tx, shipmentId: string) {
    return this.issueDeliveryOtp(tx, shipmentId);
  }

  getDeliveryPinFromMetadata(
    metadataJson: Prisma.JsonValue | null,
  ): string | null {
    const meta =
      metadataJson && typeof metadataJson === 'object'
        ? (metadataJson as Record<string, unknown>)
        : {};
    return typeof meta.podDeliveryPin === 'string' ? meta.podDeliveryPin : null;
  }

  async listPodsForAdmin(shipmentId: string) {
    const pods = await this.prisma.shipmentPod.findMany({
      where: { shipmentId },
      orderBy: { capturedAt: 'desc' },
      take: 20,
    });
    return pods.map(toAdminPodView);
  }

  async latestPartyPodStatus(shipmentId: string) {
    const pod = await this.prisma.shipmentPod.findFirst({
      where: { shipmentId },
      orderBy: { capturedAt: 'desc' },
    });
    return toPartyPodStatus(pod);
  }
}
