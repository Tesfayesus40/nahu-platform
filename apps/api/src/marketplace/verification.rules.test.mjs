import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/marketplace/verification.rules.ts */

const VERIFICATION_SUBJECT_TYPES = [
  'FARMER',
  'BUYER',
  'MERCHANT',
  'ORGANIZATION',
];

const PENDING_VERIFICATION_STATUSES = ['PENDING', 'IN_REVIEW', 'NEEDS_INFO'];

const DECIDE_PERMISSION_BY_SUBJECT = {
  FARMER: 'farmers.verify',
  BUYER: 'buyers.verify',
  MERCHANT: 'marketplace.merchants.verify',
  ORGANIZATION: 'identity.organizations.verify',
};

function decidePermissionForSubject(subjectType) {
  if (VERIFICATION_SUBJECT_TYPES.includes(subjectType)) {
    return DECIDE_PERMISSION_BY_SUBJECT[subjectType];
  }
  return null;
}

function canDecideSubject(heldPermissions, subjectType) {
  const required = decidePermissionForSubject(subjectType);
  return Boolean(required && heldPermissions.includes(required));
}

function canReadVerification(heldPermissions) {
  if (heldPermissions.includes('verification.read')) return true;
  return (
    heldPermissions.includes('farmers.verify') ||
    heldPermissions.includes('buyers.verify') ||
    heldPermissions.includes('marketplace.merchants.verify') ||
    heldPermissions.includes('identity.organizations.verify')
  );
}

function statusAfterDecision(decision, currentStatus) {
  switch (decision) {
    case 'APPROVE':
      return 'APPROVED';
    case 'REJECT':
      return 'REJECTED';
    case 'REQUEST_INFO':
      return 'NEEDS_INFO';
    case 'SUSPEND':
      return 'SUSPENDED';
    case 'START_REVIEW':
      return 'IN_REVIEW';
    case 'NOTE':
      return currentStatus;
    default:
      return currentStatus;
  }
}

function requiresReason(decision) {
  return (
    decision === 'REJECT' ||
    decision === 'REQUEST_INFO' ||
    decision === 'SUSPEND'
  );
}

function isPendingVerificationStatus(status) {
  return PENDING_VERIFICATION_STATUSES.includes(status);
}

describe('decidePermissionForSubject', () => {
  it('maps each subject type to a decide permission', () => {
    assert.equal(decidePermissionForSubject('FARMER'), 'farmers.verify');
    assert.equal(
      decidePermissionForSubject('MERCHANT'),
      'marketplace.merchants.verify',
    );
    assert.equal(decidePermissionForSubject('UNKNOWN'), null);
  });
});

describe('canDecideSubject / canReadVerification', () => {
  it('enforces subject-specific decide permissions', () => {
    assert.equal(canDecideSubject(['farmers.verify'], 'FARMER'), true);
    assert.equal(canDecideSubject(['farmers.verify'], 'BUYER'), false);
  });

  it('allows read via verification.read or any decide permission', () => {
    assert.equal(canReadVerification(['verification.read']), true);
    assert.equal(canReadVerification(['buyers.verify']), true);
    assert.equal(canReadVerification(['audit.read']), false);
  });
});

describe('statusAfterDecision', () => {
  it('transitions for approve/reject/info/suspend/review', () => {
    assert.equal(statusAfterDecision('APPROVE', 'PENDING'), 'APPROVED');
    assert.equal(statusAfterDecision('REJECT', 'IN_REVIEW'), 'REJECTED');
    assert.equal(statusAfterDecision('REQUEST_INFO', 'PENDING'), 'NEEDS_INFO');
    assert.equal(statusAfterDecision('SUSPEND', 'APPROVED'), 'SUSPENDED');
    assert.equal(statusAfterDecision('START_REVIEW', 'PENDING'), 'IN_REVIEW');
    assert.equal(statusAfterDecision('NOTE', 'NEEDS_INFO'), 'NEEDS_INFO');
  });
});

describe('requiresReason / isPendingVerificationStatus', () => {
  it('requires reason for reject/info/suspend', () => {
    assert.equal(requiresReason('REJECT'), true);
    assert.equal(requiresReason('APPROVE'), false);
  });

  it('treats pending queue statuses correctly', () => {
    assert.equal(isPendingVerificationStatus('PENDING'), true);
    assert.equal(isPendingVerificationStatus('APPROVED'), false);
  });
});
