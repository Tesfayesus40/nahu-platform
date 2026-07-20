import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ADMIN_ACCESS_TYP,
  AdminAccessJwtPayload,
  AdminRequestUser,
} from '../admin/admin-request.types';
import {
  authzVersionMatches,
  resolvePermissionCodes,
  resolveRoleCodes,
} from '../../identity/admin/admin-auth.rules';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No admin token provided');
    }

    const token = header.slice('Bearer '.length);
    let payload: AdminAccessJwtPayload;
    try {
      payload = this.jwtService.verify<AdminAccessJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    if (payload.typ !== ADMIN_ACCESS_TYP || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid admin access token');
    }

    const now = new Date();
    const session = await this.prisma.adminSession.findUnique({
      where: { id: payload.sid },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Admin session not found');
    }
    if (session.revokedAt) {
      throw new UnauthorizedException('Admin session revoked');
    }
    if (session.absoluteExpiresAt <= now || session.idleExpiresAt <= now) {
      throw new UnauthorizedException('Admin session expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Admin user not found');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Admin user is not active');
    }
    if (!authzVersionMatches(payload.authzVersion, user.authzVersion)) {
      throw new UnauthorizedException(
        'Authorization changed; please sign in again',
      );
    }

    const admin: AdminRequestUser = {
      userId: user.id,
      sessionId: session.id,
      authzVersion: user.authzVersion,
      email: user.email,
      phone: user.phone,
      roles: resolveRoleCodes(user.userRoles),
      permissions: resolvePermissionCodes(user.userRoles),
      reauthenticatedAt: session.reauthenticatedAt,
    };

    request.admin = admin;
    return true;
  }
}
