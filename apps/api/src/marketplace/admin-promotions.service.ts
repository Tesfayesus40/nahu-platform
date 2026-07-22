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
  ListCooperativesQueryDto,
  ListPromotionsQueryDto,
  UpdateCooperativeDto,
  UpsertPromotionDto,
} from './dto/promotions-coops.dto';

type RequestMeta = { ip?: string; userAgent?: string; requestId?: string };

@Injectable()
export class AdminPromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.prisma.promotion.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const out: Record<string, number> = {
      DRAFT: 0,
      ACTIVE: 0,
      PAUSED: 0,
      ENDED: 0,
    };
    for (const row of rows) out[row.status] = row._count._all;
    return out;
  }

  async list(query: ListPromotionsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.PromotionWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [total, items] = await this.prisma.$transaction([
      this.prisma.promotion.count({ where }),
      this.prisma.promotion.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { page, limit, total, items };
  }

  async get(id: string) {
    const p = await this.prisma.promotion.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Promotion not found');
    return p;
  }

  async create(
    admin: AdminRequestUser,
    dto: UpsertPromotionDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.promotion.findUnique({ where: { code } });
    if (existing) throw new BadRequestException('Promotion code already exists');

    const created = await this.prisma.promotion.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        status: dto.status,
        scopeType: dto.scopeType,
        scopeRef: dto.scopeRef?.trim() || null,
        discountType: dto.discountType ?? null,
        discountValue: dto.discountValue ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        createdByUserId: admin.userId,
        updatedByUserId: admin.userId,
      },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'marketplace.promotions.manage',
      action: 'marketplace.promotion.create',
      targetType: 'promotion',
      targetId: created.id,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      afterJson: { code: created.code, status: created.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return created;
  }

  async update(
    admin: AdminRequestUser,
    id: string,
    dto: UpsertPromotionDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const existing = await this.prisma.promotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Promotion not found');

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        status: dto.status,
        scopeType: dto.scopeType,
        scopeRef: dto.scopeRef?.trim() || null,
        discountType: dto.discountType ?? null,
        discountValue: dto.discountValue ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        updatedByUserId: admin.userId,
        updatedAt: new Date(),
      },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'marketplace.promotions.manage',
      action: 'marketplace.promotion.update',
      targetType: 'promotion',
      targetId: id,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { status: existing.status, code: existing.code },
      afterJson: { status: updated.status, code: updated.code },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return updated;
  }
}

@Injectable()
export class AdminCooperativesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  async countVerified(): Promise<{ total: number; verified: number }> {
    const [total, verified] = await Promise.all([
      this.prisma.cooperative.count(),
      this.prisma.cooperative.count({ where: { verified: true } }),
    ]);
    return { total, verified };
  }

  async list(query: ListCooperativesQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.CooperativeWhereInput = {};
    if (query.region?.trim()) {
      where.region = { contains: query.region.trim(), mode: 'insensitive' };
    }
    if (query.verified === 'true') where.verified = true;
    if (query.verified === 'false') where.verified = false;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { unionName: { contains: q, mode: 'insensitive' } },
        { licenseNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.cooperative.count({ where }),
      this.prisma.cooperative.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { farmerProfiles: true } } },
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: items.map((c) => ({
        id: c.id,
        name: c.name,
        unionName: c.unionName,
        region: c.region,
        zone: c.zone,
        licenseNumber: c.licenseNumber,
        verified: c.verified,
        verificationStatus: c.verificationStatus,
        farmerCount: c._count.farmerProfiles,
        updatedAt: c.updatedAt,
      })),
    };
  }

  async get(id: string) {
    const c = await this.prisma.cooperative.findUnique({
      where: { id },
      include: {
        farmerProfiles: {
          take: 20,
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
              },
            },
            _count: { select: { listings: true, orders: true } },
          },
        },
      },
    });
    if (!c) throw new NotFoundException('Cooperative not found');
    return c;
  }

  async update(
    admin: AdminRequestUser,
    id: string,
    dto: UpdateCooperativeDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const existing = await this.prisma.cooperative.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cooperative not found');

    const updated = await this.prisma.cooperative.update({
      where: { id },
      data: {
        verificationNotes:
          dto.verificationNotes !== undefined
            ? dto.verificationNotes.trim()
            : existing.verificationNotes,
        licenseNumber:
          dto.licenseNumber !== undefined
            ? dto.licenseNumber.trim() || null
            : existing.licenseNumber,
        unionName:
          dto.unionName !== undefined
            ? dto.unionName.trim() || null
            : existing.unionName,
        updatedAt: new Date(),
      },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'marketplace.cooperatives.manage',
      action: 'marketplace.cooperative.update',
      targetType: 'cooperative',
      targetId: id,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: {
        licenseNumber: existing.licenseNumber,
        unionName: existing.unionName,
      },
      afterJson: {
        licenseNumber: updated.licenseNumber,
        unionName: updated.unionName,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.get(id);
  }
}
