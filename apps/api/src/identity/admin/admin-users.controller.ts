import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminUsersService } from './admin-users.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../../common/admin/admin-request.types';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { PrivilegedUserActionDto } from './dto/privileged-user-action.dto';

@Controller('admin/users')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get()
  @RequirePermissions('identity.users.read')
  list(@Query() query: ListUsersQueryDto) {
    return this.users.listUsers(query);
  }

  @Get(':id')
  @RequirePermissions('identity.users.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getUser(id);
  }

  @Patch(':id/status')
  @RequirePermissions('identity.users.status.write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  updateStatus(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ) {
    return this.users.updateStatus(admin, id, dto, this.meta(req));
  }

  @Put(':id/roles')
  @RequirePermissions('identity.roles.assign')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  updateRoles(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRolesDto,
    @Req() req: Request,
  ) {
    return this.users.updateRoles(admin, id, dto, this.meta(req));
  }

  @Post(':id/mfa/reset')
  @RequirePermissions('identity.users.mfa.reset')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resetMfa(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrivilegedUserActionDto,
    @Req() req: Request,
  ) {
    return this.users.resetMfa(admin, id, dto, this.meta(req));
  }

  @Post(':id/password/reset')
  @RequirePermissions('identity.users.password.reset')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resetPassword(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrivilegedUserActionDto,
    @Req() req: Request,
  ) {
    return this.users.resetPassword(admin, id, dto, this.meta(req));
  }

  @Post(':id/sessions/revoke')
  @RequirePermissions('identity.sessions.revoke')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  revokeSessions(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrivilegedUserActionDto,
    @Req() req: Request,
  ) {
    return this.users.revokeSessions(admin, id, dto, this.meta(req));
  }
}

@Controller('admin/roles')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminRolesController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @RequirePermissions('identity.roles.read')
  list() {
    return this.users.listRoles();
  }
}
