import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { AdminAuthService } from '../identity/admin/admin-auth.service';
import { CertificatesService } from '../certificates/certificates.service';
import { ReservationsService } from '../inventory/reservations.service';
import { PaymentsService } from '../payments/payments.service';
import {
  isStalledEscrow,
  nextOrderStatus,
  requiresOrderActionReason,
  type OrderAdminAction,
} from './order-admin.rules';
import { fulfillmentStatusForOrder } from '../delivery/fulfillment.rules';
import {
  ListOrdersQueryDto,
  OrderAdminActionDto,
  OrderAdminNoteDto,
} from './dto/admin-orders.dto';

type RequestMeta = { ip?: string; userAgent?: string; requestId?: string };

const USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  status: true,
} as const;

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
    private readonly certificates: CertificatesService,
    private readonly reservations: ReservationsService,
    private readonly payments: PaymentsService,
  ) {}

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const out: Record<string, number> = {};
    for (const row of rows) out[row.status] = row._count._all;
    return out;
  }

  async countStalledEscrow(days = 3): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.order.count({
      where: { status: 'PAID_ESCROW', paidAt: { lte: cutoff } },
    });
  }

  async countPendingPayment(): Promise<number> {
    return this.prisma.order.count({ where: { status: 'PENDING_PAYMENT' } });
  }

  async list(query: ListOrdersQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status as never;
    } else if (query.queue === 'pending_payment') {
      where.status = 'PENDING_PAYMENT';
    } else if (query.queue === 'stalled_escrow') {
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      where.status = 'PAID_ESCROW';
      where.paidAt = { lte: cutoff };
    }
    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod as never;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { paymentReference: { contains: q, mode: 'insensitive' } },
        { deliveryAddress: { contains: q, mode: 'insensitive' } },
        {
          buyer: {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        {
          farmer: {
            user: {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: query.order === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          buyer: { select: USER_SELECT },
          farmer: { include: { user: { select: USER_SELECT } } },
          listing: {
            select: { id: true, region: true, variety: true, grade: true },
          },
          disputeCase: { select: { id: true, status: true, refundStatus: true } },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((o) => this.toListItem(o)),
    };
  }

  async get(id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: {
        buyer: { select: USER_SELECT },
        farmer: {
          include: {
            user: { select: USER_SELECT },
            cooperative: { select: { id: true, name: true, verified: true } },
          },
        },
        listing: true,
        disputeCase: true,
        certificate: true,
        adminNotes: { orderBy: { createdAt: 'desc' }, take: 50 },
        fulfillmentCase: true,
      },
    });
    if (!o) throw new NotFoundException('Order not found');

    const paymentCatalog = this.payments.listMethods().methods;
    const methodMeta = paymentCatalog.find((m) => m.code === o.paymentMethod);

    return {
      ...this.toListItem(o),
      quantity: o.quantity,
      unitCode: o.unitCode,
      pricePerUnit: o.pricePerUnit,
      commissionEtb: o.commissionEtb,
      farmerPayoutEtb: o.farmerPayoutEtb,
      paymentReference: o.paymentReference,
      deliveryAddress: o.deliveryAddress,
      paidAt: o.paidAt,
      deliveredAt: o.deliveredAt,
      completedAt: o.completedAt,
      payment: {
        method: o.paymentMethod,
        reference: o.paymentReference,
        paidAt: o.paidAt,
        providerStatus: methodMeta?.status ?? 'unknown',
        providerLabel: methodMeta?.nameEn ?? o.paymentMethod,
      },
      buyer: o.buyer,
      seller: {
        farmerProfileId: o.farmer.id,
        region: o.farmer.region,
        cooperative: o.farmer.cooperative,
        user: o.farmer.user,
      },
      listing: o.listing,
      disputeCase: o.disputeCase,
      certificate: o.certificate,
      fulfillmentCase: o.fulfillmentCase,
      adminNotes: o.adminNotes,
      stalledEscrow: isStalledEscrow(o.status, o.paidAt),
    };
  }

  async applyAction(
    admin: AdminRequestUser,
    orderId: string,
    dto: OrderAdminActionDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const action = dto.action as OrderAdminAction;
    if (requiresOrderActionReason(action) && !dto.reason?.trim()) {
      throw new BadRequestException('reason is required for this action');
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const toStatus = nextOrderStatus(action, order.status);
    if (!toStatus) {
      throw new BadRequestException(
        `Cannot apply ${action} while order is ${order.status}`,
      );
    }

    const now = new Date();

    if (action === 'CANCEL_UNPAID') {
      await this.prisma.$transaction(async (tx) => {
        await this.restoreListingStock(
          tx,
          order.listingId,
          Number(order.quantity ?? order.quantityKg),
        );
        await this.reservations.restoreOrderHoldToListingTx(tx, {
          orderId,
          listingId: order.listingId,
          qty: Number(order.quantity ?? order.quantityKg),
          actorUserId: admin.userId,
        });
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED', updatedAt: now },
        });
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: toStatus as never,
            paidAt:
              action === 'CONFIRM_PAYMENT_SIMULATION'
                ? (order.paidAt ?? now)
                : order.paidAt,
            deliveredAt:
              action === 'MARK_DELIVERED' || action === 'COMPLETE_ORDER'
                ? (order.deliveredAt ?? now)
                : order.deliveredAt,
            completedAt:
              action === 'COMPLETE_ORDER' ? (order.completedAt ?? now) : order.completedAt,
            updatedAt: now,
          },
        });

        await this.upsertFulfillmentTx(tx, orderId, toStatus, admin.userId, action);
      });

      if (action === 'COMPLETE_ORDER') {
        const existing = await this.prisma.originCertificate.findUnique({
          where: { orderId },
        });
        if (!existing) {
          await this.certificates.issueCertificateForOrder(orderId);
        }
      }
    }

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'orders.transition',
      action: `orders.admin.${action.toLowerCase()}`,
      targetType: 'order',
      targetId: orderId,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { status: order.status },
      afterJson: { status: toStatus },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.get(orderId);
  }

  async addNote(
    admin: AdminRequestUser,
    orderId: string,
    dto: OrderAdminNoteDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    await this.prisma.orderAdminNote.create({
      data: {
        orderId,
        body: dto.body.trim(),
        authorUserId: admin.userId,
      },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'orders.transition',
      action: 'orders.admin.note',
      targetType: 'order',
      targetId: orderId,
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.get(orderId);
  }

  private async upsertFulfillmentTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    orderStatus: string,
    actorUserId: string,
    action: string,
  ) {
    const status = fulfillmentStatusForOrder(orderStatus);
    const existing = await tx.fulfillmentCase.findUnique({ where: { orderId } });
    const now = new Date();
    if (!existing) {
      const created = await tx.fulfillmentCase.create({
        data: {
          orderId,
          status,
          readyAt: status === 'READY' ? now : null,
          shippedAt: status === 'IN_TRANSIT' ? now : null,
          deliveredAt: status === 'DELIVERED' ? now : null,
        },
      });
      await tx.fulfillmentEvent.create({
        data: {
          fulfillmentId: created.id,
          eventType: action,
          fromStatus: null,
          toStatus: status,
          message: `Synced from order action ${action}`,
          actorUserId,
        },
      });
      return;
    }

    await tx.fulfillmentCase.update({
      where: { id: existing.id },
      data: {
        status,
        readyAt: status === 'READY' ? (existing.readyAt ?? now) : existing.readyAt,
        shippedAt:
          status === 'IN_TRANSIT' ? (existing.shippedAt ?? now) : existing.shippedAt,
        deliveredAt:
          status === 'DELIVERED' ? (existing.deliveredAt ?? now) : existing.deliveredAt,
        updatedAt: now,
      },
    });
    await tx.fulfillmentEvent.create({
      data: {
        fulfillmentId: existing.id,
        eventType: action,
        fromStatus: existing.status,
        toStatus: status,
        message: `Synced from order action ${action}`,
        actorUserId,
      },
    });
  }

  private async restoreListingStock(
    tx: Prisma.TransactionClient,
    listingId: string,
    quantity: number,
  ) {
    const listing = await tx.listing.findUnique({ where: { id: listingId } });
    if (!listing) return;
    const nextQty = Number(listing.quantity ?? listing.quantityKg) + quantity;
    await tx.listing.update({
      where: { id: listingId },
      data: { quantity: nextQty, quantityKg: nextQty, status: 'ACTIVE' },
    });
  }

  private toListItem(o: {
    id: string;
    status: string;
    totalEtb: Prisma.Decimal;
    paymentMethod: string;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    buyer?: { firstName: string | null; lastName: string | null; phone: string };
    farmer?: {
      user?: { firstName: string | null; lastName: string | null; phone: string };
    };
    listing?: { region: string; variety: string | null } | null;
    disputeCase?: { id: string; status: string } | null;
  }) {
    const buyer = o.buyer;
    const seller = o.farmer?.user;
    return {
      id: o.id,
      status: o.status,
      totalEtb: o.totalEtb,
      paymentMethod: o.paymentMethod,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      buyerName: buyer
        ? [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') || null
        : null,
      buyerPhone: buyer?.phone ?? null,
      sellerName: seller
        ? [seller.firstName, seller.lastName].filter(Boolean).join(' ') || null
        : null,
      sellerPhone: seller?.phone ?? null,
      listingRegion: o.listing?.region ?? null,
      listingVariety: o.listing?.variety ?? null,
      disputeId: o.disputeCase?.id ?? null,
      disputeStatus: o.disputeCase?.status ?? null,
      stalledEscrow: isStalledEscrow(o.status, o.paidAt),
    };
  }
}
