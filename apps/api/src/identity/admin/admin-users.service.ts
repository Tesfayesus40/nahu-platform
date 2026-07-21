import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AdminRequestUser } from '../../common/admin/admin-request.types';
import {
  generateOpaqueToken,
  hashToken,
} from '../../common/crypto/admin-crypto';
import {
  INVITABLE_ROLE_CODES,
  WORKFORCE_ROLE_CODES,
  isSelfTarget,
  isWorkforceCapableUser,
  mergeAssignableWorkforceRoles,
  resolveRoleCodes,
  wouldRemoveLastActiveSuperAdmin,
} from './admin-auth.rules';
import { AdminAuthService } from './admin-auth.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { PrivilegedUserActionDto } from './dto/privileged-user-action.dto';

type RequestMeta = { ip?: string; userAgent?: string; requestId?: string };

const userListInclude = {
  userRoles: { include: { role: true } },
  credential: true,
  mfaFactors: {
    where: { type: 'TOTP', verifiedAt: { not: null }, disabledAt: null },
    select: { id: true },
  },
} satisfies Prisma.UserInclude;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  private invitationTtlMs(): number {
    const hours =
      this.config.get<number>('adminAuth.invitationTtlHours') ?? 72;
    return hours * 60 * 60 * 1000;
  }

  async listUsers(query: ListUsersQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const sort = query.sort ?? 'createdAt';
    const order = query.order ?? 'desc';

    const where: Prisma.UserWhereInput = {};
    if (query.status) {
      where.status = query.status as UserStatus;
    }
    if (query.role) {
      where.userRoles = { some: { role: { code: query.role } } };
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sort]: order,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: userListInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((user) => this.toListItem(user)),
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        credential: true,
        mfaFactors: {
          select: {
            id: true,
            type: true,
            label: true,
            verifiedAt: true,
            disabledAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            adminSessions: { where: { revokedAt: null } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = resolveRoleCodes(user.userRoles);
    const hasPassword = Boolean(user.credential?.passwordHash);
    const mfaEnrolled = user.mfaFactors.some(
      (f) => f.verifiedAt && !f.disabledAt,
    );

    return {
      id: user.id,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      preferredLanguage: user.preferredLanguage,
      authzVersion: user.authzVersion,
      mfaRequired: user.mfaRequired,
      mfaEnrolled,
      mustResetPassword: user.mustResetPassword,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      workforceCapable: isWorkforceCapableUser({
        roleCodes: roles,
        mfaRequired: user.mfaRequired,
        hasPassword,
        hasMfaFactors: mfaEnrolled,
      }),
      credential: user.credential
        ? {
            hasPassword,
            failedLoginAttempts: user.credential.failedLoginAttempts,
            lockedUntil: user.credential.lockedUntil,
            passwordChangedAt: user.credential.passwordChangedAt,
            lastLoginAt: user.credential.lastLoginAt,
          }
        : null,
      mfaFactors: user.mfaFactors.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        verifiedAt: f.verifiedAt,
        disabledAt: f.disabledAt,
        createdAt: f.createdAt,
      })),
      activeAdminSessionCount: user._count.adminSessions,
    };
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        displayName: true,
        description: true,
      },
    });
    return {
      items: roles,
      assignableCodes: [...INVITABLE_ROLE_CODES],
      workforceCodes: [...WORKFORCE_ROLE_CODES],
    };
  }

  async updateStatus(
    admin: AdminRequestUser,
    userId: string,
    dto: UpdateUserStatusDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    this.rejectSelf(admin.userId, userId);

    const user = await this.loadUserWithRoles(userId);
    const roles = resolveRoleCodes(user.userRoles);
    const previousStatus = user.status;
    const targetStatus = dto.targetStatus as UserStatus;

    if (previousStatus === targetStatus) {
      throw new BadRequestException('User already has this status');
    }

    if (
      roles.includes('SUPER_ADMIN') &&
      targetStatus !== 'ACTIVE' &&
      previousStatus === 'ACTIVE'
    ) {
      await this.assertNotLastActiveSuperAdmin(userId);
    }

    const revokeSessions =
      targetStatus === 'LOCKED' ||
      targetStatus === 'DEACTIVATED' ||
      targetStatus === 'SUSPENDED';

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: targetStatus,
          ...(revokeSessions
            ? { authzVersion: { increment: 1 } }
            : {}),
          updatedAt: new Date(),
        },
      });

      if (targetStatus === 'ACTIVE' && user.credential) {
        await tx.credential.update({
          where: { userId },
          data: {
            lockedUntil: null,
            failedLoginAttempts: 0,
            updatedAt: new Date(),
          },
        });
      }

      if (revokeSessions) {
        await tx.adminSession.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revokeReason: `status_${targetStatus.toLowerCase()}`,
          },
        });
      }
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'identity.users.status.write',
      action: 'identity.user.status.change',
      targetType: 'user',
      targetId: userId,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { status: previousStatus },
      afterJson: { status: targetStatus },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.getUser(userId);
  }

  async updateRoles(
    admin: AdminRequestUser,
    userId: string,
    dto: UpdateUserRolesDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    this.rejectSelf(admin.userId, userId);

    const user = await this.loadUserWithRoles(userId);
    const currentRoles = resolveRoleCodes(user.userRoles);
    if (
      !isWorkforceCapableUser({
        roleCodes: currentRoles,
        mfaRequired: user.mfaRequired,
        hasPassword: Boolean(user.credential?.passwordHash),
      })
    ) {
      throw new BadRequestException(
        'Role assignment applies only to workforce-capable users',
      );
    }

    const nextRoles = mergeAssignableWorkforceRoles(
      currentRoles,
      dto.roleCodes ?? [],
    );
    const nextAssignable = nextRoles.filter((c) =>
      (INVITABLE_ROLE_CODES as readonly string[]).includes(c),
    );
    if (nextAssignable.length === 0 && !nextRoles.includes('SUPER_ADMIN')) {
      throw new BadRequestException(
        'roleCodes must include PLATFORM_ADMIN and/or AUDITOR (or keep SUPER_ADMIN)',
      );
    }

    const roles = await this.prisma.role.findMany({
      where: { code: { in: nextRoles } },
    });
    if (roles.length !== nextRoles.length) {
      throw new BadRequestException('One or more role codes are not seeded');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId,
          roleId: role.id,
          assignedBy: admin.userId,
        })),
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          authzVersion: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      await tx.adminSession.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: 'roles_changed',
        },
      });
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'identity.roles.assign',
      action: 'identity.user.roles.assign',
      targetType: 'user',
      targetId: userId,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { roles: currentRoles },
      afterJson: { roles: nextRoles },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.getUser(userId);
  }

  async resetMfa(
    admin: AdminRequestUser,
    userId: string,
    dto: PrivilegedUserActionDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    this.rejectSelf(admin.userId, userId);

    const user = await this.loadUserWithRoles(userId);
    const roles = resolveRoleCodes(user.userRoles);
    const mfaCount = await this.prisma.mfaFactor.count({
      where: { userId, disabledAt: null },
    });
    if (
      !isWorkforceCapableUser({
        roleCodes: roles,
        mfaRequired: user.mfaRequired,
        hasPassword: Boolean(user.credential?.passwordHash),
        hasMfaFactors: mfaCount > 0,
      })
    ) {
      throw new BadRequestException(
        'MFA reset applies only to workforce-capable users',
      );
    }

    const workforceRoles = roles.filter((c) =>
      (WORKFORCE_ROLE_CODES as readonly string[]).includes(c),
    );
    const inviteRoleCodes =
      workforceRoles.filter((c) =>
        (INVITABLE_ROLE_CODES as readonly string[]).includes(c),
      ).length > 0
        ? workforceRoles.filter((c) =>
            (INVITABLE_ROLE_CODES as readonly string[]).includes(c),
          )
        : ['PLATFORM_ADMIN'];

    if (!user.email) {
      throw new BadRequestException(
        'User email is required to issue an MFA re-enrollment invitation',
      );
    }

    const enrollToken = generateOpaqueToken(32);
    const expiresAt = new Date(Date.now() + this.invitationTtlMs());

    await this.prisma.$transaction(async (tx) => {
      await tx.mfaFactor.updateMany({
        where: { userId, disabledAt: null },
        data: { disabledAt: new Date() },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          mfaRequired: true,
          authzVersion: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      await tx.adminSession.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: 'mfa_reset',
        },
      });
      await tx.adminInvitation.create({
        data: {
          email: user.email!.toLowerCase(),
          phone: user.phone,
          roleCodes: inviteRoleCodes,
          tokenHash: hashToken(enrollToken),
          invitedBy: admin.userId,
          invitedUserId: userId,
          expiresAt,
        },
      });
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'identity.users.mfa.reset',
      action: 'identity.user.mfa.reset',
      targetType: 'user',
      targetId: userId,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return {
      ok: true,
      enrollToken,
      expiresAt,
      userId,
    };
  }

  async resetPassword(
    admin: AdminRequestUser,
    userId: string,
    dto: PrivilegedUserActionDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    this.rejectSelf(admin.userId, userId);

    const user = await this.loadUserWithRoles(userId);
    if (!user.credential?.passwordHash) {
      throw new BadRequestException(
        'Password reset requires an existing password credential',
      );
    }

    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await argon2.hash(temporaryPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.credential.update({
        where: { userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          mustResetPassword: true,
          authzVersion: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      await tx.adminSession.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: 'password_reset',
        },
      });
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'identity.users.password.reset',
      action: 'identity.user.password.reset',
      targetType: 'user',
      targetId: userId,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return {
      ok: true,
      temporaryPassword,
      userId,
      mustResetPassword: true,
    };
  }

  async revokeSessions(
    admin: AdminRequestUser,
    userId: string,
    dto: PrivilegedUserActionDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.prisma.adminSession.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokeReason: dto.reason ?? 'admin_revoke',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { authzVersion: { increment: 1 }, updatedAt: new Date() },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'identity.sessions.revoke',
      action: 'identity.user.sessions.revoke',
      targetType: 'user',
      targetId: userId,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      afterJson: { revokedCount: result.count },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return { ok: true, revokedCount: result.count, userId };
  }

  private rejectSelf(actorUserId: string, targetUserId: string) {
    if (isSelfTarget(actorUserId, targetUserId)) {
      throw new ForbiddenException('Cannot perform this action on your own account');
    }
  }

  private async loadUserWithRoles(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        credential: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async assertNotLastActiveSuperAdmin(userId: string) {
    const otherCount = await this.prisma.user.count({
      where: {
        id: { not: userId },
        status: 'ACTIVE',
        deletedAt: null,
        userRoles: { some: { role: { code: 'SUPER_ADMIN' } } },
      },
    });
    if (
      wouldRemoveLastActiveSuperAdmin({
        targetHasSuperAdmin: true,
        otherActiveSuperAdminCount: otherCount,
      })
    ) {
      throw new ForbiddenException(
        'Cannot change status of the last active SUPER_ADMIN',
      );
    }
  }

  private toListItem(
    user: Prisma.UserGetPayload<{ include: typeof userListInclude }>,
  ) {
    const roles = resolveRoleCodes(user.userRoles);
    const hasPassword = Boolean(user.credential?.passwordHash);
    const mfaEnrolled = user.mfaFactors.length > 0;
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles,
      mfaRequired: user.mfaRequired,
      mfaEnrolled,
      mustResetPassword: user.mustResetPassword,
      lockedUntil: user.credential?.lockedUntil ?? null,
      workforceCapable: isWorkforceCapableUser({
        roleCodes: roles,
        mfaRequired: user.mfaRequired,
        hasPassword,
        hasMfaFactors: mfaEnrolled,
      }),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
