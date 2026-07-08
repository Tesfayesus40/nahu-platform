import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../jwt-payload.interface';

export const ROLES_KEY = 'roles';
/** Usage: @Roles('ADMIN') or @Roles('FARMER', 'ADMIN') above a route, alongside @UseGuards(JwtAuthGuard, RolesGuard). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Equivalent to nahu-buna-gebaya's middleware/auth.js requireRole.
 * Must run after JwtAuthGuard, which is what populates request.user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }
}
