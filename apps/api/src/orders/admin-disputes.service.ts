import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { AdminAuthService } from '../identity/admin/admin-auth.service';
import {
  OPEN_DISPUTE_STATUSES,
  canApplyDisputeAction,
  requiresDisputeReason,
  statusAfterDisputeAction,
  type DisputeAction,
  type DisputeStatus,
} from './dispute.rules';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto';
import {
  BulkDisputeAssignDto,
  DisputeActionDto,
  DisputeAssignDto,
  DisputeEvidenceDto,
  DisputeNoteDto,
} from './dto/dispute-action.dto';

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
export class AdminDisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  async countOpen(): Promise<number> {
    return this.prisma.disputeCase.count({
      where: { status: { in: [...OPEN_DISPUTE_STATUSES] } },
    });
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.prisma.disputeCase.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const out: Record<string, number> = {
      OPEN: 0,
      UNDER_REVIEW: 0,
      RESOLVED: 0,
      CLOSED: 0,
      ESCALATED: 0,
    };
    for (const row of rows) {
      out[row.status] = row._count._all;
    }
    return out;
  }

  async list(admin: AdminRequestUser, query: ListDisputesQueryDto) {
    this.assertCanRead(admin);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Prisma.DisputeCaseWhereInput = {};
    if (query.status) {
      where.status = query.status;
    } else if (query.queue !== 'all') {
      where.status = { in: [...OPEN_DISPUTE_STATUSES] };
    }
    if (query.assignedToUserId) {
      where.assignedToUserId = query.assignedToUserId;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      const or: Prisma.DisputeCaseWhereInput[] = [
        { summary: { contains: q, mode: 'insensitive' } },
        { reasonCode: { contains: q, mode: 'insensitive' } },
        {
          order: {
            OR: [
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
            ],
          },
        },
      ];
      const asUuid = this.asUuidOrUndefined(q);
      if (asUuid) {
        or.push({ orderId: asUuid }, { id: asUuid });
      }
      where.OR = or;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.disputeCase.count({ where }),
      this.prisma.disputeCase.findMany({
        where,
        orderBy: { openedAt: query.order === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: {
            include: {
              buyer: { select: USER_SELECT },
              farmer: {
                include: { user: { select: USER_SELECT } },
              },
              listing: {
                select: {
                  id: true,
                  region: true,
                  variety: true,
                  grade: true,
                  processMethod: true,
                },
              },
            },
          },
          _count: { select: { events: true, evidence: true, notes: true } },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((d) => this.toListItem(d, admin)),
    };
  }

  async get(admin: AdminRequestUser, disputeId: string) {
    this.assertCanRead(admin);
    const d = await this.prisma.disputeCase.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            buyer: { select: USER_SELECT },
            farmer: {
              include: {
                user: { select: USER_SELECT },
                cooperative: {
                  select: { id: true, name: true, verified: true },
                },
              },
            },
            listing: {
              select: {
                id: true,
                region: true,
                woreda: true,
                variety: true,
                grade: true,
                processMethod: true,
                quantityKg: true,
                pricePerKg: true,
                photoUrls: true,
              },
            },
          },
        },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
        evidence: { orderBy: { createdAt: 'desc' }, take: 50 },
        notes: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!d) {
      throw new NotFoundException('Dispute not found');
    }

    return {
      ...this.toListItem(d, admin),
      resolutionCode: d.resolutionCode,
      resolutionNotes: d.resolutionNotes,
      infoRequestMessage: d.infoRequestMessage,
      refundStatus: d.refundStatus,
      refundAmountEtb: d.refundAmountEtb,
      refundNotes: d.refundNotes,
      escalatedAt: d.escalatedAt,
      resolvedAt: d.resolvedAt,
      closedAt: d.closedAt,
      openedByUserId: d.openedByUserId,
      openedByRole: d.openedByRole,
      order: {
        id: d.order.id,
        status: d.order.status,
        totalEtb: d.order.totalEtb,
        commissionEtb: d.order.commissionEtb,
        farmerPayoutEtb: d.order.farmerPayoutEtb,
        quantityKg: d.order.quantityKg,
        quantity: d.order.quantity,
        unitCode: d.order.unitCode,
        paymentMethod: d.order.paymentMethod,
        paymentReference: d.order.paymentReference,
        deliveryAddress: d.order.deliveryAddress,
        paidAt: d.order.paidAt,
        deliveredAt: d.order.deliveredAt,
        completedAt: d.order.completedAt,
        createdAt: d.order.createdAt,
        listing: d.order.listing,
      },
      buyer: d.order.buyer,
      seller: {
        farmerProfileId: d.order.farmer.id,
        region: d.order.farmer.region,
        woreda: d.order.farmer.woreda,
        verified: d.order.farmer.verified,
        cooperative: d.order.farmer.cooperative,
        user: d.order.farmer.user,
      },
      timeline: d.events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        message: e.message,
        actorUserId: e.actorUserId,
        metadataJson: e.metadataJson,
        createdAt: e.createdAt,
      })),
      evidence: d.evidence.map((e) => ({
        id: e.id,
        label: e.label,
        fileUrl: e.fileUrl,
        contentType: e.contentType,
        uploadedByUserId: e.uploadedByUserId,
        createdAt: e.createdAt,
      })),
      notes: d.notes.map((n) => ({
        id: n.id,
        body: n.body,
        isInternal: n.isInternal,
        authorUserId: n.authorUserId,
        createdAt: n.createdAt,
      })),
    };
  }

  async applyAction(
    admin: AdminRequestUser,
    disputeId: string,
    dto: DisputeActionDto,
    meta: RequestMeta = {},
  ) {
    this.assertCanManage(admin);
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);

    const action = dto.action as DisputeAction;
    if (requiresDisputeReason(action) && !dto.reason?.trim()) {
      throw new BadRequestException('reason is required for this action');
    }
    if (action === 'REFUND') {
      if (dto.refundAmountEtb == null || Number(dto.refundAmountEtb) < 0) {
        throw new BadRequestException(
          'refundAmountEtb is required for REFUND (records intent only)',
        );
      }
    }

    const existing = await this.prisma.disputeCase.findUnique({
      where: { id: disputeId },
      include: { order: true },
    });
    if (!existing) {
      throw new NotFoundException('Dispute not found');
    }

    const fromStatus = existing.status as DisputeStatus;
    if (!canApplyDisputeAction(action, fromStatus)) {
      throw new BadRequestException(
        `Cannot apply ${action} while dispute is ${fromStatus}`,
      );
    }

    const toStatus = statusAfterDisputeAction(action, fromStatus);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.DisputeCaseUpdateInput = {
        status: toStatus,
        updatedAt: now,
        assignedToUserId: existing.assignedToUserId ?? admin.userId,
      };

      if (action === 'REQUEST_INFO') {
        data.infoRequestMessage = dto.reason!.trim();
      }
      if (action === 'RESOLVE' || action === 'REJECT') {
        data.resolutionCode =
          dto.resolutionCode?.trim() ||
          (action === 'RESOLVE' ? 'RESOLVED' : 'REJECTED');
        data.resolutionNotes = [dto.reason, dto.notes]
          .filter((s) => s?.trim())
          .join('\n')
          .trim();
        data.resolvedAt = now;
      }
      if (action === 'CLOSE') {
        data.closedAt = now;
        if (!existing.resolvedAt && fromStatus !== 'RESOLVED') {
          data.resolutionCode = dto.resolutionCode?.trim() || 'CLOSED';
          data.resolutionNotes = dto.reason?.trim() ?? null;
        }
      }
      if (action === 'ESCALATE') {
        data.escalatedAt = now;
      }
      if (action === 'REFUND') {
        data.refundStatus = 'RECORDED_PENDING_PROVIDER';
        data.refundAmountEtb = dto.refundAmountEtb!;
        data.refundNotes = [dto.reason, dto.notes]
          .filter((s) => s?.trim())
          .join('\n')
          .trim();
      }

      await tx.disputeCase.update({ where: { id: disputeId }, data });

      await tx.disputeEvent.create({
        data: {
          disputeId,
          eventType: action,
          fromStatus,
          toStatus,
          message: dto.reason?.trim() ?? dto.notes?.trim() ?? null,
          actorUserId: admin.userId,
          metadataJson: {
            resolutionCode: dto.resolutionCode ?? null,
            refundAmountEtb:
              action === 'REFUND' ? dto.refundAmountEtb : undefined,
          },
        },
      });

      const orderStatus = this.orderStatusAfterAction(
        action,
        existing.order.status,
      );
      if (orderStatus && orderStatus !== existing.order.status) {
        await tx.order.update({
          where: { id: existing.orderId },
          data: {
            status: orderStatus,
            completedAt:
              orderStatus === 'COMPLETED'
                ? (existing.order.completedAt ?? now)
                : existing.order.completedAt,
            updatedAt: now,
          },
        });
      }
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'orders.disputes.manage',
      action: `orders.dispute.${action.toLowerCase()}`,
      targetType: 'dispute_case',
      targetId: disputeId,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { status: fromStatus, orderStatus: existing.order.status },
      afterJson: {
        status: toStatus,
        refundAmountEtb: action === 'REFUND' ? dto.refundAmountEtb : undefined,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.get(admin, disputeId);
  }

  async assign(
    admin: AdminRequestUser,
    disputeId: string,
    dto: DisputeAssignDto,
    meta: RequestMeta = {},
  ) {
    this.assertCanManage(admin);
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.applyAssign(admin, disputeId, dto.assigneeUserId, dto.reason, meta);
  }

  async bulkAssign(
    admin: AdminRequestUser,
    dto: BulkDisputeAssignDto,
    meta: RequestMeta = {},
  ) {
    this.assertCanManage(admin);
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of dto.disputeIds) {
      try {
        await this.applyAssign(
          admin,
          id,
          dto.assigneeUserId,
          dto.reason,
          meta,
          { skipReauth: true, skipAudit: true },
        );
        results.push({ id, ok: true });
      } catch (err) {
        results.push({
          id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'orders.disputes.manage',
      action: 'orders.dispute.bulk_assign',
      targetType: 'dispute_batch',
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      afterJson: {
        assigneeUserId: dto.assigneeUserId,
        attempted: dto.disputeIds.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return { results };
  }

  async addNote(
    admin: AdminRequestUser,
    disputeId: string,
    dto: DisputeNoteDto,
    meta: RequestMeta = {},
  ) {
    this.assertCanManage(admin);
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);

    const existing = await this.prisma.disputeCase.findUnique({
      where: { id: disputeId },
    });
    if (!existing) {
      throw new NotFoundException('Dispute not found');
    }

    const body = dto.body.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.disputeNote.create({
        data: {
          disputeId,
          body,
          isInternal: true,
          authorUserId: admin.userId,
        },
      });
      await tx.disputeEvent.create({
        data: {
          disputeId,
          eventType: 'NOTE',
          fromStatus: existing.status,
          toStatus: existing.status,
          message: body.slice(0, 500),
          actorUserId: admin.userId,
        },
      });
      await tx.disputeCase.update({
        where: { id: disputeId },
        data: { updatedAt: new Date() },
      });
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'orders.disputes.manage',
      action: 'orders.dispute.note',
      targetType: 'dispute_case',
      targetId: disputeId,
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.get(admin, disputeId);
  }

  async addEvidence(
    admin: AdminRequestUser,
    disputeId: string,
    dto: DisputeEvidenceDto,
    meta: RequestMeta = {},
  ) {
    this.assertCanManage(admin);

    const existing = await this.prisma.disputeCase.findUnique({
      where: { id: disputeId },
    });
    if (!existing) {
      throw new NotFoundException('Dispute not found');
    }

    const evidence = await this.prisma.$transaction(async (tx) => {
      const row = await tx.disputeEvidence.create({
        data: {
          disputeId,
          label: dto.label.trim(),
          fileUrl: dto.fileUrl.trim(),
          contentType: dto.contentType?.trim() || null,
          uploadedByUserId: admin.userId,
        },
      });
      await tx.disputeEvent.create({
        data: {
          disputeId,
          eventType: 'EVIDENCE_ADDED',
          fromStatus: existing.status,
          toStatus: existing.status,
          message: dto.label.trim(),
          actorUserId: admin.userId,
          metadataJson: { evidenceId: row.id, fileUrl: row.fileUrl },
        },
      });
      await tx.disputeCase.update({
        where: { id: disputeId },
        data: { updatedAt: new Date() },
      });
      return row;
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'orders.disputes.manage',
      action: 'orders.dispute.evidence.add',
      targetType: 'dispute_evidence',
      targetId: evidence.id,
      outcome: 'SUCCESS',
      afterJson: { disputeId, label: evidence.label },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.get(admin, disputeId);
  }

  private async applyAssign(
    admin: AdminRequestUser,
    disputeId: string,
    assigneeUserId: string,
    reason: string | undefined,
    meta: RequestMeta,
    opts: { skipReauth?: boolean; skipAudit?: boolean } = {},
  ) {
    void opts.skipReauth;
    const existing = await this.prisma.disputeCase.findUnique({
      where: { id: disputeId },
    });
    if (!existing) {
      throw new NotFoundException('Dispute not found');
    }

    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeUserId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!assignee || assignee.deletedAt) {
      throw new BadRequestException('Assignee user not found');
    }
    if (assignee.status === 'SUSPENDED') {
      throw new BadRequestException('Assignee user is suspended');
    }

    const fromStatus = existing.status;
    await this.prisma.$transaction(async (tx) => {
      await tx.disputeCase.update({
        where: { id: disputeId },
        data: {
          assignedToUserId: assigneeUserId,
          status:
            fromStatus === 'OPEN'
              ? 'UNDER_REVIEW'
              : fromStatus,
          updatedAt: new Date(),
        },
      });
      await tx.disputeEvent.create({
        data: {
          disputeId,
          eventType: 'ASSIGNED',
          fromStatus,
          toStatus: fromStatus === 'OPEN' ? 'UNDER_REVIEW' : fromStatus,
          message: reason?.trim() || `Assigned to ${assigneeUserId}`,
          actorUserId: admin.userId,
          metadataJson: { assigneeUserId },
        },
      });
    });

    if (!opts.skipAudit) {
      await this.audit.appendEvent({
        actorUserId: admin.userId,
        actorSessionId: admin.sessionId,
        permissionCode: 'orders.disputes.manage',
        action: 'orders.dispute.assign',
        targetType: 'dispute_case',
        targetId: disputeId,
        reason: reason ?? null,
        outcome: 'SUCCESS',
        afterJson: { assigneeUserId },
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
    }

    return this.get(admin, disputeId);
  }

  private orderStatusAfterAction(
    action: DisputeAction,
    currentOrderStatus: string,
  ): 'COMPLETED' | 'CANCELLED' | null {
    if (currentOrderStatus === 'CANCELLED') return null;
    if (action === 'RESOLVE' || action === 'REJECT' || action === 'CLOSE') {
      return 'COMPLETED';
    }
    return null;
  }

  private toListItem(
    d: {
      id: string;
      orderId: string;
      status: string;
      assignedToUserId: string | null;
      reasonCode: string | null;
      summary: string | null;
      refundStatus: string;
      openedAt: Date;
      updatedAt: Date;
      order?: {
        status: string;
        totalEtb: Prisma.Decimal;
        buyer?: {
          firstName: string | null;
          lastName: string | null;
          phone: string;
        };
        farmer?: {
          user?: {
            firstName: string | null;
            lastName: string | null;
            phone: string;
          };
        };
        listing?: { region: string; variety: string | null } | null;
      };
      _count?: { events: number; evidence: number; notes: number };
    },
    admin: AdminRequestUser,
  ) {
    const buyer = d.order?.buyer;
    const seller = d.order?.farmer?.user;
    return {
      id: d.id,
      orderId: d.orderId,
      status: d.status,
      assignedToUserId: d.assignedToUserId,
      reasonCode: d.reasonCode,
      summary: d.summary,
      refundStatus: d.refundStatus,
      openedAt: d.openedAt,
      updatedAt: d.updatedAt,
      orderStatus: d.order?.status ?? null,
      totalEtb: d.order?.totalEtb ?? null,
      buyerName: buyer
        ? [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') || null
        : null,
      buyerPhone: buyer?.phone ?? null,
      sellerName: seller
        ? [seller.firstName, seller.lastName].filter(Boolean).join(' ') || null
        : null,
      sellerPhone: seller?.phone ?? null,
      listingRegion: d.order?.listing?.region ?? null,
      listingVariety: d.order?.listing?.variety ?? null,
      eventCount: d._count?.events ?? undefined,
      evidenceCount: d._count?.evidence ?? undefined,
      noteCount: d._count?.notes ?? undefined,
      canManage: admin.permissions.includes('orders.disputes.manage'),
    };
  }

  private assertCanRead(admin: AdminRequestUser) {
    if (!admin.permissions.includes('orders.disputes.read')) {
      throw new ForbiddenException('Missing orders.disputes.read');
    }
  }

  private assertCanManage(admin: AdminRequestUser) {
    if (!admin.permissions.includes('orders.disputes.manage')) {
      throw new ForbiddenException('Missing orders.disputes.manage');
    }
  }

  private asUuidOrUndefined(value: string): string | undefined {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
      ? value
      : undefined;
  }
}
