import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ShipmentStatus,
  planStatusTransition,
  toDbAvailability,
  toUiAvailability,
} from './shipment.domain.rules';
import {
  startOfUtcDay,
  statusesForCourierSection,
} from './courier-queue.rules';

type Tx = Prisma.TransactionClient;

/**
 * Sole write gateway for the Shipment aggregate (D2 review / D3+).
 * Controllers must not update stops/assignments/events/pods/earnings directly.
 */
@Injectable()
export class ShipmentAggregateService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCourierProfile(userId: string, phone?: string | null) {
    return this.prisma.courierProfile.upsert({
      where: { userId },
      create: {
        userId,
        phone: phone ?? null,
        availability: 'OFFLINE',
        active: true,
        verified: false,
      },
      update: {
        ...(phone ? { phone } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async getCourierProfileView(userId: string, phone?: string | null) {
    const profile = await this.ensureCourierProfile(userId, phone);
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      phone: profile.phone,
      vehicleType: profile.vehicleType,
      active: profile.active,
      verified: profile.verified,
      availability: toUiAvailability(profile.availability),
      availabilityDb: profile.availability,
      serviceRegions: profile.serviceRegions,
    };
  }

  async setCourierAvailability(userId: string, availabilityInput: string) {
    const dbValue = toDbAvailability(availabilityInput);
    if (!dbValue) {
      throw new BadRequestException(
        'availability must be ONLINE|OFFLINE|BUSY|BREAK (or AVAILABLE|ON_BREAK)',
      );
    }
    await this.ensureCourierProfile(userId);
    const updated = await this.prisma.courierProfile.update({
      where: { userId },
      data: { availability: dbValue, updatedAt: new Date() },
    });
    return {
      availability: toUiAvailability(updated.availability),
      availabilityDb: updated.availability,
    };
  }

  /**
   * Transition current_status and append exactly one ShipmentEvent in the same TX.
   */
  async transitionStatus(
    tx: Tx,
    input: {
      shipmentId: string;
      fromStatus: ShipmentStatus;
      toStatus: ShipmentStatus;
      actorUserId?: string | null;
      message?: string | null;
      payload?: Record<string, unknown> | null;
      eventTypeOverride?: string | null;
      timestampFields?: Partial<{
        assignedAt: Date | null;
        acceptedAt: Date | null;
        pickedUpAt: Date | null;
        arrivedAt: Date | null;
        deliveredAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
        failedAt: Date | null;
      }>;
      courierUserId?: string | null;
    },
  ) {
    const planned = planStatusTransition({
      shipmentId: input.shipmentId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId,
      message: input.message,
      payload: input.payload,
    });
    if (!planned.ok) {
      throw new BadRequestException(planned.reason);
    }

    const shipment = await tx.shipment.update({
      where: { id: input.shipmentId },
      data: {
        currentStatus: planned.nextStatus,
        updatedAt: new Date(),
        ...(input.courierUserId !== undefined
          ? { courierUserId: input.courierUserId }
          : {}),
        ...(input.timestampFields?.assignedAt !== undefined
          ? { assignedAt: input.timestampFields.assignedAt }
          : {}),
        ...(input.timestampFields?.acceptedAt !== undefined
          ? { acceptedAt: input.timestampFields.acceptedAt }
          : {}),
        ...(input.timestampFields?.pickedUpAt !== undefined
          ? { pickedUpAt: input.timestampFields.pickedUpAt }
          : {}),
        ...(input.timestampFields?.arrivedAt !== undefined
          ? { arrivedAt: input.timestampFields.arrivedAt }
          : {}),
        ...(input.timestampFields?.deliveredAt !== undefined
          ? { deliveredAt: input.timestampFields.deliveredAt }
          : {}),
        ...(input.timestampFields?.completedAt !== undefined
          ? { completedAt: input.timestampFields.completedAt }
          : {}),
        ...(input.timestampFields?.cancelledAt !== undefined
          ? { cancelledAt: input.timestampFields.cancelledAt }
          : {}),
        ...(input.timestampFields?.failedAt !== undefined
          ? { failedAt: input.timestampFields.failedAt }
          : {}),
      },
    });

    await tx.shipmentEvent.create({
      data: {
        shipmentId: planned.event.shipmentId,
        eventType: input.eventTypeOverride ?? planned.event.eventType,
        fromStatus: planned.event.fromStatus,
        toStatus: planned.event.toStatus,
        actorUserId: planned.event.actorUserId,
        correlationId: planned.event.correlationId,
        message: planned.event.message,
        payloadJson: (planned.event.payloadJson ??
          undefined) as Prisma.InputJsonValue | undefined,
        occurredAt: planned.event.occurredAt,
      },
    });

    return shipment;
  }

  /**
   * Append a domain event without changing current_status (e.g. reassignment
   * while remaining ASSIGNED). Prefer transitionStatus when status changes.
   */
  async appendDomainEvent(
    tx: Tx,
    input: {
      shipmentId: string;
      eventType: string;
      fromStatus?: string | null;
      toStatus?: string | null;
      actorUserId?: string | null;
      assignmentId?: string | null;
      stopId?: string | null;
      message?: string | null;
      payload?: Record<string, unknown> | null;
    },
  ) {
    return tx.shipmentEvent.create({
      data: {
        shipmentId: input.shipmentId,
        eventType: input.eventType,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        actorUserId: input.actorUserId ?? null,
        assignmentId: input.assignmentId ?? null,
        stopId: input.stopId ?? null,
        message: input.message ?? null,
        payloadJson: (input.payload ??
          undefined) as Prisma.InputJsonValue | undefined,
        occurredAt: new Date(),
      },
    });
  }

  /**
   * Persist a POD attempt as part of the Shipment aggregate (D10).
   * Controllers must not insert into shipment_pods directly.
   */
  async createPod(
    tx: Tx,
    input: {
      shipmentId: string;
      stopId: string;
      method: string;
      photoUrl?: string | null;
      mediaUrls?: string[];
      signatureUrl?: string | null;
      signaturePayloadJson?: Prisma.InputJsonValue | null;
      otpVerified?: boolean;
      otpVerifiedAt?: Date | null;
      otpReference?: string | null;
      recipientName?: string | null;
      lat?: number | null;
      lng?: number | null;
      accuracyM?: number | null;
      capturedAt?: Date;
      capturedByUserId?: string | null;
      notes?: string | null;
      metadataJson?: Prisma.InputJsonValue | null;
    },
  ) {
    const prior = await tx.shipmentPod.count({
      where: { stopId: input.stopId },
    });
    return tx.shipmentPod.create({
      data: {
        shipmentId: input.shipmentId,
        stopId: input.stopId,
        attemptNo: prior + 1,
        method: input.method,
        photoUrl: input.photoUrl ?? null,
        mediaUrls: input.mediaUrls ?? [],
        signatureUrl: input.signatureUrl ?? null,
        signaturePayloadJson: input.signaturePayloadJson ?? undefined,
        otpVerified: input.otpVerified ?? false,
        otpVerifiedAt: input.otpVerifiedAt ?? null,
        otpReference: input.otpReference ?? null,
        recipientName: input.recipientName ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        accuracyM: input.accuracyM ?? null,
        capturedAt: input.capturedAt ?? new Date(),
        capturedByUserId: input.capturedByUserId ?? null,
        notes: input.notes ?? null,
        metadataJson: input.metadataJson ?? undefined,
      },
    });
  }

  async updateStopStatus(
    tx: Tx,
    input: {
      stopId: string;
      status: string;
      arrivedAt?: Date | null;
      completedAt?: Date | null;
    },
  ) {
    const now = new Date();
    return tx.shipmentStop.update({
      where: { id: input.stopId },
      data: {
        status: input.status,
        updatedAt: now,
        ...(input.arrivedAt !== undefined
          ? { arrivedAt: input.arrivedAt }
          : {}),
        ...(input.completedAt !== undefined
          ? { completedAt: input.completedAt }
          : {}),
      },
    });
  }

  async patchShipmentMetadata(
    tx: Tx,
    shipmentId: string,
    patch: Record<string, unknown>,
  ) {
    const row = await tx.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
      select: { metadataJson: true },
    });
    const current =
      row?.metadataJson && typeof row.metadataJson === 'object'
        ? (row.metadataJson as Record<string, unknown>)
        : {};
    return tx.shipment.update({
      where: { id: shipmentId },
      data: {
        metadataJson: { ...current, ...patch } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Append an immutable earning ledger row (D11).
   * Controllers must not insert into shipment_earnings directly.
   */
  async appendEarning(
    tx: Tx,
    input: {
      shipmentId: string;
      stopId?: string | null;
      courierUserId: string;
      earningType: string;
      amount: number;
      currency?: string;
      ledgerStatus: string;
      replacesEarningId?: string | null;
      reference?: string | null;
      policyCode?: string | null;
      metadataJson?: Prisma.InputJsonValue | null;
    },
  ) {
    return tx.shipmentEarning.create({
      data: {
        shipmentId: input.shipmentId,
        stopId: input.stopId ?? null,
        courierUserId: input.courierUserId,
        earningType: input.earningType,
        amount: input.amount,
        currency: input.currency ?? 'ETB',
        ledgerStatus: input.ledgerStatus,
        replacesEarningId: input.replacesEarningId ?? null,
        reference: input.reference ?? null,
        policyCode: input.policyCode ?? null,
        metadataJson: input.metadataJson ?? undefined,
      },
    });
  }

  async findActiveAssignment(tx: Tx, shipmentId: string) {
    return tx.shipmentAssignment.findFirst({
      where: {
        shipmentId,
        isActive: true,
        cancelledAt: null,
        rejectedAt: null,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async createActiveAssignment(
    tx: Tx,
    input: {
      shipmentId: string;
      courierUserId: string;
      assignedByUserId?: string | null;
    },
  ) {
    return tx.shipmentAssignment.create({
      data: {
        shipmentId: input.shipmentId,
        courierUserId: input.courierUserId,
        assignedByUserId: input.assignedByUserId ?? null,
        assignedAt: new Date(),
        isActive: true,
      },
    });
  }

  async deactivateAssignment(
    tx: Tx,
    input: {
      assignmentId: string;
      mode: 'cancel' | 'reject';
      reason?: string | null;
    },
  ) {
    const now = new Date();
    return tx.shipmentAssignment.update({
      where: { id: input.assignmentId },
      data: {
        isActive: false,
        updatedAt: now,
        ...(input.mode === 'reject'
          ? { rejectedAt: now, rejectReason: input.reason ?? null }
          : { cancelledAt: now, cancelReason: input.reason ?? null }),
      },
    });
  }

  async markAssignmentAccepted(tx: Tx, assignmentId: string) {
    const now = new Date();
    return tx.shipmentAssignment.update({
      where: { id: assignmentId },
      data: { acceptedAt: now, updatedAt: now },
    });
  }

  async getShipmentForDispatch(shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
      include: {
        stops: { where: { deletedAt: null }, orderBy: { sequence: 'asc' } },
        assignments: { orderBy: { assignedAt: 'desc' }, take: 10 },
        events: { orderBy: { occurredAt: 'desc' }, take: 20 },
      },
    });
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    return shipment;
  }

  async listCourierShipments(
    courierUserId: string,
    query?: {
      page?: number;
      limit?: number;
      section?: string;
      status?: string;
    },
  ) {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 20, 50);
    const where: Prisma.ShipmentWhereInput = {
      deletedAt: null,
      OR: [
        { courierUserId },
        {
          assignments: {
            some: {
              courierUserId,
              isActive: true,
              cancelledAt: null,
              rejectedAt: null,
            },
          },
        },
      ],
    };

    if (query?.status) {
      where.currentStatus = query.status;
    } else if (query?.section) {
      const statuses = statusesForCourierSection(query.section);
      if (statuses) {
        where.currentStatus = { in: statuses };
        if (query.section === 'completed_today') {
          where.completedAt = { gte: startOfUtcDay() };
        }
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({
        where,
        include: {
          stops: {
            where: { deletedAt: null },
            orderBy: { sequence: 'asc' },
          },
          assignments: {
            where: { courierUserId },
            orderBy: { assignedAt: 'desc' },
            take: 3,
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      section: query?.section ?? null,
      items: rows.map((s) => this.toCourierShipmentSummary(s)),
    };
  }

  async getCourierShipment(courierUserId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        deletedAt: null,
        OR: [
          { courierUserId },
          {
            assignments: {
              some: { courierUserId },
            },
          },
        ],
      },
      include: {
        stops: {
          where: { deletedAt: null },
          orderBy: { sequence: 'asc' },
        },
        assignments: {
          where: { courierUserId },
          orderBy: { assignedAt: 'desc' },
        },
        events: {
          orderBy: { occurredAt: 'asc' },
          take: 50,
        },
      },
    });
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    return this.toCourierShipmentDetail(shipment);
  }

  async acceptShipment(courierUserId: string, shipmentId: string) {
    throw new BadRequestException(
      'Use DispatchService.acceptAssignment — accept is owned by dispatch (D4)',
    );
  }

  async rejectShipment(
    _courierUserId: string,
    _shipmentId: string,
    _reason?: string,
  ) {
    throw new BadRequestException(
      'Use DispatchService.rejectAssignment — reject is owned by dispatch (D4)',
    );
  }

  private toCourierShipmentSummary(s: any) {
    return {
      id: s.id,
      currentStatus: s.currentStatus,
      shipmentType: s.shipmentType,
      deliveryZone: s.deliveryZone,
      pickup: { lat: s.pickupLat, lng: s.pickupLng },
      dropoff: { lat: s.dropoffLat, lng: s.dropoffLng },
      estimatedDistanceM: s.estimatedDistanceM
        ? Number(s.estimatedDistanceM)
        : null,
      estimatedDurationSec: s.estimatedDurationSec,
      assignedAt: s.assignedAt,
      acceptedAt: s.acceptedAt,
      pickedUpAt: s.pickedUpAt,
      arrivedAt: s.arrivedAt,
      deliveredAt: s.deliveredAt,
      completedAt: s.completedAt,
      failedAt: s.failedAt,
      cancelledAt: s.cancelledAt,
      updatedAt: s.updatedAt,
      stops: (s.stops ?? []).map((st: any) => ({
        id: st.id,
        sequence: st.sequence,
        stopType: st.stopType,
        status: st.status,
        addressText: st.addressText,
      })),
    };
  }

  private toCourierShipmentDetail(s: any) {
    const events = [...(s.events ?? [])].sort(
      (a: any, b: any) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
    const pickupStop = (s.stops ?? []).find(
      (st: any) => st.stopType === 'PICKUP' || st.stopType === 'RETURN_PICKUP',
    );
    const dropoffStop = (s.stops ?? []).find(
      (st: any) => st.stopType === 'DROPOFF' || st.stopType === 'RETURN_DROPOFF',
    );
    return {
      ...this.toCourierShipmentSummary(s),
      notes: s.notes,
      pickupInfo: pickupStop
        ? {
            addressText: pickupStop.addressText,
            instructions: pickupStop.instructions,
            contactPhone: pickupStop.contactPhone,
            lat: pickupStop.lat,
            lng: pickupStop.lng,
            status: pickupStop.status,
          }
        : {
            lat: s.pickupLat,
            lng: s.pickupLng,
            addressText: null,
            instructions: null,
            contactPhone: null,
            status: null,
          },
      deliveryInfo: dropoffStop
        ? {
            addressText: dropoffStop.addressText,
            instructions: dropoffStop.instructions,
            contactPhone: dropoffStop.contactPhone,
            lat: dropoffStop.lat,
            lng: dropoffStop.lng,
            status: dropoffStop.status,
          }
        : {
            lat: s.dropoffLat,
            lng: s.dropoffLng,
            addressText: null,
            instructions: null,
            contactPhone: null,
            status: null,
          },
      stops: (s.stops ?? []).map((st: any) => ({
        id: st.id,
        sequence: st.sequence,
        stopType: st.stopType,
        status: st.status,
        addressText: st.addressText,
        instructions: st.instructions,
        lat: st.lat,
        lng: st.lng,
        contactPhone: st.contactPhone,
      })),
      assignments: s.assignments ?? [],
      recentEvents: events,
      timeline: events,
    };
  }
}
