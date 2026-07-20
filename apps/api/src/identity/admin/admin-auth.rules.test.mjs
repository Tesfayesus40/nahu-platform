import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/identity/admin/admin-auth.rules.ts */

const WORKFORCE_ROLE_CODES = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'AUDITOR'];
const INVITABLE_ROLE_CODES = ['PLATFORM_ADMIN', 'AUDITOR'];

function resolvePermissionCodes(userRoles) {
  const set = new Set();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      set.add(rp.permission.code);
    }
  }
  return [...set].sort();
}

function hasWorkforceRole(roleCodes) {
  return roleCodes.some((code) => WORKFORCE_ROLE_CODES.includes(code));
}

function isWorkforceBlockedFromOtp({ roleCodes, mfaRequired }) {
  return mfaRequired || hasWorkforceRole(roleCodes);
}

function authzVersionMatches(tokenVersion, currentVersion) {
  return tokenVersion === currentVersion;
}

function classifyRefreshPresentation({ activeSession, priorRotatedSession }) {
  if (activeSession && !activeSession.revokedAt) {
    return {
      kind: 'active',
      sessionId: activeSession.id,
      userId: activeSession.userId,
    };
  }
  if (priorRotatedSession) {
    return {
      kind: 'reuse',
      userId: priorRotatedSession.userId,
      familyRootSessionId: priorRotatedSession.id,
    };
  }
  return { kind: 'miss' };
}

function hasAllPermissions(held, required) {
  if (required.length === 0) return true;
  const set = new Set(held);
  return required.every((code) => set.has(code));
}

function filterInvitableRoleCodes(roleCodes) {
  const allowed = new Set(INVITABLE_ROLE_CODES);
  return roleCodes.filter((code) => allowed.has(code));
}

describe('resolvePermissionCodes', () => {
  it('unions permissions across roles', () => {
    const codes = resolvePermissionCodes([
      {
        role: {
          code: 'AUDITOR',
          rolePermissions: [
            { permission: { code: 'audit.read' } },
            { permission: { code: 'admin.dashboard.read' } },
          ],
        },
      },
      {
        role: {
          code: 'PLATFORM_ADMIN',
          rolePermissions: [
            { permission: { code: 'audit.read' } },
            { permission: { code: 'identity.users.invite' } },
          ],
        },
      },
    ]);
    assert.deepEqual(codes, [
      'admin.dashboard.read',
      'audit.read',
      'identity.users.invite',
    ]);
  });
});

describe('authzVersionMatches', () => {
  it('accepts equal versions and rejects mismatch', () => {
    assert.equal(authzVersionMatches(3, 3), true);
    assert.equal(authzVersionMatches(2, 3), false);
  });
});

describe('classifyRefreshPresentation', () => {
  it('returns active for current unrevoked session', () => {
    const result = classifyRefreshPresentation({
      activeSession: { id: 's1', userId: 'u1', revokedAt: null },
      priorRotatedSession: null,
    });
    assert.equal(result.kind, 'active');
    assert.equal(result.sessionId, 's1');
  });

  it('detects reuse of rotated refresh hash', () => {
    const result = classifyRefreshPresentation({
      activeSession: null,
      priorRotatedSession: { id: 's-old', userId: 'u1' },
    });
    assert.equal(result.kind, 'reuse');
    assert.equal(result.userId, 'u1');
  });

  it('returns miss when hash unknown', () => {
    assert.equal(
      classifyRefreshPresentation({
        activeSession: null,
        priorRotatedSession: null,
      }).kind,
      'miss',
    );
  });
});

describe('OTP workforce block', () => {
  it('blocks SUPER_ADMIN / PLATFORM_ADMIN / AUDITOR and mfaRequired', () => {
    assert.equal(
      isWorkforceBlockedFromOtp({
        roleCodes: ['SUPER_ADMIN'],
        mfaRequired: false,
      }),
      true,
    );
    assert.equal(
      isWorkforceBlockedFromOtp({
        roleCodes: ['FARMER'],
        mfaRequired: true,
      }),
      true,
    );
    assert.equal(
      isWorkforceBlockedFromOtp({
        roleCodes: ['FARMER', 'BUYER'],
        mfaRequired: false,
      }),
      false,
    );
  });
});

describe('permissions AND check', () => {
  it('requires all codes', () => {
    assert.equal(
      hasAllPermissions(['a', 'b'], ['a', 'b']),
      true,
    );
    assert.equal(hasAllPermissions(['a'], ['a', 'b']), false);
  });
});

describe('filterInvitableRoleCodes', () => {
  it('strips SUPER_ADMIN from ordinary invites', () => {
    assert.deepEqual(
      filterInvitableRoleCodes(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'AUDITOR']),
      ['PLATFORM_ADMIN', 'AUDITOR'],
    );
  });
});
