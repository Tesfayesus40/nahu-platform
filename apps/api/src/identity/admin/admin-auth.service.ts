import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  decryptAesGcm,
  encryptAesGcm,
  generateOpaqueToken,
  hashToken,
  parseMfaEncryptionKey,
} from '../../common/crypto/admin-crypto';
import {
  ADMIN_ACCESS_TYP,
  ADMIN_ENROLL_TYP,
  ADMIN_MFA_TYP,
  AdminAccessJwtPayload,
  AdminEnrollJwtPayload,
  AdminMfaJwtPayload,
  AdminRequestUser,
} from '../../common/admin/admin-request.types';
import {
  classifyRefreshPresentation,
  filterInvitableRoleCodes,
  resolvePermissionCodes,
  resolveRoleCodes,
} from './admin-auth.rules';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { EnrollTotpDto, ConfirmTotpDto } from './dto/enroll-totp.dto';
import { LogoutAllDto } from './dto/logout-all.dto';

authenticator.options = { window: 1 };

type RequestMeta = { ip?: string; userAgent?: string; requestId?: string };

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private get nodeEnv(): string {
    return this.config.get<string>('nodeEnv') ?? 'development';
  }

  private get mfaKey(): Buffer {
    return parseMfaEncryptionKey(
      this.config.get<string>('adminAuth.mfaEncryptionKey'),
      this.nodeEnv,
    );
  }

  private accessTtl(): string {
    return this.config.get<string>('adminAuth.accessTokenTtl') ?? '15m';
  }

  private refreshAbsoluteMs(): number {
    const hours =
      this.config.get<number>('adminAuth.refreshAbsoluteHours') ?? 12;
    return hours * 60 * 60 * 1000;
  }

  private refreshIdleMs(): number {
    const minutes =
      this.config.get<number>('adminAuth.refreshIdleMinutes') ?? 30;
    return minutes * 60 * 1000;
  }

  private invitationTtlMs(): number {
    const hours =
      this.config.get<number>('adminAuth.invitationTtlHours') ?? 72;
    return hours * 60 * 60 * 1000;
  }

  private failedLoginMax(): number {
    return this.config.get<number>('adminAuth.failedLoginMax') ?? 5;
  }

  private failedLoginWindowMs(): number {
    const minutes =
      this.config.get<number>('adminAuth.failedLoginWindowMinutes') ?? 15;
    return minutes * 60 * 1000;
  }

  async createInvitation(
    admin: AdminRequestUser,
    dto: CreateInvitationDto,
    meta: RequestMeta = {},
  ) {
    await this.assertRecentReauth(admin, dto.reauthPassword);

    const roleCodes = filterInvitableRoleCodes(dto.roleCodes);
    if (roleCodes.length === 0) {
      throw new BadRequestException(
        'roleCodes must include PLATFORM_ADMIN and/or AUDITOR only',
      );
    }

    const roles = await this.prisma.role.findMany({
      where: { code: { in: roleCodes } },
    });
    if (roles.length !== roleCodes.length) {
      throw new BadRequestException('One or more role codes are not seeded');
    }

    const email = dto.email.trim().toLowerCase();
    const token = generateOpaqueToken(32);
    const invitation = await this.prisma.adminInvitation.create({
      data: {
        email,
        phone: dto.phone,
        roleCodes,
        tokenHash: hashToken(token),
        invitedBy: admin.userId,
        expiresAt: new Date(Date.now() + this.invitationTtlMs()),
      },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'identity.users.invite',
      action: 'identity.invitation.create',
      targetType: 'admin_invitation',
      targetId: invitation.id,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      afterJson: { email, roleCodes },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return {
      id: invitation.id,
      email: invitation.email,
      phone: invitation.phone,
      roleCodes: invitation.roleCodes,
      expiresAt: invitation.expiresAt,
      // Returned once for staging/ops delivery; never stored plaintext.
      inviteToken: token,
    };
  }

  async acceptInvitation(dto: AcceptInvitationDto, meta: RequestMeta = {}) {
    const invitation = await this.prisma.adminInvitation.findUnique({
      where: { tokenHash: hashToken(dto.token) },
    });
    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.acceptedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Invalid or expired invitation');
    }

    const email = invitation.email.toLowerCase();
    const phone = dto.phone ?? invitation.phone;
    if (!phone) {
      throw new BadRequestException('Phone is required to accept invitation');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.prisma.$transaction(async (tx) => {
      let existing = await tx.user.findFirst({
        where: { OR: [{ email }, { phone }] },
      });

      if (existing) {
        existing = await tx.user.update({
          where: { id: existing.id },
          data: {
            email,
            phone,
            firstName: dto.firstName ?? existing.firstName,
            lastName: dto.lastName ?? existing.lastName,
            mfaRequired: true,
            mustResetPassword: false,
            emailVerified: true,
            status: 'PENDING',
            authzVersion: { increment: 1 },
          },
        });
      } else {
        existing = await tx.user.create({
          data: {
            email,
            phone,
            firstName: dto.firstName ?? null,
            lastName: dto.lastName ?? null,
            mfaRequired: true,
            mustResetPassword: false,
            emailVerified: true,
            phoneVerified: true,
            status: 'PENDING',
          },
        });
      }

      await tx.credential.upsert({
        where: { userId: existing.id },
        create: {
          userId: existing.id,
          passwordHash,
          passwordChangedAt: new Date(),
        },
        update: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      const roles = await tx.role.findMany({
        where: { code: { in: invitation.roleCodes } },
      });
      for (const role of roles) {
        await tx.userRole.upsert({
          where: {
            userId_roleId: { userId: existing.id, roleId: role.id },
          },
          create: {
            userId: existing.id,
            roleId: role.id,
            assignedBy: invitation.invitedBy,
          },
          update: {},
        });
      }

      await tx.adminInvitation.update({
        where: { id: invitation.id },
        data: { invitedUserId: existing.id },
      });

      return existing;
    });

    const enrollmentToken = this.issueEnrollmentToken(user.id, invitation.id);

    await this.audit.appendEvent({
      actorUserId: user.id,
      action: 'identity.invitation.accept',
      targetType: 'admin_invitation',
      targetId: invitation.id,
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return {
      enrollmentToken,
      userId: user.id,
      email: user.email,
      mfaEnrollmentRequired: true,
    };
  }

  /**
   * Exchange a raw invitation token for a Nest-signed enrollment JWT.
   * Bootstrap must not sign JWTs itself — only this JwtService can issue tokens
   * that verifyEnrollToken will accept with the runtime secret.
   */
  async beginEnrollmentSession(
    dto: { token: string },
    meta: RequestMeta = {},
  ) {
    try {
      const invitation = await this.prisma.adminInvitation.findUnique({
        where: { tokenHash: hashToken(dto.token) },
      });
      if (
        !invitation ||
        invitation.revokedAt ||
        invitation.acceptedAt ||
        invitation.expiresAt <= new Date()
      ) {
        throw new BadRequestException('Invalid or expired invitation');
      }
      if (!invitation.invitedUserId) {
        throw new BadRequestException(
          'Invitation has no user yet; accept the invitation first',
        );
      }

      const user = await this.prisma.user.findUnique({
        where: { id: invitation.invitedUserId },
        include: {
          mfaFactors: {
            where: {
              type: 'TOTP',
              verifiedAt: { not: null },
              disabledAt: null,
            },
          },
        },
      });
      if (!user) {
        throw new BadRequestException('Invitation user not found');
      }
      if (user.mfaFactors.length > 0) {
        throw new BadRequestException(
          'MFA is already enrolled for this account',
        );
      }

      const enrollmentToken = this.issueEnrollmentToken(
        user.id,
        invitation.id,
      );

      await this.audit.appendEvent({
        actorUserId: user.id,
        action: 'admin.mfa.enroll.session',
        targetType: 'admin_invitation',
        targetId: invitation.id,
        outcome: 'SUCCESS',
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });

      return {
        enrollmentToken,
        userId: user.id,
        email: user.email,
        mfaEnrollmentRequired: true,
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      this.logger.error(
        `beginEnrollmentSession failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }

  async enrollTotp(dto: EnrollTotpDto) {
    const payload = this.verifyEnrollToken(dto.enrollmentToken);
    const secret = authenticator.generateSecret();
    const encrypted = encryptAesGcm(secret, this.mfaKey);
    const label = dto.label ?? 'Authenticator';

    const pending = await this.prisma.mfaFactor.findFirst({
      where: {
        userId: payload.sub,
        type: 'TOTP',
        disabledAt: null,
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    let factor;
    try {
      if (pending) {
        // Retry-safe: rotate secret on an existing unverified factor
        // instead of hitting the unique (user_id, type) index.
        factor = await this.prisma.mfaFactor.update({
          where: { id: pending.id },
          data: { secretEncrypted: encrypted, label },
        });
      } else {
        factor = await this.prisma.mfaFactor.create({
          data: {
            userId: payload.sub,
            type: 'TOTP',
            label,
            secretEncrypted: encrypted,
          },
        });
      }
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: unknown }).code)
          : undefined;
      this.logger.error(
        `enrollTotp factor persist failed${code ? ` [${code}]` : ''}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
      if (code === 'P2002') {
        throw new BadRequestException('MFA is already enrolled for this account');
      }
      throw err;
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
    });

    const otpauthUrl = authenticator.keyuri(
      user.email ?? user.phone,
      'Nahu Admin',
      secret,
    );

    return {
      factorId: factor.id,
      otpauthUrl,
    };
  }
  
  async confirmTotp(dto: ConfirmTotpDto, meta: RequestMeta = {}) {
    const payload = this.verifyEnrollToken(dto.enrollmentToken);
    const factor = await this.prisma.mfaFactor.findFirst({
      where: {
        userId: payload.sub,
        type: 'TOTP',
        disabledAt: null,
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!factor) {
      throw new BadRequestException('No pending TOTP enrollment');
    }

    const secret = decryptAesGcm(factor.secretEncrypted, this.mfaKey);
    if (!authenticator.check(dto.totpCode, secret)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const recoveryPlain = Array.from({ length: 10 }, () =>
      randomBytes(5).toString('hex'),
    );
    const recoveryHashes = await Promise.all(
      recoveryPlain.map((code) => argon2.hash(code, { type: argon2.argon2id })),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.mfaFactor.update({
        where: { id: factor.id },
        data: { verifiedAt: new Date() },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: payload.sub } });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryHashes.map((codeHash) => ({
          userId: payload.sub,
          codeHash,
        })),
      });
      await tx.user.update({
        where: { id: payload.sub },
        data: { status: 'ACTIVE', mfaRequired: true },
      });
      await tx.adminInvitation.update({
        where: { id: payload.invitationId },
        data: { acceptedAt: new Date() },
      });
    });

    await this.audit.appendEvent({
      actorUserId: payload.sub,
      action: 'admin.mfa.enroll.confirm',
      targetType: 'user',
      targetId: payload.sub,
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return {
      verified: true,
      recoveryCodes: recoveryPlain,
    };
  }

  async login(dto: AdminLoginDto, meta: RequestMeta = {}) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        credential: true,
        userRoles: { include: { role: true } },
        mfaFactors: {
          where: { type: 'TOTP', verifiedAt: { not: null }, disabledAt: null },
        },
      },
    });

    if (!user || !user.credential?.passwordHash) {
      await this.audit.appendEvent({
        action: 'admin.login.failure',
        outcome: 'FAILED',
        metadataJson: { email },
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (
      user.credential.lockedUntil &&
      user.credential.lockedUntil > new Date()
    ) {
      throw new ForbiddenException('Account temporarily locked');
    }

    const valid = await argon2.verify(
      user.credential.passwordHash,
      dto.password,
    );
    if (!valid) {
      await this.recordFailedLogin(user.id, user.credential.failedLoginAttempts);
      await this.audit.appendEvent({
        actorUserId: user.id,
        action: 'admin.login.failure',
        outcome: 'FAILED',
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE' && user.status !== 'PENDING') {
      throw new ForbiddenException('Account is not eligible to sign in');
    }

    if (user.mfaFactors.length === 0) {
      throw new ForbiddenException(
        'MFA enrollment required before login; complete invitation enrollment',
      );
    }

    await this.prisma.credential.update({
      where: { userId: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const mfaToken = this.jwt.sign(
      { sub: user.id, typ: ADMIN_MFA_TYP } satisfies AdminMfaJwtPayload,
      { expiresIn: '5m' },
    );

    return {
      mfaRequired: true,
      mfaToken,
    };
  }

  async verifyMfa(dto: VerifyMfaDto, meta: RequestMeta = {}) {
    let payload: AdminMfaJwtPayload;
    try {
      payload = this.jwt.verify<AdminMfaJwtPayload>(dto.mfaToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }
    if (payload.typ !== ADMIN_MFA_TYP || !payload.sub) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        mfaFactors: {
          where: { type: 'TOTP', verifiedAt: { not: null }, disabledAt: null },
        },
        mfaRecoveryCodes: { where: { usedAt: null } },
        credential: true,
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not eligible');
    }

    let verified = false;
    if (dto.totpCode && user.mfaFactors[0]) {
      const secret = decryptAesGcm(
        user.mfaFactors[0].secretEncrypted,
        this.mfaKey,
      );
      verified = authenticator.check(dto.totpCode, secret);
    } else if (dto.recoveryCode) {
      for (const row of user.mfaRecoveryCodes) {
        if (await argon2.verify(row.codeHash, dto.recoveryCode)) {
          await this.prisma.mfaRecoveryCode.update({
            where: { id: row.id },
            data: { usedAt: new Date() },
          });
          verified = true;
          break;
        }
      }
    } else {
      throw new BadRequestException('totpCode or recoveryCode is required');
    }

    if (!verified) {
      await this.audit.appendEvent({
        actorUserId: user.id,
        action: 'admin.login.mfa.failure',
        outcome: 'FAILED',
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
      throw new UnauthorizedException('Invalid MFA code');
    }

    const tokens = await this.createSession(user.id, user.authzVersion, meta);

    await this.prisma.credential.update({
      where: { userId: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0 },
    });

    await this.audit.appendEvent({
      actorUserId: user.id,
      actorSessionId: tokens.sessionId,
      action: 'admin.login.success',
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.accessTtl(),
      tokenType: 'Bearer',
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta = {}) {
    const presentedHash = hashToken(refreshToken);
    const anyWithHash = await this.prisma.adminSession.findFirst({
      where: { refreshTokenHash: presentedHash },
      orderBy: { createdAt: 'desc' },
    });

    const classification = classifyRefreshPresentation({
      activeSession:
        anyWithHash && !anyWithHash.revokedAt
          ? {
              id: anyWithHash.id,
              userId: anyWithHash.userId,
              revokedAt: anyWithHash.revokedAt,
            }
          : null,
      priorRotatedSession:
        anyWithHash && anyWithHash.revokedAt
          ? { id: anyWithHash.id, userId: anyWithHash.userId }
          : null,
    });

    if (classification.kind === 'reuse') {
      await this.revokeSessionFamily(classification.userId, 'refresh_reuse');
      await this.audit.appendEvent({
        actorUserId: classification.userId,
        action: 'admin.session.refresh_reuse',
        outcome: 'DENIED',
        targetType: 'user',
        targetId: classification.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
      throw new UnauthorizedException(
        'Refresh token reuse detected; all sessions revoked',
      );
    }

    if (classification.kind === 'miss' || !anyWithHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const active = anyWithHash;
    const now = new Date();
    if (active.absoluteExpiresAt <= now || active.idleExpiresAt <= now) {
      throw new UnauthorizedException('Refresh session expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: active.userId },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not eligible');
    }

    const newRefresh = generateOpaqueToken(32);
    const newSession = await this.prisma.$transaction(async (tx) => {
      const created = await tx.adminSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: hashToken(newRefresh),
          authzVersionAtIssue: user.authzVersion,
          ip: meta.ip?.slice(0, 64),
          userAgent: meta.userAgent?.slice(0, 512),
          absoluteExpiresAt: active.absoluteExpiresAt,
          idleExpiresAt: new Date(now.getTime() + this.refreshIdleMs()),
          reauthenticatedAt: active.reauthenticatedAt,
        },
      });
      await tx.adminSession.update({
        where: { id: active.id },
        data: {
          revokedAt: now,
          revokeReason: 'rotated',
          replacedBySessionId: created.id,
        },
      });
      return created;
    });

    const accessToken = this.signAccessToken(
      user.id,
      newSession.id,
      user.authzVersion,
    );

    return {
      accessToken,
      refreshToken: newRefresh,
      expiresIn: this.accessTtl(),
      tokenType: 'Bearer',
    };
  }

  async logout(admin: AdminRequestUser, meta: RequestMeta = {}) {
    await this.prisma.adminSession.update({
      where: { id: admin.sessionId },
      data: { revokedAt: new Date(), revokeReason: 'logout' },
    });
    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      action: 'admin.logout',
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
    return { revoked: true };
  }

  async logoutAll(
    admin: AdminRequestUser,
    dto: LogoutAllDto,
    meta: RequestMeta = {},
  ) {
    const targetUserId = dto.targetUserId ?? admin.userId;
    if (
      targetUserId !== admin.userId &&
      !admin.permissions.includes('identity.sessions.revoke')
    ) {
      throw new ForbiddenException('Missing identity.sessions.revoke');
    }

    await this.prisma.adminSession.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokeReason: dto.reason ?? 'logout_all',
      },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode:
        targetUserId !== admin.userId
          ? 'identity.sessions.revoke'
          : undefined,
      action: 'admin.logout_all',
      targetType: 'user',
      targetId: targetUserId,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return { revoked: true, userId: targetUserId };
  }

  async me(admin: AdminRequestUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: admin.userId },
      include: {
        userRoles: { include: { role: true } },
      },
    });
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles: resolveRoleCodes(user.userRoles),
      authzVersion: user.authzVersion,
      mfaRequired: user.mfaRequired,
      mustResetPassword: user.mustResetPassword,
    };
  }

  async capabilities(admin: AdminRequestUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: admin.userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    return {
      roles: resolveRoleCodes(user.userRoles),
      permissions: resolvePermissionCodes(user.userRoles),
    };
  }

  private issueEnrollmentToken(userId: string, invitationId: string): string {
    return this.jwt.sign(
      {
        sub: userId,
        invitationId,
        typ: ADMIN_ENROLL_TYP,
      } satisfies AdminEnrollJwtPayload,
      { expiresIn: '1h' },
    );
  }

  private verifyEnrollToken(token: string): AdminEnrollJwtPayload {
    let payload: AdminEnrollJwtPayload;

    try {
      payload = this.jwt.verify<AdminEnrollJwtPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch (err) {
      this.logger.warn(
        `Enrollment JWT verification failed: ${
          err instanceof Error ? err.message : 'Unknown JWT verification error'
        }`,
      );

      throw new UnauthorizedException(
        'Invalid or expired enrollment token',
      );
    }

    if (
      payload.typ !== ADMIN_ENROLL_TYP ||
      !payload.sub ||
      !payload.invitationId
    ) {
      throw new UnauthorizedException(
        'Invalid enrollment token',
      );
    }

    return payload;
  }

  private async assertRecentReauth(
    admin: AdminRequestUser,
    password: string,
  ): Promise<void> {
    const windowMs =
      (this.config.get<number>('adminAuth.reauthWindowMinutes') ?? 5) *
      60 *
      1000;
    const recent =
      admin.reauthenticatedAt &&
      Date.now() - admin.reauthenticatedAt.getTime() < windowMs;

    const credential = await this.prisma.credential.findUnique({
      where: { userId: admin.userId },
    });
    if (!credential?.passwordHash) {
      throw new ForbiddenException('Password re-authentication required');
    }
    const ok = await argon2.verify(credential.passwordHash, password);
    if (!ok) {
      throw new ForbiddenException('Password re-authentication failed');
    }

    if (!recent) {
      await this.prisma.adminSession.update({
        where: { id: admin.sessionId },
        data: { reauthenticatedAt: new Date() },
      });
    }
  }

  private async recordFailedLogin(
    userId: string,
    currentAttempts: number,
  ): Promise<void> {
    const next = currentAttempts + 1;
    const data: {
      failedLoginAttempts: number;
      lockedUntil?: Date;
    } = { failedLoginAttempts: next };
    if (next >= this.failedLoginMax()) {
      data.lockedUntil = new Date(Date.now() + this.failedLoginWindowMs());
      data.failedLoginAttempts = 0;
    }
    await this.prisma.credential.update({
      where: { userId },
      data,
    });
  }

  private async createSession(
    userId: string,
    authzVersion: number,
    meta: RequestMeta,
  ) {
    const refreshToken = generateOpaqueToken(32);
    const now = new Date();
    const session = await this.prisma.adminSession.create({
      data: {
        userId,
        refreshTokenHash: hashToken(refreshToken),
        authzVersionAtIssue: authzVersion,
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 512),
        absoluteExpiresAt: new Date(now.getTime() + this.refreshAbsoluteMs()),
        idleExpiresAt: new Date(now.getTime() + this.refreshIdleMs()),
      },
    });
    const accessToken = this.signAccessToken(userId, session.id, authzVersion);
    return { accessToken, refreshToken, sessionId: session.id };
  }

  private signAccessToken(
    userId: string,
    sessionId: string,
    authzVersion: number,
  ): string {
    return this.jwt.sign(
      {
        sub: userId,
        sid: sessionId,
        authzVersion,
        typ: ADMIN_ACCESS_TYP,
      } satisfies AdminAccessJwtPayload,
      { expiresIn: this.accessTtl() },
    );
  }

  private async revokeSessionFamily(
    userId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }
}
