import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toUiAvailability } from './shipment.domain.rules';
import {
  isExceptionShipmentStatus,
  isPartyVisibleEvent,
  trackingStepCode,
  trackingStepIndex,
} from './tracking.rules';
import { toPartyPodStatus } from './pod.rules';

type PartyRole = 'FARMER' | 'BUYER';

/**
 * D8 — Read-only shipment tracking for farmers and buyers.
 * Does not mutate shipment state; no courier execution or dispatch.
 */
@Injectable()
export class PartyDeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOrderAccess(
    orderId: string,
    userId: string,
    role: PartyRole,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { farmer: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (role === 'FARMER') {
      if (!order.farmer || order.farmer.userId !== userId) {
        throw new ForbiddenException('You do not have access to this order');
      }
    } else if (order.buyerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    return order;
  }

  private async farmerProfileId(userId: string) {
    const profile = await this.prisma.farmerProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new ForbiddenException('Farmer profile not found');
    }
    return profile.id;
  }

  private orderFilter(role: PartyRole, userId: string, farmerId?: string) {
    if (role === 'BUYER') {
      return { buyerId: userId } satisfies Prisma.OrderWhereInput;
    }
    return { farmerId: farmerId! } satisfies Prisma.OrderWhereInput;
  }

  private async sanitizeCourier(courierUserId: string | null) {
    if (!courierUserId) return null;
    const profile = await this.prisma.courierProfile.findUnique({
      where: { userId: courierUserId },
    });
    if (!profile || profile.deletedAt) return null;
    return {
      displayName: profile.displayName,
      phone: profile.phone,
      availabilityUi: toUiAvailability(profile.availability),
      vehicleType: profile.vehicleType,
      verified: profile.verified,
    };
  }

  private toSummary(s: {
    id: string;
    fulfillmentId: string;
    currentStatus: string;
    shipmentType: string;
    deliveryZone: string | null;
    courierUserId: string | null;
    assignedAt: Date | null;
    acceptedAt: Date | null;
    pickedUpAt: Date | null;
    arrivedAt: Date | null;
    deliveredAt: Date | null;
    completedAt: Date | null;
    failedAt: Date | null;
    cancelledAt: Date | null;
    updatedAt: Date;
    createdAt: Date;
  }, orderId: string) {
    return {
      id: s.id,
      orderId,
      fulfillmentId: s.fulfillmentId,
      currentStatus: s.currentStatus,
      shipmentType: s.shipmentType,
      deliveryZone: s.deliveryZone,
      progress: {
        stepIndex: trackingStepIndex(s.currentStatus),
        stepCode: trackingStepCode(s.currentStatus),
        isException: isExceptionShipmentStatus(s.currentStatus),
      },
      assignedAt: s.assignedAt,
      acceptedAt: s.acceptedAt,
      pickedUpAt: s.pickedUpAt,
      arrivedAt: s.arrivedAt,
      deliveredAt: s.deliveredAt,
      completedAt: s.completedAt,
      failedAt: s.failedAt,
      cancelledAt: s.cancelledAt,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    };
  }

  async listShipments(
    userId: string,
    role: PartyRole,
    query?: { page?: number; limit?: number; history?: boolean },
  ) {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 20, 50);
    const farmerId =
      role === 'FARMER' ? await this.farmerProfileId(userId) : undefined;

    const history = query?.history;
    const terminal = ['COMPLETED', 'CANCELLED', 'FAILED', 'RETURNED'];
    const statusFilter: Prisma.ShipmentWhereInput =
      history === true
        ? { currentStatus: { in: terminal } }
        : history === false
          ? { currentStatus: { notIn: terminal } }
          : {};

    const where: Prisma.ShipmentWhereInput = {
      deletedAt: null,
      ...statusFilter,
      fulfillment: {
        order: this.orderFilter(role, userId, farmerId),
      },
    };

    const [total, rows] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({
        where,
        include: {
          fulfillment: { select: { orderId: true } },
          stops: {
            where: { deletedAt: null },
            orderBy: { sequence: 'asc' },
            take: 4,
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
      items: rows.map((s) => ({
        ...this.toSummary(s, s.fulfillment.orderId),
        stopCount: s.stops.length,
        stopPreview: s.stops.map((st) => ({
          sequence: st.sequence,
          stopType: st.stopType,
          addressText: st.addressText,
          status: st.status,
        })),
      })),
    };
  }

  async getShipmentDetail(
    userId: string,
    role: PartyRole,
    shipmentId: string,
  ) {
    const farmerId =
      role === 'FARMER' ? await this.farmerProfileId(userId) : undefined;

    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        deletedAt: null,
        fulfillment: {
          order: this.orderFilter(role, userId, farmerId),
        },
      },
      include: {
        fulfillment: {
          select: {
            id: true,
            orderId: true,
            status: true,
            trackingRef: true,
            carrierCode: true,
          },
        },
        stops: {
          where: { deletedAt: null },
          orderBy: { sequence: 'asc' },
        },
        events: {
          orderBy: { occurredAt: 'asc' },
          take: 50,
        },
        pods: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const courier = await this.sanitizeCourier(shipment.courierUserId);
    const timeline = shipment.events
      .filter((e) => isPartyVisibleEvent(e.eventType))
      .map((e) => ({
        id: e.id,
        eventType: e.eventType,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        message: e.message,
        occurredAt: e.occurredAt,
      }));

    const podStatus = toPartyPodStatus(shipment.pods[0] ?? null);
    const meta =
      shipment.metadataJson && typeof shipment.metadataJson === 'object'
        ? (shipment.metadataJson as Record<string, unknown>)
        : {};
    // Buyer-only handoff pin (not part of POD status blob; never expose hash).
    const deliveryPin =
      role === 'BUYER' &&
      typeof meta.podDeliveryPin === 'string' &&
      ['ARRIVED'].includes(shipment.currentStatus)
        ? meta.podDeliveryPin
        : null;

    return {
      ...this.toSummary(shipment, shipment.fulfillment.orderId),
      notes: shipment.notes,
      fulfillment: shipment.fulfillment,
      courier,
      pickup: {
        lat: shipment.pickupLat,
        lng: shipment.pickupLng,
      },
      dropoff: {
        lat: shipment.dropoffLat,
        lng: shipment.dropoffLng,
      },
      stops: shipment.stops.map((st) => ({
        id: st.id,
        sequence: st.sequence,
        stopType: st.stopType,
        status: st.status,
        addressText: st.addressText,
        // Contact phone for farmer (handoff); buyers get dropoff address only
        contactPhone: role === 'FARMER' ? st.contactPhone : null,
        instructions: st.instructions,
      })),
      timeline,
      pod: podStatus,
      handoff: deliveryPin ? { deliveryPin } : null,
    };
  }

  async getTrackingForOrder(
    userId: string,
    role: PartyRole,
    orderId: string,
  ) {
    await this.assertOrderAccess(orderId, userId, role);

    const fulfillment = await this.prisma.fulfillmentCase.findUnique({
      where: { orderId },
    });

    if (!fulfillment) {
      return {
        orderId,
        fulfillment: null,
        activeShipment: null,
        shipments: [],
        message: 'NO_SHIPMENT',
      };
    }

    const shipments = await this.prisma.shipment.findMany({
      where: { fulfillmentId: fulfillment.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const active =
      shipments.find(
        (s) =>
          !['COMPLETED', 'CANCELLED', 'FAILED', 'RETURNED'].includes(
            s.currentStatus,
          ),
      ) ?? shipments[0] ?? null;

    let detail = null;
    if (active) {
      detail = await this.getShipmentDetail(userId, role, active.id);
    }

    return {
      orderId,
      fulfillment: {
        id: fulfillment.id,
        status: fulfillment.status,
        trackingRef: fulfillment.trackingRef,
        carrierCode: fulfillment.carrierCode,
      },
      activeShipment: detail,
      shipments: shipments.map((s) => this.toSummary(s, orderId)),
      message: detail ? 'OK' : 'NO_ACTIVE_SHIPMENT',
    };
  }
}
