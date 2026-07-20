// Response shapes mirrored from the Nest A1 admin services.

export type MeResponse = {
  id: string;
  email: string | null;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  roles: string[];
  authzVersion: number;
  mfaRequired: boolean;
  mustResetPassword: boolean;
};

export type CapabilitiesResponse = {
  roles: string[];
  permissions: string[];
};

export type DashboardSummaryResponse = {
  status: string;
  message: string;
  placeholders: {
    pendingVerifications: number | null;
    openDisputes: number | null;
    activeListings: number | null;
  };
};

export type SystemHealthResponse = {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
  dependencies: { database: "up" | "down" };
};

export type AuditEvent = {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorSessionId: string | null;
  permissionCode: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  requestId: string | null;
  reason: string | null;
  outcome: "SUCCESS" | "FAILED" | "DENIED";
  ip: string | null;
  userAgent: string | null;
};

export type AuditEventsResponse = {
  page: number;
  limit: number;
  total: number;
  items: AuditEvent[];
};
