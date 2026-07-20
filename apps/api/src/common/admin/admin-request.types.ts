export const ADMIN_ACCESS_TYP = 'admin_access';
export const ADMIN_MFA_TYP = 'admin_mfa';
export const ADMIN_ENROLL_TYP = 'admin_enroll';

export interface AdminAccessJwtPayload {
  sub: string;
  sid: string;
  authzVersion: number;
  typ: typeof ADMIN_ACCESS_TYP;
}

export interface AdminMfaJwtPayload {
  sub: string;
  typ: typeof ADMIN_MFA_TYP;
}

export interface AdminEnrollJwtPayload {
  sub: string;
  invitationId: string;
  typ: typeof ADMIN_ENROLL_TYP;
}

export interface AdminRequestUser {
  userId: string;
  sessionId: string;
  authzVersion: number;
  email: string | null;
  phone: string;
  roles: string[];
  permissions: string[];
  reauthenticatedAt: Date | null;
}
