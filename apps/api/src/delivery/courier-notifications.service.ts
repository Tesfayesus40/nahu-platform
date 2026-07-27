import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourierAnnouncementDto } from './dto/courier-crm.dto';

type PrefKey =
  | 'shipmentAssigned'
  | 'shipmentAccepted'
  | 'pickupReminder'
  | 'pickupConfirmed'
  | 'deliveryStarted'
  | 'deliveryCompleted'
  | 'paymentReleased'
  | 'verification'
  | 'accountMessages'
  | 'systemAnnouncements';

const TYPE_TO_PREF: Record<string, PrefKey> = {
  SHIPMENT_ASSIGNED: 'shipmentAssigned',
  SHIPMENT_ACCEPTED: 'shipmentAccepted',
  PICKUP_REMINDER: 'pickupReminder',
  PICKUP_CONFIRMED: 'pickupConfirmed',
  DELIVERY_STARTED: 'deliveryStarted',
  DELIVERY_COMPLETED: 'deliveryCompleted',
  PAYMENT_RELEASED: 'paymentReleased',
  VERIFICATION_APPROVED: 'verification',
  VERIFICATION_REJECTED: 'verification',
  ACCOUNT_MESSAGE: 'accountMessages',
  SYSTEM_ANNOUNCEMENT: 'systemAnnouncements',
};

@Injectable()
export class CourierNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: { page?: number; limit?: number; unreadOnly?: string },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 30, 100);
    const unreadOnly =
      query.unreadOnly === 'true' || query.unreadOnly === '1';
    const where: Prisma.CourierNotificationWhereInput = {
      courierUserId: userId,
      deletedAt: null,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.courierNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.courierNotification.count({ where }),
      this.prisma.courierNotification.count({
        where: { courierUserId: userId, deletedAt: null, readAt: null },
      }),
    ]);

    return { items, page, limit, total, unreadCount };
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.courierNotification.findFirst({
      where: { id, courierUserId: userId, deletedAt: null },
    });
    if (!n) throw new NotFoundException('Notification not found');
    if (!n.readAt) {
      await this.prisma.courierNotification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.courierNotification.updateMany({
      where: { courierUserId: userId, deletedAt: null, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async softDelete(userId: string, id: string) {
    const n = await this.prisma.courierNotification.findFirst({
      where: { id, courierUserId: userId, deletedAt: null },
    });
    if (!n) throw new NotFoundException('Notification not found');
    await this.prisma.courierNotification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  async notify(
    courierUserId: string,
    type: string,
    content: {
      titleEn: string;
      titleAm: string;
      bodyEn: string;
      bodyAm: string;
      data?: Record<string, unknown>;
    },
  ) {
    if (!(await this.prefEnabled(courierUserId, type))) return null;
    return this.prisma.courierNotification.create({
      data: {
        courierUserId,
        type,
        titleEn: content.titleEn,
        titleAm: content.titleAm,
        bodyEn: content.bodyEn,
        bodyAm: content.bodyAm,
        data: (content.data || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async notifyShipmentAssigned(courierUserId: string, shipmentId: string) {
    return this.notify(courierUserId, 'SHIPMENT_ASSIGNED', {
      titleEn: 'New shipment assigned',
      titleAm: 'አዲስ ጭነት ተመድቦልዎታል',
      bodyEn: 'A new delivery was assigned to you. Open Trips to review and accept.',
      bodyAm: 'አዲስ ማድረስ ተመድቦልዎታል። ለመቀበል ጉዞዎችን ይክፈቱ።',
      data: { shipmentId },
    });
  }

  async notifyShipmentAccepted(courierUserId: string, shipmentId: string) {
    return this.notify(courierUserId, 'SHIPMENT_ACCEPTED', {
      titleEn: 'Shipment accepted',
      titleAm: 'ጭነቱ ተቀብለዋል',
      bodyEn: 'You accepted the shipment. Start pickup when ready.',
      bodyAm: 'ጭነቱን ተቀብለዋል። ሲዘጋጁ መውሰድ ይጀምሩ።',
      data: { shipmentId },
    });
  }

  async notifyPickupReminder(courierUserId: string, shipmentId: string) {
    return this.notify(courierUserId, 'PICKUP_REMINDER', {
      titleEn: 'Pickup reminder',
      titleAm: 'የመውሰድ ማስታወሻ',
      bodyEn: 'Remember to start pickup for your assigned shipment.',
      bodyAm: 'ለተመደበው ጭነት መውሰድ መጀመርዎን ያስታውሱ።',
      data: { shipmentId },
    });
  }

  async notifyPickupConfirmed(courierUserId: string, shipmentId: string) {
    return this.notify(courierUserId, 'PICKUP_CONFIRMED', {
      titleEn: 'Pickup confirmed',
      titleAm: 'መውሰድ ተረጋግጧል',
      bodyEn: 'Pickup was confirmed. Proceed to transit when ready.',
      bodyAm: 'መውሰድ ተረጋግጧል። ሲዘጋጁ ወደ መጓጓዣ ይቀጥሉ።',
      data: { shipmentId },
    });
  }

  async notifyDeliveryStarted(courierUserId: string, shipmentId: string) {
    return this.notify(courierUserId, 'DELIVERY_STARTED', {
      titleEn: 'Delivery started',
      titleAm: 'ማድረስ ተጀምሯል',
      bodyEn: 'You are in transit to the buyer.',
      bodyAm: 'ወደ ገዢው በመንገድ ላይ ነዎት።',
      data: { shipmentId },
    });
  }

  async notifyDeliveryCompleted(courierUserId: string, shipmentId: string) {
    return this.notify(courierUserId, 'DELIVERY_COMPLETED', {
      titleEn: 'Delivery completed',
      titleAm: 'ማድረስ ተጠናቋል',
      bodyEn: 'Delivery finished successfully. Earnings will appear in your ledger.',
      bodyAm: 'ማድረስ በተሳካ ሁኔታ ተጠናቋል። ገቢዎ በመዝገብዎ ይታያል።',
      data: { shipmentId },
    });
  }

  async notifyPaymentReleased(courierUserId: string, earningId: string) {
    return this.notify(courierUserId, 'PAYMENT_RELEASED', {
      titleEn: 'Payment released',
      titleAm: 'ክፍያ ተለቋል',
      bodyEn: 'An earning was marked paid. Check Earnings for details.',
      bodyAm: 'ገቢ እንደተከፈለ ተመዝግቧል። ዝርዝር ለማየት ገቢዎችን ይክፈቱ።',
      data: { earningId },
    });
  }

  async notifyVerification(
    courierUserId: string,
    approved: boolean,
    reason?: string,
  ) {
    if (approved) {
      return this.notify(courierUserId, 'VERIFICATION_APPROVED', {
        titleEn: 'Identity verified',
        titleAm: 'መታወቂያ ተረጋግጧል',
        bodyEn: 'Your identity verification was approved.',
        bodyAm: 'የመታወቂያ ማረጋገጫዎ ጸድቋል።',
      });
    }
    return this.notify(courierUserId, 'VERIFICATION_REJECTED', {
      titleEn: 'Identity verification rejected',
      titleAm: 'የመታወቂያ ማረጋገጫ ውድቅ ሆኗል',
      bodyEn: reason
        ? `Your verification was rejected: ${reason}`
        : 'Your verification was rejected. Please resubmit.',
      bodyAm: reason
        ? `ማረጋገጫዎ ውድቅ ሆኗል፡ ${reason}`
        : 'ማረጋገጫዎ ውድቅ ሆኗል። እባክዎ እንደገና ያስገቡ።',
      data: reason ? { reason } : {},
    });
  }

  async createAnnouncement(dto: CreateCourierAnnouncementDto) {
    if (dto.courierUserId) {
      return this.notify(dto.courierUserId, dto.type, {
        titleEn: dto.titleEn,
        titleAm: dto.titleAm,
        bodyEn: dto.bodyEn,
        bodyAm: dto.bodyAm,
      });
    }

    const couriers = await this.prisma.courierProfile.findMany({
      where: { deletedAt: null, active: true },
      select: { userId: true },
    });
    let created = 0;
    for (const c of couriers) {
      const row = await this.notify(c.userId, dto.type, {
        titleEn: dto.titleEn,
        titleAm: dto.titleAm,
        bodyEn: dto.bodyEn,
        bodyAm: dto.bodyAm,
      });
      if (row) created += 1;
    }
    return { created };
  }

  private async prefEnabled(courierUserId: string, type: string) {
    const key = TYPE_TO_PREF[type];
    if (!key) return true;
    const profile = await this.prisma.courierProfile.findUnique({
      where: { userId: courierUserId },
      select: { notificationPrefs: true },
    });
    const prefs = (profile?.notificationPrefs || {}) as Record<string, boolean>;
    if (prefs[key] === false) return false;
    return true;
  }
}
