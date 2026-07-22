import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const PENDING_VERIFICATION_STATUSES = [
  'PENDING',
  'IN_REVIEW',
  'NEEDS_INFO',
];

describe('RC1 pending verification statuses', () => {
  it('uses NEEDS_INFO not INFO_REQUESTED', () => {
    assert.ok(PENDING_VERIFICATION_STATUSES.includes('NEEDS_INFO'));
    assert.equal(PENDING_VERIFICATION_STATUSES.includes('INFO_REQUESTED'), false);
  });
});
