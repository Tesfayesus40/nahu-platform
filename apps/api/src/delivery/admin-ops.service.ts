import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentAggregateService } from './shipment-aggregate.service';
import { DeliveryEventsPublisher } from './delivery-events.publisher';
import { DeliveryConfigService } from './delivery-config.service';
import { AuditService } from '../audit/audit.service';
import { DISPATCH_ACTIVE_STATUSES } from './dispatch.rules';
import {
  toUiAvailability,
  ShipmentStatus,
  isShipmentStatus,
} from './shipment.domain.rules';
import {
  AdminOpsDomainError,
  AdminOpsErrorCode,
  BULK_OPS_MAX,
  DELAY_IN_TRANSIT_STATUSES,
  DELAY_POD_PENDING_STATUSES,
  OPS_BUCKETS,
  OPS_STATUS_BUCKETS,
  assertBulkOpsAction,
  assertCanCancelShipment,
  assertCanRetryFailedShipment,
  averageDurationMs,
  bucketForStatus,
  completedTodayFromEvents,
  courierUtilization,
  evaluateThresholdAlert,
  staleCutoff,
  startOfUtcDay,
  statusesForBucket,
} from './admin-ops.rules';
import { ListShipmentsQueryDto } from './dto/admin-ops.dto';
import { toAdminPodView } from './pod.rules';

type AuditMeta = {
  ip?: string;
  userAgent?: string;
  requestId?: string;
};

/**
 * D6 — Admin operations orchestration.
 * Does not own assignment (DispatchService) or courier execution (DeliveryExecutionService).
 * All status writes go through ShipmentAggregateService.
 */
@Injectable()
export class AdminOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregate: ShipmentAggregateService,
    private readonly events: DeliveryEventsPublisher,
    private readonly config: DeliveryConfigService,
    private readonly audit: AuditService,
  ) {}

  private throwDomain(err: AdminOpsDomainError): never {
    const map: Partial<Record<AdminOpsErrorCode, new (m: string) => Error>> = {
      SHIPMENT_NOT_FOUND: NotFoundException,
      COURIER_NOT_FOUND: NotFoundException,
      INVALID_STATUS: BadRequestException,
      CANCEL_NOT_ALLOWED: ConflictException,
      RETRY_NOT_ALLOWED: ConflictException,
      ILLEGAL_TRANSITION: BadRequestException,
    };
    const Ctor = map[err.code] ?? BadRequestException;
    throw new Ctor(err.message);
  }

  async listShipments(query: ListShipmentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sort = query.sort ?? 'updatedAt';
    const order = query.order ?? 'desc';
    const where: Prisma.ShipmentWhereInput = { deletedAt: null };

    if (query.status && isShipmentStatus(query.status)) {
      where.currentStatus = query.status;
    } else if (query.bucket) {
      const statuses = statusesForBucket(query.bucket);
      if (!statuses) {
        throw new BadRequestException(`Unknown ops bucket ${query.bucket}`);
      }
      where.currentStatus = { in: [...statuses] };
    }

    if (query.courierUserId) {
      where.courierUserId = query.courierUserId;
    }
    if (query.fulfillmentId) {
      where.fulfillmentId = query.fulfillmentId;
    }
    if (query.staleHours != null && query.staleHours > 0) {
      where.updatedAt = { lte: staleCutoff(query.staleHours) };
      // When filtering for delayed ops, exclude terminals unless status/bucket set
      if (!query.status && !query.bucket) {
        where.currentStatus = {
          in: [
            ...DELAY_IN_TRANSIT_STATUSES,
            ...DELAY_POD_PENDING_STATUSES,
            'ASSIGNED',
            'ACCEPTED',
            'AWAITING_ASSIGNMENT',
          ],
        };
      }
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      const or: Prisma.ShipmentWhereInput[] = [
        { notes: { contains: q, mode: 'insensitive' } },
        { deliveryZone: { contains: q, mode: 'insensitive' } },
      ];
      // Exact UUID match when query looks like a UUID
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          q,
        )
      ) {
        or.push({ id: q });
        or.push({ fulfillmentId: q });
      }
      where.OR = or;
    }

    const sortMap: Record<string, Prisma.ShipmentOrderByWithRelationInput> = {
      updatedAt: { updatedAt: order },
      createdAt: { createdAt: order },
      currentStatus: { currentStatus: order },
      assignedAt: { assignedAt: order },
    };

    const [total, rows, bucketCounts] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({
        where,
        orderBy: sortMap[sort] ?? { updatedAt: order },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { stops: true } },
          stops: {
            where: { deletedAt: null },
            orderBy: { sequence: 'asc' },
            take: 4,
          },
          assignments: {
            where: { isActive: true, cancelledAt: null, rejectedAt: null },
            take: 1,
          },
        },
      }),
      this.countByBucket(),
    ]);

    return {
      page,
      limit,
      total,
      buckets: bucketCounts,
      items: rows.map((s) => ({
        id: s.id,
        fulfillmentId: s.fulfillmentId,
        shipmentType: s.shipmentType,
        currentStatus: s.currentStatus,
        bucket: bucketForStatus(s.currentStatus),
        courierUserId: s.courierUserId,
        deliveryZone: s.deliveryZone,
        serviceLevel: s.serviceLevel,
        assignedAt: s.assignedAt,
        acceptedAt: s.acceptedAt,
        pickedUpAt: s.pickedUpAt,
        arrivedAt: s.arrivedAt,
        deliveredAt: s.deliveredAt,
        completedAt: s.completedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        stopCount: s._count.stops,
        activeAssignment: s.assignments[0]
          ? {
              id: s.assignments[0].id,
              courierUserId: s.assignments[0].courierUserId,
              assignedAt: s.assignments[0].assignedAt,
            }
          : null,
      })),
    };
  }

  private async countByBucket() {
    const groups = await this.prisma.shipment.groupBy({
      by: ['currentStatus'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    for (const g of groups) byStatus[g.currentStatus] = g._count._all;

    const buckets: Record<string, number> = {};
    for (const bucket of OPS_BUCKETS) {
      buckets[bucket] = OPS_STATUS_BUCKETS[bucket].reduce(
        (sum, st) => sum + (byStatus[st] ?? 0),
        0,
      );
    }
    return { byStatus, buckets };
  }

  async getShipmentDetail(shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
      include: {
        stops: {
          where: { deletedAt: null },
          orderBy: { sequence: 'asc' },
        },
        assignments: { orderBy: { assignedAt: 'desc' } },
        events: { orderBy: { occurredAt: 'asc' }, take: 200 },
        pods: { orderBy: { capturedAt: 'desc' }, take: 5 },
      },
    });
    if (!shipment) {
      this.throwDomain(
        new AdminOpsDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
      );
    }

    const fulfillment = await this.prisma.fulfillmentCase.findUnique({
      where: { id: shipment.fulfillmentId },
    });

    let courier: {
      userId: string;
      displayName: string | null;
      phone: string | null;
      availability: string;
      availabilityUi: string;
      active: boolean;
      verified: boolean;
    } | null = null;

    if (shipment.courierUserId) {
      const profile = await this.prisma.courierProfile.findUnique({
        where: { userId: shipment.courierUserId },
      });
      if (profile) {
        courier = {
          userId: profile.userId,
          displayName: profile.displayName,
          phone: profile.phone,
          availability: profile.availability,
          availabilityUi: toUiAvailability(profile.availability),
          active: profile.active,
          verified: profile.verified,
        };
      }
    }

    const timeline = shipment.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorUserId: e.actorUserId,
      message: e.message,
      occurredAt: e.occurredAt,
      payloadJson: e.payloadJson,
    }));

    return {
      id: shipment.id,
      fulfillmentId: shipment.fulfillmentId,
      shipmentType: shipment.shipmentType,
      currentStatus: shipment.currentStatus,
      bucket: bucketForStatus(shipment.currentStatus),
      courierUserId: shipment.courierUserId,
      deliveryZone: shipment.deliveryZone,
      serviceLevel: shipment.serviceLevel,
      notes: shipment.notes,
      pickup: { lat: shipment.pickupLat, lng: shipment.pickupLng },
      dropoff: { lat: shipment.dropoffLat, lng: shipment.dropoffLng },
      estimatedDistanceM: shipment.estimatedDistanceM
        ? Number(shipment.estimatedDistanceM)
        : null,
      estimatedDurationSec: shipment.estimatedDurationSec,
      assignedAt: shipment.assignedAt,
      acceptedAt: shipment.acceptedAt,
      pickedUpAt: shipment.pickedUpAt,
      arrivedAt: shipment.arrivedAt,
      deliveredAt: shipment.deliveredAt,
      completedAt: shipment.completedAt,
      cancelledAt: shipment.cancelledAt,
      failedAt: shipment.failedAt,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
      fulfillment: fulfillment
        ? {
            id: fulfillment.id,
            status: fulfillment.status,
            orderId: fulfillment.orderId,
            trackingRef: fulfillment.trackingRef,
            carrierCode: fulfillment.carrierCode,
            exceptionCode: fulfillment.exceptionCode,
          }
        : null,
      courier,
      stops: shipment.stops.map((st) => ({
        id: st.id,
        sequence: st.sequence,
        stopType: st.stopType,
        status: st.status,
        addressText: st.addressText,
        instructions: st.instructions,
        lat: st.lat,
        lng: st.lng,
        contactPhone: st.contactPhone,
        arrivedAt: st.arrivedAt,
        completedAt: st.completedAt,
      })),
      assignmentHistory: shipment.assignments.map((a) => ({
        id: a.id,
        courierUserId: a.courierUserId,
        assignedByUserId: a.assignedByUserId,
        assignedAt: a.assignedAt,
        acceptedAt: a.acceptedAt,
        rejectedAt: a.rejectedAt,
        cancelledAt: a.cancelledAt,
        isActive: a.isActive,
        rejectReason: a.rejectReason,
        cancelReason: a.cancelReason,
      })),
      timeline,
      events: timeline,
      pods: shipment.pods.map((p) => toAdminPodView(p)),
      actions: {
        canCancel: (() => {
          try {
            assertCanCancelShipment(shipment.currentStatus);
            return true;
          } catch {
            return false;
          }
        })(),
        canRetry: (() => {
          try {
            assertCanRetryFailedShipment(shipment.currentStatus);
            return true;
          } catch {
            return false;
          }
        })(),
        canRelease: shipment.currentStatus === 'CREATED',
        canAssign: shipment.currentStatus === 'AWAITING_ASSIGNMENT',
        canReassign:
          shipment.currentStatus === 'ASSIGNED' ||
          shipment.currentStatus === 'ACCEPTED',
        canUnassign:
          shipment.currentStatus === 'ASSIGNED' ||
          shipment.currentStatus === 'ACCEPTED',
      },
    };
  }

  async listCouriers(query: {
    page?: number;
    limit?: number;
    q?: string;
    availability?: string;
    activeOnly?: boolean;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CourierProfileWhereInput = { deletedAt: null };
    if (query.activeOnly !== false) where.active = true;
    if (query.availability) where.availability = query.availability;
    if (query.q?.trim()) {
      const q = query.q.trim();
      const or: Prisma.CourierProfileWhereInput[] = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          q,
        )
      ) {
        or.push({ userId: q });
      }
      where.OR = or;
    }

    const [total, profiles] = await Promise.all([
      this.prisma.courierProfile.count({ where }),
      this.prisma.courierProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const maxActive = await this.config.maxActiveShipments();
    const items = await Promise.all(
      profiles.map(async (p) => {
        const [activeWorkload, completedCount] = await Promise.all([
          this.prisma.shipment.count({
            where: {
              deletedAt: null,
              courierUserId: p.userId,
              currentStatus: { in: [...DISPATCH_ACTIVE_STATUSES] },
            },
          }),
          this.prisma.shipment.count({
            where: {
              deletedAt: null,
              courierUserId: p.userId,
              currentStatus: 'COMPLETED',
            },
          }),
        ]);
        return {
          userId: p.userId,
          displayName: p.displayName,
          phone: p.phone,
          vehicleType: p.vehicleType,
          active: p.active,
          verified: p.verified,
          availability: p.availability,
          availabilityUi: toUiAvailability(p.availability),
          serviceRegions: p.serviceRegions,
          activeWorkload,
          maxActiveShipments: maxActive,
          capacityPct:
            maxActive > 0
              ? Math.round((activeWorkload / maxActive) * 1000) / 10
              : null,
          completedDeliveries: completedCount,
          locationAt: p.locationAt,
          updatedAt: p.updatedAt,
        };
      }),
    );

    return { page, limit, total, maxActiveShipments: maxActive, items };
  }

  async getCourierOps(courierUserId: string) {
    const profile = await this.prisma.courierProfile.findFirst({
      where: { userId: courierUserId, deletedAt: null },
    });
    if (!profile) {
      this.throwDomain(
        new AdminOpsDomainError('COURIER_NOT_FOUND', 'Courier profile not found'),
      );
    }

    const [activeShipments, completedShipments, recentAssignments] =
      await Promise.all([
        this.prisma.shipment.findMany({
          where: {
            deletedAt: null,
            courierUserId,
            currentStatus: { in: [...DISPATCH_ACTIVE_STATUSES] },
          },
          orderBy: { updatedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            currentStatus: true,
            deliveryZone: true,
            assignedAt: true,
            updatedAt: true,
            fulfillmentId: true,
          },
        }),
        this.prisma.shipment.findMany({
          where: {
            deletedAt: null,
            courierUserId,
            currentStatus: 'COMPLETED',
          },
          orderBy: { completedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            currentStatus: true,
            completedAt: true,
            deliveryZone: true,
            fulfillmentId: true,
          },
        }),
        this.prisma.shipmentAssignment.findMany({
          where: { courierUserId },
          orderBy: { assignedAt: 'desc' },
          take: 20,
        }),
      ]);

    return {
      userId: profile.userId,
      displayName: profile.displayName,
      phone: profile.phone,
      vehicleType: profile.vehicleType,
      active: profile.active,
      verified: profile.verified,
      availability: profile.availability,
      availabilityUi: toUiAvailability(profile.availability),
      serviceRegions: profile.serviceRegions,
      lastLat: profile.lastLat,
      lastLng: profile.lastLng,
      locationAt: profile.locationAt,
      activeWorkload: activeShipments.length,
      assignedShipments: activeShipments,
      completedCount: completedShipments.length,
      recentCompleted: completedShipments,
      recentAssignments: recentAssignments.map((a) => ({
        id: a.id,
        shipmentId: a.shipmentId,
        assignedAt: a.assignedAt,
        acceptedAt: a.acceptedAt,
        rejectedAt: a.rejectedAt,
        cancelledAt: a.cancelledAt,
        isActive: a.isActive,
      })),
    };
  }

  /**
   * Operational metrics. Counts primarily from shipment current_status;
   * "today" tallies use ShipmentEvent as canonical lifecycle stream.
   * D9 — delayed counts use configurable SLA hours; alerts use seeded thresholds.
   */
  async getOpsMetrics() {
    const dayStart = startOfUtcDay();
    const [inTransitHours, podPendingHours] = await Promise.all([
      this.config.slaInTransitHours(),
      this.config.slaPodPendingHours(),
    ]);
    const inTransitCutoff = staleCutoff(inTransitHours);
    const podPendingCutoff = staleCutoff(podPendingHours);

    const [
      bucketData,
      todayEvents,
      durationRows,
      courierProfiles,
      busyCouriers,
      delayedInTransit,
      delayedPodPending,
      openFailed,
      openReturned,
      maxActive,
      thresholds,
    ] = await Promise.all([
      this.countByBucket(),
      this.prisma.shipmentEvent.groupBy({
        by: ['eventType'],
        where: { occurredAt: { gte: dayStart } },
        _count: { _all: true },
      }),
      this.prisma.shipment.findMany({
        where: {
          deletedAt: null,
          currentStatus: { in: ['DELIVERED', 'COMPLETED', 'BUYER_CONFIRMED'] },
          OR: [
            { deliveredAt: { not: null } },
            { completedAt: { not: null } },
          ],
          assignedAt: { not: null },
        },
        select: {
          assignedAt: true,
          acceptedAt: true,
          deliveredAt: true,
          completedAt: true,
        },
        take: 500,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.courierProfile.findMany({
        where: { deletedAt: null, active: true },
        select: { userId: true, availability: true },
      }),
      this.prisma.shipment.findMany({
        where: {
          deletedAt: null,
          courierUserId: { not: null },
          currentStatus: { in: [...DISPATCH_ACTIVE_STATUSES] },
        },
        select: { courierUserId: true },
        distinct: ['courierUserId'],
      }),
      this.prisma.shipment.count({
        where: {
          deletedAt: null,
          currentStatus: { in: [...DELAY_IN_TRANSIT_STATUSES] },
          updatedAt: { lte: inTransitCutoff },
        },
      }),
      this.prisma.shipment.count({
        where: {
          deletedAt: null,
          currentStatus: { in: [...DELAY_POD_PENDING_STATUSES] },
          updatedAt: { lte: podPendingCutoff },
        },
      }),
      this.prisma.shipment.count({
        where: { deletedAt: null, currentStatus: 'FAILED' },
      }),
      this.prisma.shipment.count({
        where: { deletedAt: null, currentStatus: 'RETURNED' },
      }),
      this.config.maxActiveShipments(),
      this.prisma.alertThreshold.findMany({
        where: {
          enabled: true,
          metricKey: {
            in: ['delivery.in_transit', 'delivery.pod_pending', 'delivery.exceptions'],
          },
        },
      }),
    ]);

    const eventToday: Record<string, number> = {};
    for (const row of todayEvents) {
      eventToday[row.eventType] = row._count._all;
    }

    const completedToday = completedTodayFromEvents(eventToday);
    const deliveredToday = eventToday['delivery.shipment.delivered'] ?? 0;
    const failedToday = eventToday['delivery.shipment.failed'] ?? 0;
    const returnedToday = eventToday['delivery.shipment.returned'] ?? 0;

    const avgMs = averageDurationMs(
      durationRows.map((r) => ({
        startAt: r.acceptedAt ?? r.assignedAt,
        endAt: r.deliveredAt ?? r.completedAt,
      })),
    );

    const onlineCouriers = courierProfiles.filter(
      (c) => c.availability === 'AVAILABLE',
    ).length;
    const utilization = courierUtilization({
      onlineCouriers,
      totalActiveCouriers: courierProfiles.length,
      couriersWithActiveShipments: busyCouriers.length,
    });

    const activeDeliveries =
      (bucketData.buckets.ASSIGNED ?? 0) +
      (bucketData.buckets.IN_TRANSIT ?? 0) +
      (bucketData.buckets.ARRIVED ?? 0) +
      (bucketData.buckets.DELIVERED ?? 0) +
      (bucketData.buckets.BUYER_CONFIRMATION_PENDING ?? 0);

    const inTransitOpen =
      (bucketData.byStatus['PICKED_UP'] ?? 0) +
      (bucketData.byStatus['IN_TRANSIT'] ?? 0);
    const podPendingOpen =
      (bucketData.byStatus['ARRIVED'] ?? 0) +
      (bucketData.byStatus['DELIVERED'] ?? 0);

    const thresholdMap = new Map(
      thresholds.map((t) => [t.metricKey, t]),
    );
    const num = (v: { toNumber?: () => number } | number | null | undefined, fallback: number) => {
      if (v == null) return fallback;
      if (typeof v === 'number') return v;
      if (typeof v.toNumber === 'function') return v.toNumber();
      return Number(v) || fallback;
    };
    const alerts = [
      evaluateThresholdAlert({
        code: 'delivery.in_transit',
        label: 'Open in-transit shipments',
        value: inTransitOpen,
        warnAbove: num(thresholdMap.get('delivery.in_transit')?.warnAbove, 25),
        criticalAbove: num(
          thresholdMap.get('delivery.in_transit')?.criticalAbove,
          100,
        ),
      }),
      evaluateThresholdAlert({
        code: 'delivery.pod_pending',
        label: 'Open POD-pending (ARRIVED/DELIVERED)',
        value: podPendingOpen,
        warnAbove: num(thresholdMap.get('delivery.pod_pending')?.warnAbove, 15),
        criticalAbove: num(
          thresholdMap.get('delivery.pod_pending')?.criticalAbove,
          50,
        ),
      }),
      evaluateThresholdAlert({
        code: 'delivery.delayed_in_transit',
        label: `Delayed in-transit (>${inTransitHours}h)`,
        value: delayedInTransit,
        warnAbove: 5,
        criticalAbove: 20,
      }),
      evaluateThresholdAlert({
        code: 'delivery.delayed_pod_pending',
        label: `Delayed POD-pending (>${podPendingHours}h)`,
        value: delayedPodPending,
        warnAbove: 5,
        criticalAbove: 15,
      }),
      evaluateThresholdAlert({
        code: 'delivery.assignment_backlog',
        label: 'Assignment backlog',
        value: bucketData.buckets.AWAITING_ASSIGNMENT ?? 0,
        warnAbove: 10,
        criticalAbove: 40,
      }),
    ];

    return {
      asOf: new Date().toISOString(),
      dayStart: dayStart.toISOString(),
      awaitingAssignment: bucketData.buckets.AWAITING_ASSIGNMENT ?? 0,
      assignmentBacklog: bucketData.buckets.AWAITING_ASSIGNMENT ?? 0,
      activeDeliveries,
      completedToday,
      deliveredToday,
      failedToday,
      returnedToday,
      openFailed,
      openReturned,
      delayedInTransit,
      delayedPodPending,
      sla: {
        inTransitHours,
        podPendingHours,
      },
      averageDeliveryDurationMs: avgMs,
      averageDeliveryDurationMin:
        avgMs == null ? null : Math.round((avgMs / 60000) * 10) / 10,
      courierUtilization: {
        onlineCouriers,
        totalActiveCouriers: courierProfiles.length,
        couriersWithActiveShipments: busyCouriers.length,
        maxActiveShipmentsPerCourier: maxActive,
        ...utilization,
      },
      health: {
        alertCount: alerts.filter((a) => a.severity !== 'ok').length,
        criticalCount: alerts.filter((a) => a.severity === 'critical').length,
        warnCount: alerts.filter((a) => a.severity === 'warn').length,
      },
      alerts,
      buckets: bucketData.buckets,
      byStatus: bucketData.byStatus,
      eventsToday: eventToday,
    };
  }

  /**
   * Bulk cancel/retry — sequential AdminOps paths (no parallel TX races).
   * Caps at BULK_OPS_MAX. Continues on per-item failure.
   */
  async bulkShipmentActions(input: {
    action: string;
    shipmentIds: string[];
    actorUserId: string;
    sessionId?: string | null;
    reason?: string | null;
    meta?: AuditMeta;
  }) {
    let action: 'cancel' | 'retry';
    try {
      action = assertBulkOpsAction(input.action);
    } catch (e) {
      if (e instanceof AdminOpsDomainError) this.throwDomain(e);
      throw e;
    }

    const ids = [...new Set(input.shipmentIds)].slice(0, BULK_OPS_MAX);
    const results: Array<{
      shipmentId: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const shipmentId of ids) {
      try {
        if (action === 'cancel') {
          await this.cancelShipment({
            shipmentId,
            actorUserId: input.actorUserId,
            sessionId: input.sessionId,
            reason: input.reason,
            meta: input.meta,
          });
        } else {
          await this.retryFailedShipment({
            shipmentId,
            actorUserId: input.actorUserId,
            sessionId: input.sessionId,
            reason: input.reason,
            meta: input.meta,
          });
        }
        results.push({ shipmentId, ok: true });
      } catch (err) {
        results.push({
          shipmentId,
          ok: false,
          error: (err as Error).message,
        });
      }
    }

    return {
      action,
      requested: input.shipmentIds.length,
      processed: ids.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  async cancelShipment(input: {
    shipmentId: string;
    actorUserId: string;
    sessionId?: string | null;
    reason?: string | null;
    meta?: AuditMeta;
  }) {
    let fromStatus: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, deletedAt: null },
      });
      if (!shipment) {
        this.throwDomain(
          new AdminOpsDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
        );
      }
      try {
        assertCanCancelShipment(shipment.currentStatus);
      } catch (e) {
        if (e instanceof AdminOpsDomainError) this.throwDomain(e);
        throw e;
      }

      fromStatus = shipment.currentStatus;
      const active = await this.aggregate.findActiveAssignment(
        tx,
        shipment.id,
      );
      if (active) {
        await this.aggregate.deactivateAssignment(tx, {
          assignmentId: active.id,
          mode: 'cancel',
          reason: input.reason?.trim() || 'Cancelled by admin',
        });
      }

      const now = new Date();
      await this.aggregate.transitionStatus(tx, {
        shipmentId: shipment.id,
        fromStatus: shipment.currentStatus as ShipmentStatus,
        toStatus: 'CANCELLED',
        actorUserId: input.actorUserId,
        message: input.reason?.trim() || 'Cancelled by admin',
        payload: { admin: true, ops: true },
        timestampFields: { cancelledAt: now },
        courierUserId: null,
      });
    });

    this.events.publish({
      shipmentId: input.shipmentId,
      eventType: 'delivery.shipment.cancelled',
      fromStatus,
      toStatus: 'CANCELLED',
      actorUserId: input.actorUserId,
      occurredAt: new Date(),
      payload: { admin: true },
    });

    await this.audit.appendEvent({
      actorUserId: input.actorUserId,
      actorSessionId: input.sessionId ?? null,
      permissionCode: 'delivery.manage',
      action: 'delivery.shipment.cancel',
      targetType: 'shipment',
      targetId: input.shipmentId,
      reason: input.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { currentStatus: fromStatus },
      afterJson: { currentStatus: 'CANCELLED' },
      ip: input.meta?.ip,
      userAgent: input.meta?.userAgent,
      requestId: input.meta?.requestId,
    });

    return this.getShipmentDetail(input.shipmentId);
  }

  async retryFailedShipment(input: {
    shipmentId: string;
    actorUserId: string;
    sessionId?: string | null;
    reason?: string | null;
    meta?: AuditMeta;
  }) {
    await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, deletedAt: null },
      });
      if (!shipment) {
        this.throwDomain(
          new AdminOpsDomainError('SHIPMENT_NOT_FOUND', 'Shipment not found'),
        );
      }
      try {
        assertCanRetryFailedShipment(shipment.currentStatus);
      } catch (e) {
        if (e instanceof AdminOpsDomainError) this.throwDomain(e);
        throw e;
      }

      const active = await this.aggregate.findActiveAssignment(
        tx,
        shipment.id,
      );
      if (active) {
        await this.aggregate.deactivateAssignment(tx, {
          assignmentId: active.id,
          mode: 'cancel',
          reason: input.reason?.trim() || 'Retry after failure',
        });
      }

      await this.aggregate.transitionStatus(tx, {
        shipmentId: shipment.id,
        fromStatus: 'FAILED',
        toStatus: 'AWAITING_ASSIGNMENT',
        actorUserId: input.actorUserId,
        message: input.reason?.trim() || 'Retry failed shipment',
        payload: { admin: true, ops: true, retry: true },
        timestampFields: { failedAt: null, assignedAt: null, acceptedAt: null },
        courierUserId: null,
      });
    });

    this.events.publish({
      shipmentId: input.shipmentId,
      eventType: 'delivery.shipment.awaiting_assignment',
      fromStatus: 'FAILED',
      toStatus: 'AWAITING_ASSIGNMENT',
      actorUserId: input.actorUserId,
      occurredAt: new Date(),
      payload: { admin: true, retry: true },
    });

    await this.audit.appendEvent({
      actorUserId: input.actorUserId,
      actorSessionId: input.sessionId ?? null,
      permissionCode: 'delivery.manage',
      action: 'delivery.shipment.retry',
      targetType: 'shipment',
      targetId: input.shipmentId,
      reason: input.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { currentStatus: 'FAILED' },
      afterJson: { currentStatus: 'AWAITING_ASSIGNMENT' },
      ip: input.meta?.ip,
      userAgent: input.meta?.userAgent,
      requestId: input.meta?.requestId,
    });

    return this.getShipmentDetail(input.shipmentId);
  }
}
