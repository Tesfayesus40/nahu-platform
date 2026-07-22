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

type RequestMeta = { ip?: string; userAgent?: string; requestId?: string };

const SEVERITIES = ['INFO', 'WARN', 'CRITICAL'] as const;
const AUDIENCES = ['USER', 'BROADCAST', 'ROLE'] as const;

@Injectable()
export class AdminNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  async listForAdmin(
    admin: AdminRequestUser,
    params: { page?: number; limit?: number; unreadOnly?: boolean },
  ) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const where = this.visibilityWhere(admin, params.unreadOnly === true);

    const [total, unreadCount, items] = await Promise.all([
      this.prisma.adminNotification.count({ where }),
      this.prisma.adminNotification.count({
        where: this.visibilityWhere(admin, true),
      }),
      this.prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { page, limit, total, unreadCount, items };
  }

  async markRead(admin: AdminRequestUser, id: string, meta: RequestMeta = {}) {
    const item = await this.prisma.adminNotification.findUnique({
      where: { id },
    });
    if (!item || !this.isVisibleTo(admin, item)) {
      throw new NotFoundException('Notification not found');
    }
    if (item.readAt) return item;

    const updated = await this.prisma.adminNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'notifications.manage',
      action: 'notifications.mark_read',
      targetType: 'admin_notification',
      targetId: id,
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return updated;
  }

  async markAllRead(admin: AdminRequestUser, meta: RequestMeta = {}) {
    const result = await this.prisma.adminNotification.updateMany({
      where: this.visibilityWhere(admin, true),
      data: { readAt: new Date() },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'notifications.manage',
      action: 'notifications.mark_all_read',
      targetType: 'admin_notification',
      outcome: 'SUCCESS',
      afterJson: { updated: result.count },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return { updated: result.count };
  }

  async publish(
    admin: AdminRequestUser,
    dto: {
      title: string;
      body: string;
      severity?: string;
      audience?: string;
      audienceRole?: string;
      recipientUserId?: string;
      linkPath?: string;
      sourceModule?: string;
      dedupeKey?: string;
      reauthPassword: string;
      reason?: string;
    },
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);

    const audience = (dto.audience ?? 'BROADCAST').toUpperCase();
    const severity = (dto.severity ?? 'INFO').toUpperCase();
    if (!(AUDIENCES as readonly string[]).includes(audience)) {
      throw new BadRequestException('Invalid audience');
    }
    if (!(SEVERITIES as readonly string[]).includes(severity)) {
      throw new BadRequestException('Invalid severity');
    }
    if (audience === 'ROLE' && !dto.audienceRole) {
      throw new BadRequestException('audienceRole required for ROLE audience');
    }
    if (audience === 'USER' && !dto.recipientUserId) {
      throw new BadRequestException('recipientUserId required for USER audience');
    }

    if (dto.dedupeKey) {
      const existing = await this.prisma.adminNotification.findFirst({
        where: { dedupeKey: dto.dedupeKey },
      });
      if (existing) {
        return { item: existing, deduped: true };
      }
    }

    const item = await this.prisma.adminNotification.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        severity,
        audience,
        audienceRole: audience === 'ROLE' ? dto.audienceRole! : null,
        recipientUserId: audience === 'USER' ? dto.recipientUserId! : null,
        linkPath: dto.linkPath ?? null,
        sourceModule: dto.sourceModule?.trim() || 'platform',
        dedupeKey: dto.dedupeKey ?? null,
      },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'notifications.manage',
      action: 'notifications.publish',
      targetType: 'admin_notification',
      targetId: item.id,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      afterJson: {
        audience: item.audience,
        severity: item.severity,
        sourceModule: item.sourceModule,
        title: item.title,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    // Channel stub for future mailer / push (Farms, Delivery, AI).
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info(
        `[notifications] published id=${item.id} audience=${item.audience} severity=${item.severity}`,
      );
    }

    return { item, deduped: false };
  }

  /** Upsert-style helper for domain modules (monitoring, delivery, AI). */
  async ensureOperationalNotice(input: {
    title: string;
    body: string;
    severity?: string;
    linkPath?: string;
    sourceModule: string;
    dedupeKey: string;
  }) {
    const existing = await this.prisma.adminNotification.findFirst({
      where: { dedupeKey: input.dedupeKey },
    });
    if (existing) return existing;
    return this.prisma.adminNotification.create({
      data: {
        title: input.title,
        body: input.body,
        severity: input.severity ?? 'WARN',
        audience: 'BROADCAST',
        linkPath: input.linkPath ?? null,
        sourceModule: input.sourceModule,
        dedupeKey: input.dedupeKey,
      },
    });
  }

  private visibilityWhere(
    admin: AdminRequestUser,
    unreadOnly: boolean,
  ): Prisma.AdminNotificationWhereInput {
    const or: Prisma.AdminNotificationWhereInput[] = [
      { audience: 'BROADCAST' },
      { audience: 'USER', recipientUserId: admin.userId },
    ];
    if (admin.roles.length) {
      or.push({
        audience: 'ROLE',
        audienceRole: { in: admin.roles },
      });
    }
    return {
      AND: [{ OR: or }, unreadOnly ? { readAt: null } : {}],
    };
  }

  private isVisibleTo(
    admin: AdminRequestUser,
    item: {
      audience: string;
      recipientUserId: string | null;
      audienceRole: string | null;
    },
  ): boolean {
    if (item.audience === 'BROADCAST') return true;
    if (item.audience === 'USER') return item.recipientUserId === admin.userId;
    if (item.audience === 'ROLE')
      return Boolean(
        item.audienceRole && admin.roles.includes(item.audienceRole),
      );
    return false;
  }
}
