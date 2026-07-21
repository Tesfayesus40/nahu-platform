import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/orders/dispute.rules.ts */

const OPEN = ['OPEN', 'UNDER_REVIEW', 'ESCALATED'];

function statusAfterDisputeAction(action, current) {
  switch (action) {
    case 'START_REVIEW':
      return 'UNDER_REVIEW';
    case 'REQUEST_INFO':
      return current === 'CLOSED' || current === 'RESOLVED'
        ? current
        : 'UNDER_REVIEW';
    case 'RESOLVE':
    case 'REJECT':
      return 'RESOLVED';
    case 'CLOSE':
      return 'CLOSED';
    case 'ESCALATE':
      return 'ESCALATED';
    case 'REFUND':
    case 'ASSIGN':
    case 'NOTE':
      return current;
    default:
      return current;
  }
}

function requiresDisputeReason(action) {
  return (
    action === 'REQUEST_INFO' ||
    action === 'RESOLVE' ||
    action === 'REJECT' ||
    action === 'CLOSE' ||
    action === 'ESCALATE' ||
    action === 'REFUND'
  );
}

function canApplyDisputeAction(action, status) {
  if (action === 'NOTE' || action === 'ASSIGN') return true;
  if (status === 'CLOSED') return false;
  if (status === 'RESOLVED' && action !== 'CLOSE') return false;
  return true;
}

function isOpenDisputeStatus(status) {
  return OPEN.includes(status);
}

describe('statusAfterDisputeAction', () => {
  it('maps workflow actions', () => {
    assert.equal(statusAfterDisputeAction('START_REVIEW', 'OPEN'), 'UNDER_REVIEW');
    assert.equal(statusAfterDisputeAction('REQUEST_INFO', 'OPEN'), 'UNDER_REVIEW');
    assert.equal(statusAfterDisputeAction('RESOLVE', 'UNDER_REVIEW'), 'RESOLVED');
    assert.equal(statusAfterDisputeAction('REJECT', 'ESCALATED'), 'RESOLVED');
    assert.equal(statusAfterDisputeAction('CLOSE', 'RESOLVED'), 'CLOSED');
    assert.equal(statusAfterDisputeAction('ESCALATE', 'OPEN'), 'ESCALATED');
    assert.equal(statusAfterDisputeAction('REFUND', 'UNDER_REVIEW'), 'UNDER_REVIEW');
  });
});

describe('requiresDisputeReason / canApply', () => {
  it('requires reason for decisive actions', () => {
    assert.equal(requiresDisputeReason('RESOLVE'), true);
    assert.equal(requiresDisputeReason('START_REVIEW'), false);
  });

  it('blocks most actions on closed/resolved', () => {
    assert.equal(canApplyDisputeAction('RESOLVE', 'CLOSED'), false);
    assert.equal(canApplyDisputeAction('CLOSE', 'RESOLVED'), true);
    assert.equal(canApplyDisputeAction('NOTE', 'CLOSED'), true);
    assert.equal(canApplyDisputeAction('ESCALATE', 'OPEN'), true);
  });

  it('identifies open queue statuses', () => {
    assert.equal(isOpenDisputeStatus('OPEN'), true);
    assert.equal(isOpenDisputeStatus('ESCALATED'), true);
    assert.equal(isOpenDisputeStatus('CLOSED'), false);
  });
});
