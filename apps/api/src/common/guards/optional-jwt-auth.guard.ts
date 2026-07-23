import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../jwt-payload.interface';

/**
 * Attaches request.user when a valid Bearer token is present.
 * Does not reject anonymous requests (used for public routes with
 * owner-aware visibility, e.g. listing detail).
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;

    if (!header?.startsWith('Bearer ')) {
      return true;
    }

    const token = header.slice('Bearer '.length);
    try {
      request.user = this.jwtService.verify<JwtPayload>(token);
    } catch {
      // Treat invalid tokens as anonymous for public read paths.
      request.user = undefined;
    }
    return true;
  }
}
