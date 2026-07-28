import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  OpsDomainError,
  planSellerAdminAction,
  SellerAdminAction,
} from './ops.rules';

/**
 * G10 — Admin seller party management (verify / suspend / activate).
 * Does not redesign SellerParty — operates on existing status fields.
 */
@Injectable()
export class AdminSellerOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: {
    page?: number;
    limit?: number;
    status?: string;
    verificationStatus?: string;
    q?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.verificationStatus) {
      where.verificationStatus = query.verificationStatus;
    }
    if (query.q?.trim()) {
      where.OR = [
        { displayName: { contains: query.q.trim(), mode: 'insensitive' } },
        { legalName: { contains: query.q.trim(), mode: 'insensitive' } },
        { contactPhone: { contains: query.q.trim() } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.sellerParty.count({ where }),
      this.prisma.sellerParty.findMany({
        where,
        include: {
          sellerType: true,
          ownerUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              status: true,
            },
          },
          farmerProfile: { select: { id: true, verified: true } },
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
      items: rows.map((r) => this.shape(r)),
    };
  }

  async get(id: string) {
    const party = await this.prisma.sellerParty.findUnique({
      where: { id },
      include: {
        sellerType: true,
        ownerUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            status: true,
          },
        },
        farmerProfile: true,
        _count: { select: { listings: true, orders: true } },
      },
    });
    if (!party) throw new NotFoundException('Seller party not found');
    return {
      ...this.shape(party),
      listingCount: party._count.listings,
      orderCount: party._count.orders,
      farmerProfile: party.farmerProfile
        ? {
            id: party.farmerProfile.id,
            verified: party.farmerProfile.verified,
            verificationStatus: party.farmerProfile.verificationStatus,
            region: party.farmerProfile.region,
          }
        : null,
    };
  }

  async applyAction(input: {
    sellerId: string;
    action: SellerAdminAction;
    actorUserId: string;
    sessionId?: string | null;
    notes?: string | null;
    meta?: { ip?: string; userAgent?: string; requestId?: string };
  }) {
    const party = await this.prisma.sellerParty.findUnique({
      where: { id: input.sellerId },
    });
    if (!party) throw new NotFoundException('Seller party not found');

    let planned: ReturnType<typeof planSellerAdminAction>;
    try {
      planned = planSellerAdminAction(input.action, {
        status: party.status,
        verificationStatus: party.verificationStatus,
      });
    } catch (e) {
      if (e instanceof OpsDomainError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const updated = await this.prisma.sellerParty.update({
      where: { id: party.id },
      data: {
        status: planned.status,
        verified: planned.verified,
        verificationStatus: planned.verificationStatus,
        verificationNotes: input.notes?.trim() || party.verificationNotes,
        updatedAt: new Date(),
      },
    });

    // Dual-write farmer profile verification when linked
    if (input.action === 'VERIFY' || input.action === 'REJECT') {
      await this.prisma.farmerProfile.updateMany({
        where: { sellerPartyId: party.id },
        data: {
          verified: planned.verified,
          verificationStatus: planned.verificationStatus,
          verificationNotes: input.notes?.trim() || undefined,
          updatedAt: new Date(),
        },
      });
    }

    await this.audit.appendEvent({
      actorUserId: input.actorUserId,
      actorSessionId: input.sessionId ?? null,
      permissionCode: 'seller.write',
      action: `seller.admin.${input.action.toLowerCase()}`,
      targetType: 'seller_party',
      targetId: party.id,
      reason: input.notes ?? null,
      outcome: 'SUCCESS',
      beforeJson: {
        status: party.status,
        verificationStatus: party.verificationStatus,
        verified: party.verified,
      },
      afterJson: {
        status: updated.status,
        verificationStatus: updated.verificationStatus,
        verified: updated.verified,
      },
      ip: input.meta?.ip,
      userAgent: input.meta?.userAgent,
      requestId: input.meta?.requestId,
    });

    return this.get(party.id);
  }

  private shape(r: {
    id: string;
    ownerUserId: string;
    sellerTypeCode: string;
    displayName: string;
    legalName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    status: string;
    verified: boolean;
    verificationStatus: string;
    verificationNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
    sellerType?: { code: string; nameEn: string } | null;
    ownerUser?: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      phone: string;
      email: string | null;
      status: string;
    } | null;
  }) {
    return {
      id: r.id,
      ownerUserId: r.ownerUserId,
      sellerTypeCode: r.sellerTypeCode,
      sellerTypeName: r.sellerType?.nameEn ?? null,
      displayName: r.displayName,
      legalName: r.legalName,
      contactEmail: r.contactEmail,
      contactPhone: r.contactPhone,
      status: r.status,
      verified: r.verified,
      verificationStatus: r.verificationStatus,
      verificationNotes: r.verificationNotes,
      ownerUser: r.ownerUser ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
