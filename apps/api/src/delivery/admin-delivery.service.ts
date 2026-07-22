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
import {
  requiresFulfillmentReason,
  statusAfterFulfillmentAction,
  type FulfillmentAction,
  type FulfillmentStatus,
} from './fulfillment.rules';
import {
  FulfillmentActionDto,
  ListFulfillmentQueryDto,
} from './dto/fulfillment.dto';

type RequestMeta = { ip?: string; userAgent?: string; requestId?: string };

@Injectable()
export class AdminDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  async countOpen(): Promise<number> {
    return this.prisma.fulfillmentCase.count({
      where: { status: { in: ['PENDING_HANDOFF', 'READY', 'IN_TRANSIT'] } },
    });
  }

  async countExceptions(): Promise<number> {
    return this.prisma.fulfillmentCase.count({
      where: { status: 'EXCEPTION' },
    });
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.prisma.fulfillmentCase.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const out: Record<string, number> = {
      PENDING_HANDOFF: 0,
      READY: 0,
      IN_TRANSIT: 0,
      DELIVERED: 0,
      EXCEPTION: 0,
      CLOSED: 0,
    };
    for (const row of rows) out[row.status] = row._count._all;
    return out;
  }

  async list(query: ListFulfillmentQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.FulfillmentCaseWhereInput = {};
    if (query.status) {
      where.status = query.status;
    } else if (query.queue === 'open') {
      where.status = { in: ['PENDING_HANDOFF', 'READY', 'IN_TRANSIT'] };
    } else if (query.queue === 'exceptions') {
      where.status = 'EXCEPTION';
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { trackingRef: { contains: q, mode: 'insensitive' } },
        { carrierCode: { contains: q, mode: 'insensitive' } },
        { order: { deliveryAddress: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.fulfillmentCase.count({ where }),
      this.prisma.fulfillmentCase.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              totalEtb: true,
              deliveryAddress: true,
              paymentMethod: true,
            },
          },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        status: r.status,
        carrierCode: r.carrierCode,
        trackingRef: r.trackingRef,
        assignedToUserId: r.assignedToUserId,
        updatedAt: r.updatedAt,
        orderStatus: r.order.status,
        totalEtb: r.order.totalEtb,
        deliveryAddress: r.order.deliveryAddress,
      })),
    };
  }

  async get(id: string) {
    const c = await this.prisma.fulfillmentCase.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
        order: {
          include: {
            buyer: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
              },
            },
            farmer: {
              include: {
                user: {
                  select: {
                    id: true,
                    phone: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!c) throw new NotFoundException('Fulfillment case not found');
    return c;
  }

  async applyAction(
    admin: AdminRequestUser,
    id: string,
    dto: FulfillmentActionDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const action = dto.action as FulfillmentAction;
    if (requiresFulfillmentReason(action) && !dto.reason?.trim()) {
      throw new BadRequestException('reason is required for this action');
    }

    const existing = await this.prisma.fulfillmentCase.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!existing) throw new NotFoundException('Fulfillment case not found');

    const fromStatus = existing.status as FulfillmentStatus;
    const toStatus = statusAfterFulfillmentAction(action, fromStatus);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.FulfillmentCaseUpdateInput = {
        status: toStatus,
        updatedAt: now,
      };
      if (action === 'ASSIGN' && dto.assigneeUserId) {
        data.assignedToUserId = dto.assigneeUserId;
      }
      if (action === 'UPDATE_LOGISTICS' || action === 'MARK_IN_TRANSIT') {
        if (dto.carrierCode !== undefined) data.carrierCode = dto.carrierCode;
        if (dto.trackingRef !== undefined) data.trackingRef = dto.trackingRef;
        if (dto.pickupNotes !== undefined) data.pickupNotes = dto.pickupNotes;
        if (dto.deliveryNotes !== undefined)
          data.deliveryNotes = dto.deliveryNotes;
      }
      if (action === 'RAISE_EXCEPTION') {
        data.exceptionCode = dto.exceptionCode ?? 'MANUAL';
        data.exceptionNotes = dto.reason?.trim() ?? null;
      }
      if (action === 'MARK_READY') data.readyAt = existing.readyAt ?? now;
      if (action === 'MARK_IN_TRANSIT')
        data.shippedAt = existing.shippedAt ?? now;
      if (action === 'MARK_DELIVERED')
        data.deliveredAt = existing.deliveredAt ?? now;
      if (action === 'CLOSE') data.closedAt = now;

      await tx.fulfillmentCase.update({ where: { id }, data });
      await tx.fulfillmentEvent.create({
        data: {
          fulfillmentId: id,
          eventType: action,
          fromStatus,
          toStatus,
          message: dto.reason?.trim() ?? null,
          actorUserId: admin.userId,
          metadataJson: {
            carrierCode: dto.carrierCode ?? null,
            trackingRef: dto.trackingRef ?? null,
          },
        },
      });

      // Keep order status loosely aligned for future Delivery module.
      const orderStatus = this.orderStatusForFulfillment(action);
      if (orderStatus && existing.order.status !== 'DISPUTED') {
        await tx.order.update({
          where: { id: existing.orderId },
          data: {
            status: orderStatus as never,
            deliveredAt:
              orderStatus === 'DELIVERED' || orderStatus === 'COMPLETED'
                ? (existing.order.deliveredAt ?? now)
                : existing.order.deliveredAt,
            updatedAt: now,
          },
        });
      }
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'delivery.manage',
      action: `delivery.fulfillment.${action.toLowerCase()}`,
      targetType: 'fulfillment_case',
      targetId: id,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { status: fromStatus },
      afterJson: { status: toStatus },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.get(id);
  }

  private orderStatusForFulfillment(
    action: FulfillmentAction,
  ): string | null {
    switch (action) {
      case 'MARK_READY':
        return 'CONFIRMED';
      case 'MARK_IN_TRANSIT':
        return 'SHIPPED';
      case 'MARK_DELIVERED':
        return 'DELIVERED';
      default:
        return null;
    }
  }
}
