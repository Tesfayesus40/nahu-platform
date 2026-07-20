import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms/sms.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { isWorkforceBlockedFromOtp } from './admin/admin-auth.rules';

// Dev/staging-only universal OTP, gated behind nodeEnv below — same
// approach as the original auth.service.js, so any phone can be tested
// locally without SMS ever sending, but this is never accepted in production.
const DEV_OTP = '123456';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
  ) {}

  private get isProduction(): boolean {
    return this.config.get<string>('nodeEnv') === 'production';
  }

  private get devOtpEnabled(): boolean {
    return !this.isProduction || this.config.get<boolean>('otp.devBypassEnabled') === true;
  }

  /** Workforce / MFA-required users must use admin password+TOTP, never OTP. */
  private async assertNotWorkforceOtp(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) {
      return;
    }
    const roleCodes = user.userRoles.map((ur) => ur.role.code);
    if (
      isWorkforceBlockedFromOtp({
        roleCodes,
        mfaRequired: user.mfaRequired,
      })
    ) {
      throw new ForbiddenException(
        'Workforce accounts cannot authenticate via OTP; use the Admin Portal login',
      );
    }
  }

  async requestOtp({ phone, role }: RequestOtpDto) {
    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: { userRoles: { include: { role: true } } },
    });

    if (user) {
      const roleCodes = user.userRoles.map((ur) => ur.role.code);
      if (
        isWorkforceBlockedFromOtp({
          roleCodes,
          mfaRequired: user.mfaRequired,
        })
      ) {
        throw new ForbiddenException(
          'Workforce accounts cannot use OTP registration or login',
        );
      }
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, status: 'PENDING' },
        include: { userRoles: { include: { role: true } } },
      });
    }

    // Assign the requested role if the user doesn't already have it.
    // Registration is additive: requesting OTP as BUYER after already
    // being a FARMER adds the BUYER role rather than replacing anything.
    // DTO already restricts role to FARMER|BUYER only.
    const roleRow = await this.prisma.role.findUnique({ where: { code: role } });
    if (!roleRow) {
      throw new NotFoundException(
        `Role "${role}" is not seeded yet — run migration 012_identity_seed_core_roles.sql`,
      );
    }
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleRow.id } },
      create: { userId: user.id, roleId: roleRow.id },
      update: {},
    });

    // Invalidate any previously-issued, still-unused codes for this phone.
    await this.prisma.otpCode.updateMany({
      where: { phone, used: false },
      data: { used: true },
    });

    const code = generateOtp();
    const otpExpiresMinutes = this.config.get<number>('otp.expiresMinutes') ?? 10;
    const expiresAt = new Date(Date.now() + otpExpiresMinutes * 60 * 1000);

    await this.prisma.otpCode.create({
      data: { phone, code, expiresAt },
    });

    try {
      await this.sms.sendOtpSms(phone, code);
    } catch (smsErr) {
      // In production, a failed send means the user has no way to get
      // their code -- surface it as a real error. In dev, keep going: the
      // DEV_OTP fallback below covers it, so a missing/invalid AT sandbox
      // key doesn't block local testing.
      this.logger.error(`SMS send failed for ${phone}: ${(smsErr as Error).message}`);
      if (this.isProduction && !this.devOtpEnabled) {
        throw new ForbiddenException(
          'Could not send verification code. Please try again shortly.',
        );
      }
    }

    if (this.devOtpEnabled) {
      this.logger.debug(`[DEV] OTP for ${phone}: ${code}`);
      return { message: 'OTP sent', dev_otp: code };
    }

    return { message: 'OTP sent' };
  }

  async verifyOtp({ phone, otp, role }: VerifyOtpDto) {
    if (this.devOtpEnabled && otp === DEV_OTP) {
      const user = await this.prisma.user.findUnique({ where: { phone } });
      if (!user) {
        throw new UnauthorizedException('Phone number not registered. Request OTP first.');
      }
      await this.assertNotWorkforceOtp(user.id);
      this.logger.debug(`[DEV] Universal OTP used for ${phone}`);
      return this.issueSession(user.id, phone, role);
    }

    const record = await this.prisma.otpCode.findFirst({
      where: { phone, code: otp, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      // Shouldn't happen — requestOtp always creates the user row first —
      // but fail loudly rather than issuing a token for a phantom account.
      throw new UnauthorizedException('Phone number not registered. Request OTP first.');
    }

    await this.assertNotWorkforceOtp(user.id);

    if (!user.phoneVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true, status: 'ACTIVE' },
      });
    }

    return this.issueSession(user.id, phone, role);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      fathersName: user.middleName,
      lastName: user.lastName,
      email: user.email,
      preferredLanguage: user.preferredLanguage,
      status: user.status,
      phoneVerified: user.phoneVerified,
      roles: user.userRoles.map((ur: { role: { code: string } }) => ur.role.code),
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const data: { firstName?: string | null; middleName?: string | null } = {};
    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName.trim() || null;
    }
    if (dto.fathersName !== undefined) {
      data.middleName = dto.fathersName.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return this.me(userId);
    }

    await this.prisma.user.update({ where: { id: userId }, data });
    return this.me(userId);
  }

  /** Signs a JWT and returns it with a minimal user summary — shared by both DEV_OTP and normal verify paths. */
  private async issueSession(userId: string, phone: string, preferredRole?: string) {
    await this.assertNotWorkforceOtp(userId);

    let roleCode: string | null = null;

    if (preferredRole) {
      const match = await this.prisma.userRole.findFirst({
        where: { userId, role: { code: preferredRole } },
        include: { role: true },
      });
      if (match) {
        roleCode = match.role.code;
      }
    }

    if (!roleCode) {
      const primaryRole = await this.prisma.userRole.findFirst({
        where: { userId },
        include: { role: true },
        orderBy: { assignedAt: 'asc' },
      });
      roleCode = primaryRole?.role.code ?? null;
    }

    const token = this.jwt.sign({ userId, phone, role: roleCode });

    return {
      token,
      user: { id: userId, phone, role: roleCode },
    };
  }
}
