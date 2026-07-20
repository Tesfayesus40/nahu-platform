import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminRequestUser } from '../admin/admin-request.types';

/** Usage: me(@CurrentAdmin() admin: AdminRequestUser) with AdminAuthGuard. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminRequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.admin as AdminRequestUser;
  },
);
