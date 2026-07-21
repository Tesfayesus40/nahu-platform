export const WORKFORCE_ROLE_CODES = [
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'AUDITOR',
] as const;

export const INVITABLE_ROLE_CODES = ['PLATFORM_ADMIN', 'AUDITOR'] as const;

export type RolePermissionSource = {
  role: {
    code: string;
    rolePermissions: Array<{ permission: { code: string } }>;
  };
};

/** Union of permission codes across all assigned roles. */
export function resolvePermissionCodes(
  userRoles: RolePermissionSource[],
): string[] {
  const set = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      set.add(rp.permission.code);
    }
  }
  return [...set].sort();
}

export function resolveRoleCodes(userRoles: Array<{ role: { code: string } }>): string[] {
  return userRoles.map((ur) => ur.role.code).sort();
}

export function hasWorkforceRole(roleCodes: string[]): boolean {
  return roleCodes.some((code) =>
    (WORKFORCE_ROLE_CODES as readonly string[]).includes(code),
  );
}

export function isWorkforceBlockedFromOtp(input: {
  roleCodes: string[];
  mfaRequired: boolean;
}): boolean {
  return input.mfaRequired || hasWorkforceRole(input.roleCodes);
}

export function authzVersionMatches(
  tokenVersion: number,
  currentVersion: number,
): boolean {
  return tokenVersion === currentVersion;
}

export type RefreshLookupResult =
  | { kind: 'active'; sessionId: string; userId: string }
  | { kind: 'reuse'; userId: string; familyRootSessionId: string }
  | { kind: 'miss' };

/**
 * Given a presented refresh hash, decide rotation vs reuse.
 * `activeByHash` is the session currently holding that hash.
 * `replacedSessions` are sessions whose refresh was rotated away (hash no longer current)
 * but that once had this hash — reuse of an old hash.
 */
export function classifyRefreshPresentation(input: {
  activeSession: { id: string; userId: string; revokedAt: Date | null } | null;
  priorRotatedSession: { id: string; userId: string } | null;
}): RefreshLookupResult {
  if (input.activeSession && !input.activeSession.revokedAt) {
    return {
      kind: 'active',
      sessionId: input.activeSession.id,
      userId: input.activeSession.userId,
    };
  }
  if (input.priorRotatedSession) {
    return {
      kind: 'reuse',
      userId: input.priorRotatedSession.userId,
      familyRootSessionId: input.priorRotatedSession.id,
    };
  }
  return { kind: 'miss' };
}

export function hasAllPermissions(
  held: string[],
  required: string[],
): boolean {
  if (required.length === 0) {
    return true;
  }
  const set = new Set(held);
  return required.every((code) => set.has(code));
}

export function filterInvitableRoleCodes(roleCodes: string[]): string[] {
  const allowed = new Set<string>(INVITABLE_ROLE_CODES);
  return roleCodes.filter((code) => allowed.has(code));
}

/** True when the actor must not operate on their own account. */
export function isSelfTarget(actorUserId: string, targetUserId: string): boolean {
  return actorUserId === targetUserId;
}

/**
 * Replace only invitable workforce roles (PLATFORM_ADMIN / AUDITOR).
 * Preserve SUPER_ADMIN and non-workforce roles (FARMER, BUYER, …).
 */
export function mergeAssignableWorkforceRoles(
  currentRoleCodes: string[],
  requestedAssignable: string[],
): string[] {
  const nextAssignable = filterInvitableRoleCodes(requestedAssignable);
  const invitable = new Set<string>(INVITABLE_ROLE_CODES);
  const preserved = currentRoleCodes.filter((code) => !invitable.has(code));
  return [...new Set([...preserved, ...nextAssignable])].sort();
}

/** Block status/authz demotion when this would remove the last active SUPER_ADMIN. */
export function wouldRemoveLastActiveSuperAdmin(input: {
  targetHasSuperAdmin: boolean;
  otherActiveSuperAdminCount: number;
}): boolean {
  return (
    input.targetHasSuperAdmin && input.otherActiveSuperAdminCount === 0
  );
}

/** Workforce security actions (MFA / password / role assign) apply to these users. */
export function isWorkforceCapableUser(input: {
  roleCodes: string[];
  mfaRequired: boolean;
  hasPassword: boolean;
  hasMfaFactors?: boolean;
}): boolean {
  return (
    input.mfaRequired ||
    hasWorkforceRole(input.roleCodes) ||
    input.hasPassword ||
    Boolean(input.hasMfaFactors)
  );
}
