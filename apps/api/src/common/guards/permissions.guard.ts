import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_ANY_PERMISSIONS_KEY,
  REQUIRE_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';
import { AdminRequestUser } from '../admin/admin-request.types';
import {
  hasAllPermissions,
  hasAnyPermission,
} from '../../identity/admin/admin-auth.rules';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAll = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAny = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const hasAllMeta = Boolean(requiredAll?.length);
    const hasAnyMeta = Boolean(requiredAny?.length);

    // When PermissionsGuard is attached without metadata, deny rather than
    // silently allowing (avoids accidental open privileged routes).
    if (!hasAllMeta && !hasAnyMeta) {
      throw new ForbiddenException('Missing required permission');
    }

    const request = context.switchToHttp().getRequest();
    const admin = request.admin as AdminRequestUser | undefined;

    if (!admin) {
      throw new ForbiddenException('Missing required permission');
    }

    if (hasAllMeta && !hasAllPermissions(admin.permissions, requiredAll!)) {
      throw new ForbiddenException('Missing required permission');
    }

    if (hasAnyMeta && !hasAnyPermission(admin.permissions, requiredAny!)) {
      throw new ForbiddenException('Missing required permission');
    }

    return true;
  }
}
