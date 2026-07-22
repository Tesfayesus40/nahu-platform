import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { AdminAuthService } from '../identity/admin/admin-auth.service';

type RequestMeta = { ip?: string; userAgent?: string; requestId?: string };

@Injectable()
export class AdminFeatureFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  list() {
    return this.prisma.featureFlag.findMany({ orderBy: { code: 'asc' } });
  }

  async update(
    admin: AdminRequestUser,
    id: string,
    dto: { enabled: boolean; reauthPassword: string; reason?: string },
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const existing = await this.prisma.featureFlag.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Feature flag not found');
    }
    if (typeof dto.enabled !== 'boolean') {
      throw new BadRequestException('enabled is required');
    }

    const updated = await this.prisma.featureFlag.update({
      where: { id },
      data: {
        enabled: dto.enabled,
        updatedByUserId: admin.userId,
        updatedAt: new Date(),
      },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'admin.system.config.write',
      action: 'system.feature_flag.update',
      targetType: 'feature_flag',
      targetId: id,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { enabled: existing.enabled, code: existing.code },
      afterJson: { enabled: updated.enabled, code: updated.code },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return updated;
  }
}
