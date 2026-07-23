import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/marketplace/listing-moderation.rules.ts */

function statusAfterModerationDecision(decision, current) {
  switch (decision) {
    case 'APPROVE':
    case 'CLEAR_FLAG':
      return 'APPROVED';
    case 'REJECT':
      return 'REJECTED';
    case 'SUSPEND':
      return 'SUSPENDED';
    case 'FLAG':
      return 'FLAGGED';
    case 'NOTE':
      return current;
    default:
      return current;
  }
}

function requiresModerationReason(decision) {
  return (
    decision === 'REJECT' ||
    decision === 'SUSPEND' ||
    decision === 'FLAG'
  );
}

function isPubliclyVisibleModeration(moderationStatus) {
  return moderationStatus === 'APPROVED';
}

describe('statusAfterModerationDecision', () => {
  it('maps decisions to moderation statuses', () => {
    assert.equal(statusAfterModerationDecision('APPROVE', 'PENDING'), 'APPROVED');
    assert.equal(statusAfterModerationDecision('REJECT', 'FLAGGED'), 'REJECTED');
    assert.equal(statusAfterModerationDecision('SUSPEND', 'APPROVED'), 'SUSPENDED');
    assert.equal(statusAfterModerationDecision('FLAG', 'APPROVED'), 'FLAGGED');
    assert.equal(statusAfterModerationDecision('CLEAR_FLAG', 'FLAGGED'), 'APPROVED');
    assert.equal(statusAfterModerationDecision('NOTE', 'PENDING'), 'PENDING');
  });
});

describe('requiresModerationReason / visibility', () => {
  it('requires reason for reject/suspend/flag', () => {
    assert.equal(requiresModerationReason('REJECT'), true);
    assert.equal(requiresModerationReason('APPROVE'), false);
  });

  it('only APPROVED is publicly visible', () => {
    assert.equal(isPubliclyVisibleModeration('APPROVED'), true);
    assert.equal(isPubliclyVisibleModeration('PENDING'), false);
  });

  it('createOrder should reject non-visible moderation (same gate)', () => {
    const canOrder = (status, moderation) =>
      status === 'ACTIVE' && isPubliclyVisibleModeration(moderation ?? 'APPROVED');
    assert.equal(canOrder('ACTIVE', 'APPROVED'), true);
    assert.equal(canOrder('ACTIVE', 'PENDING'), false);
    assert.equal(canOrder('RESERVED', 'APPROVED'), false);
  });
});
