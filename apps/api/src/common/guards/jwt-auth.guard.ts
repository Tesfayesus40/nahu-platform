import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../jwt-payload.interface';

/**
 * Equivalent to nahu-buna-gebaya's middleware/auth.js requireAuth.
 * Verifies the Bearer token and attaches the decoded payload to
 * request.user for downstream handlers / the @CurrentUser() decorator.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = header.slice('Bearer '.length);

    try {
      request.user = this.jwtService.verify<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
