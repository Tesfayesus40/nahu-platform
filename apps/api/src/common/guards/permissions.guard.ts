import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AdminRequestUser } from '../admin/admin-request.types';
import { hasAllPermissions } from '../../identity/admin/admin-auth.rules';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const admin = request.admin as AdminRequestUser | undefined;

    if (!admin || !hasAllPermissions(admin.permissions, required)) {
      throw new ForbiddenException('Missing required permission');
    }

    return true;
  }
}
