import { Request } from 'express';

export type AdminRequestMeta = {
  ip?: string;
  userAgent?: string;
  requestId?: string;
};

/** Shared request metadata for admin audit events. */
export function adminRequestMeta(req: Request): AdminRequestMeta {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string | undefined,
  };
}
