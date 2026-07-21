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
  ACTIONABLE_MODERATION_STATUSES,
  requiresModerationReason,
  statusAfterModerationDecision,
  type ListingModerationDecisionCode,
  type ListingModerationStatus,
} from './listing-moderation.rules';
import { ListModerationQueryDto } from './dto/list-moderation-query.dto';
import {
  BulkListingModerationDto,
  ListingModerationDecisionDto,
  ListingModeratorNoteDto,
} from './dto/listing-moderation.dto';

type RequestMeta = { ip?: string; userAgent?: string; requestId?: string };

@Injectable()
export class AdminListingModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  async countActionable(): Promise<number> {
    return this.prisma.listing.count({
      where: { moderationStatus: { in: [...ACTIONABLE_MODERATION_STATUSES] } },
    });
  }

  async countByModerationStatus(): Promise<Record<string, number>> {
    const rows = await this.prisma.listing.groupBy({
      by: ['moderationStatus'],
      _count: { _all: true },
    });
    const out: Record<string, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      SUSPENDED: 0,
      FLAGGED: 0,
    };
    for (const row of rows) {
      out[row.moderationStatus] = row._count._all;
    }
    return out;
  }

  async list(query: ListModerationQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.ListingWhereInput = {};

    if (query.moderationStatus) {
      where.moderationStatus = query.moderationStatus;
    } else if (query.queue === 'pending') {
      where.moderationStatus = { in: [...ACTIONABLE_MODERATION_STATUSES] };
    }
    if (query.status) {
      where.status = query.status as never;
    }
    if (query.region?.trim()) {
      where.region = { contains: query.region.trim(), mode: 'insensitive' };
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { region: { contains: q, mode: 'insensitive' } },
        { woreda: { contains: q, mode: 'insensitive' } },
        { variety: { contains: q, mode: 'insensitive' } },
        { cooperative: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: query.order === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          farmer: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          category: { select: { code: true, nameEn: true } },
          product: { select: { code: true, nameEn: true } },
          _count: { select: { moderationDecisions: true } },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((l) => this.toListItem(l)),
    };
  }

  async get(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        farmer: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
                status: true,
              },
            },
            cooperative: {
              select: { id: true, name: true, verified: true },
            },
          },
        },
        category: true,
        product: { include: { defaultUnit: true } },
        moderationDecisions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return {
      ...this.toListItem(listing),
      regionEn: listing.regionEn,
      woreda: listing.woreda,
      washingStation: listing.washingStation,
      cooperative: listing.cooperative,
      processMethod: listing.processMethod,
      grade: listing.grade,
      variety: listing.variety,
      quantityKg: listing.quantityKg,
      pricePerKg: listing.pricePerKg,
      quantity: listing.quantity,
      unitCode: listing.unitCode,
      pricePerUnit: listing.pricePerUnit,
      packagingLabel: listing.packagingLabel,
      harvestDate: listing.harvestDate,
      altitudeM: listing.altitudeM,
      cupScore: listing.cupScore,
      photoUrls: listing.photoUrls,
      moderationNotes: listing.moderationNotes,
      moderatedAt: listing.moderatedAt,
      moderatedByUserId: listing.moderatedByUserId,
      farmer: listing.farmer,
      category: listing.category,
      product: listing.product,
      decisions: listing.moderationDecisions.map((d) => ({
        id: d.id,
        decision: d.decision,
        fromStatus: d.fromStatus,
        toStatus: d.toStatus,
        reason: d.reason,
        notes: d.notes,
        actorUserId: d.actorUserId,
        createdAt: d.createdAt,
      })),
    };
  }

  async decide(
    admin: AdminRequestUser,
    listingId: string,
    dto: ListingModerationDecisionDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.applyDecision(admin, listingId, dto, meta);
  }

  async bulkDecide(
    admin: AdminRequestUser,
    dto: BulkListingModerationDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of dto.listingIds) {
      try {
        await this.applyDecision(
          admin,
          id,
          {
            decision: dto.decision,
            reauthPassword: dto.reauthPassword,
            reason: dto.reason,
            notes: dto.notes,
          },
          meta,
          { skipReauth: true },
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
      permissionCode: 'marketplace.listings.moderate',
      action: 'marketplace.listing.moderation.bulk',
      targetType: 'listing_batch',
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      afterJson: {
        decision: dto.decision,
        attempted: dto.listingIds.length,
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
    listingId: string,
    dto: ListingModeratorNoteDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const notes = dto.notes.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id: listingId },
        data: {
          moderationNotes: notes,
          moderatedByUserId: admin.userId,
          updatedAt: new Date(),
        },
      });
      await tx.listingModerationDecision.create({
        data: {
          listingId,
          decision: 'NOTE',
          fromStatus: listing.moderationStatus,
          toStatus: listing.moderationStatus,
          notes,
          actorUserId: admin.userId,
        },
      });
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'marketplace.listings.moderate',
      action: 'marketplace.listing.moderation.note',
      targetType: 'listing',
      targetId: listingId,
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.get(listingId);
  }

  private async applyDecision(
    admin: AdminRequestUser,
    listingId: string,
    dto: Pick<
      ListingModerationDecisionDto,
      'decision' | 'reason' | 'notes' | 'reauthPassword'
    >,
    meta: RequestMeta,
    opts: { skipReauth?: boolean } = {},
  ) {
    if (!opts.skipReauth) {
      // reauth already done by callers that need it
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const decision = dto.decision as ListingModerationDecisionCode;
    if (requiresModerationReason(decision) && !dto.reason?.trim()) {
      throw new BadRequestException('reason is required for this decision');
    }

    const fromStatus = listing.moderationStatus as ListingModerationStatus;
    const toStatus = statusAfterModerationDecision(decision, fromStatus);

    await this.prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id: listingId },
        data: {
          moderationStatus: toStatus,
          moderationNotes: dto.notes?.trim() || listing.moderationNotes,
          moderatedAt: new Date(),
          moderatedByUserId: admin.userId,
          // Rejected/suspended listings leave the commercial marketplace.
          ...(toStatus === 'REJECTED' || toStatus === 'SUSPENDED'
            ? { status: 'CANCELLED' as const }
            : {}),
          ...(toStatus === 'APPROVED' && listing.status === 'CANCELLED'
            ? { status: 'ACTIVE' as const }
            : {}),
          updatedAt: new Date(),
        },
      });
      await tx.listingModerationDecision.create({
        data: {
          listingId,
          decision,
          fromStatus,
          toStatus,
          reason: dto.reason?.trim() ?? null,
          notes: dto.notes?.trim() ?? null,
          actorUserId: admin.userId,
        },
      });
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'marketplace.listings.moderate',
      action: 'marketplace.listing.moderation.decision',
      targetType: 'listing',
      targetId: listingId,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { moderationStatus: fromStatus, status: listing.status },
      afterJson: { moderationStatus: toStatus, decision },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.get(listingId);
  }

  private toListItem(listing: {
    id: string;
    farmerId: string;
    region: string;
    status: string;
    moderationStatus: string;
    quantityKg: unknown;
    pricePerKg: unknown;
    grade: string;
    processMethod: string;
    variety: string | null;
    photoUrls: string[];
    createdAt: Date;
    updatedAt: Date;
    farmer?: {
      user?: {
        id: string;
        email: string | null;
        phone: string;
        firstName: string | null;
        lastName: string | null;
      } | null;
    } | null;
    category?: { code: string } | null;
    product?: { code: string } | null;
    _count?: { moderationDecisions: number };
  }) {
    const user = listing.farmer?.user;
    const sellerName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        user.phone
      : null;
    return {
      id: listing.id,
      farmerId: listing.farmerId,
      region: listing.region,
      status: listing.status,
      moderationStatus: listing.moderationStatus,
      quantityKg: listing.quantityKg,
      pricePerKg: listing.pricePerKg,
      grade: listing.grade,
      processMethod: listing.processMethod,
      variety: listing.variety,
      photoUrls: listing.photoUrls,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      sellerName,
      sellerPhone: user?.phone ?? null,
      categoryCode: listing.category?.code ?? null,
      productCode: listing.product?.code ?? null,
      decisionCount: listing._count?.moderationDecisions,
    };
  }
}
