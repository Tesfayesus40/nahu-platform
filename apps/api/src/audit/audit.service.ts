import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminRequestUser } from '../common/admin/admin-request.types';

const SECRET_KEY_PATTERN =
  /(password|token|secret|otp|recovery|refresh|authorization|cookie|mfa)/i;

/** Matches audit/002 CHECK constraint (VARCHAR, not a Postgres enum). */
export type AuditOutcome = 'SUCCESS' | 'DENIED' | 'FAILED';

export type AppendAuditEventInput = {
  actorUserId?: string | null;
  actorSessionId?: string | null;
  permissionCode?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  requestId?: string | null;
  reason?: string | null;
  outcome: AuditOutcome;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  metadataJson?: unknown;
};

export type ListAuditParams = {
  page: number;
  limit: number;
  action?: string;
  actionPrefix?: string;
  outcome?: string;
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  permissionCode?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async appendEvent(input: AppendAuditEventInput) {
    return this.prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorSessionId: input.actorSessionId ?? null,
        permissionCode: input.permissionCode ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        outcome: input.outcome,
        beforeJson: this.toJson(input.beforeJson),
        afterJson: this.toJson(input.afterJson),
        ip: input.ip ? input.ip.slice(0, 64) : null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 512) : null,
        metadataJson: this.toJson(input.metadataJson),
      },
    });
  }

  buildWhere(params: ListAuditParams): Prisma.AuditEventWhereInput {
    const where: Prisma.AuditEventWhereInput = {};
    if (params.action) {
      where.action = params.action;
    } else if (params.actionPrefix?.trim()) {
      where.action = {
        startsWith: params.actionPrefix.trim(),
        mode: 'insensitive',
      };
    }
    if (params.outcome) where.outcome = params.outcome;
    if (params.actorUserId) where.actorUserId = params.actorUserId;
    if (params.targetType) where.targetType = params.targetType;
    if (params.targetId) where.targetId = params.targetId;
    if (params.requestId) where.requestId = params.requestId;
    if (params.permissionCode) where.permissionCode = params.permissionCode;
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = new Date(params.from);
      if (params.to) where.occurredAt.lte = new Date(params.to);
    }
    return where;
  }

  async listEvents(params: ListAuditParams) {
    const page = Math.max(1, params.page);
    const limit = Math.min(100, Math.max(1, params.limit));
    const where = this.buildWhere(params);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      items,
    };
  }

  async getEvent(id: string) {
    const event = await this.prisma.auditEvent.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException('Audit event not found');
    }
    return event;
  }

  async summary(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [byOutcome, topActions] = await Promise.all([
      this.prisma.auditEvent.groupBy({
        by: ['outcome'],
        where: { occurredAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.auditEvent.groupBy({
        by: ['action'],
        where: { occurredAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ]);

    const outcomes: Record<string, number> = {
      SUCCESS: 0,
      DENIED: 0,
      FAILED: 0,
    };
    for (const row of byOutcome) {
      outcomes[row.outcome] = row._count._all;
    }

    return {
      days,
      since: since.toISOString(),
      byOutcome: outcomes,
      topActions: topActions.map((a) => ({
        action: a.action,
        count: a._count._all,
      })),
    };
  }

  async exportCsv(
    admin: AdminRequestUser,
    params: ListAuditParams,
    meta: { ip?: string; userAgent?: string; requestId?: string } = {},
  ) {
    const where = this.buildWhere(params);
    const items = await this.prisma.auditEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 1000,
    });

    await this.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'audit.export',
      action: 'audit.events.export',
      targetType: 'audit_export',
      outcome: 'SUCCESS',
      afterJson: { rowCount: items.length, filters: params },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    const header = [
      'id',
      'occurredAt',
      'action',
      'outcome',
      'actorUserId',
      'permissionCode',
      'targetType',
      'targetId',
      'requestId',
      'reason',
      'ip',
    ];
    const lines = [header.join(',')];
    for (const row of items) {
      lines.push(
        [
          row.id,
          row.occurredAt.toISOString(),
          row.action,
          row.outcome,
          row.actorUserId ?? '',
          row.permissionCode ?? '',
          row.targetType ?? '',
          row.targetId ?? '',
          row.requestId ?? '',
          csvEscape(row.reason ?? ''),
          row.ip ?? '',
        ].join(','),
      );
    }
    return {
      filename: `audit-events-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: lines.join('\n'),
      rowCount: items.length,
    };
  }

  private toJson(
    value: unknown,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.JsonNull;
    }
    return this.redact(value) as Prisma.InputJsonValue;
  }

  /** Strip secret-looking keys from nested JSON before persistence. */
  redact(value: unknown): unknown {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.redact(v));
    }
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (SECRET_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = this.redact(nested);
      }
    }
    return out;
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
