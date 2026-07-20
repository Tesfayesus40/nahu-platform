import { Injectable } from '@nestjs/common';
import { AuditOutcome, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SECRET_KEY_PATTERN =
  /(password|token|secret|otp|recovery|refresh|authorization|cookie|mfa)/i;

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

  async listEvents(params: { page: number; limit: number; action?: string }) {
    const page = Math.max(1, params.page);
    const limit = Math.min(100, Math.max(1, params.limit));
    const where = params.action ? { action: params.action } : {};

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
