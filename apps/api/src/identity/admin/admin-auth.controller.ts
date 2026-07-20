import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../../common/admin/admin-request.types';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { EnrollTotpDto, ConfirmTotpDto } from './dto/enroll-totp.dto';
import { LogoutAllDto } from './dto/logout-all.dto';
import { BeginEnrollmentSessionDto } from './dto/begin-enrollment-session.dto';

@Controller('admin/auth')
@UseGuards(ThrottlerGuard)
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.adminAuth.login(dto, this.meta(req));
  }

  @Post('mfa/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyMfa(@Body() dto: VerifyMfaDto, @Req() req: Request) {
    return this.adminAuth.verifyMfa(dto, this.meta(req));
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshSessionDto, @Req() req: Request) {
    return this.adminAuth.refresh(dto.refreshToken, this.meta(req));
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard)
  logout(@CurrentAdmin() admin: AdminRequestUser, @Req() req: Request) {
    return this.adminAuth.logout(admin, this.meta(req));
  }

  @Post('logout-all')
  @UseGuards(AdminAuthGuard, PermissionsGuard)
  logoutAll(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: LogoutAllDto,
    @Req() req: Request,
  ) {
    return this.adminAuth.logoutAll(admin, dto, this.meta(req));
  }

  @Post('invitations')
  @UseGuards(AdminAuthGuard, PermissionsGuard)
  @RequirePermissions('identity.users.invite')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createInvitation(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: CreateInvitationDto,
    @Req() req: Request,
  ) {
    return this.adminAuth.createInvitation(admin, dto, this.meta(req));
  }

  @Post('invitations/accept')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  acceptInvitation(@Body() dto: AcceptInvitationDto, @Req() req: Request) {
    return this.adminAuth.acceptInvitation(dto, this.meta(req));
  }

  @Post('invitations/enrollment-session')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  beginEnrollmentSession(
    @Body() dto: BeginEnrollmentSessionDto,
    @Req() req: Request,
  ) {
    return this.adminAuth.beginEnrollmentSession(dto, this.meta(req));
  }

  @Post('mfa/enroll/totp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  enrollTotp(@Body() dto: EnrollTotpDto) {
    return this.adminAuth.enrollTotp(dto);
  }

  @Post('mfa/enroll/totp/confirm')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirmTotp(@Body() dto: ConfirmTotpDto, @Req() req: Request) {
    return this.adminAuth.confirmTotp(dto, this.meta(req));
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@CurrentAdmin() admin: AdminRequestUser) {
    return this.adminAuth.me(admin);
  }

  @Get('capabilities')
  @UseGuards(AdminAuthGuard)
  capabilities(@CurrentAdmin() admin: AdminRequestUser) {
    return this.adminAuth.capabilities(admin);
  }
}
