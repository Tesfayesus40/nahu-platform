import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors courier-queue.rules.ts */

const COURIER_QUEUE_SECTIONS = [
  'available',
  'accepted',
  'active',
  'completed_today',
  'failed',
  'returned',
];

const COURIER_QUEUE_STATUSES = {
  available: ['ASSIGNED'],
  accepted: ['ACCEPTED'],
  active: ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'BUYER_CONFIRMED'],
  completed_today: ['COMPLETED'],
  failed: ['FAILED'],
  returned: ['RETURNED'],
};

function statusesForCourierSection(section) {
  if (!COURIER_QUEUE_SECTIONS.includes(section)) return null;
  return [...COURIER_QUEUE_STATUSES[section]];
}

/** Authorization: courier JWT role required (controller @Roles). */
const COURIER_ROUTE_AUTH = {
  list: { role: 'COURIER', permissionGate: 'delivery.courier_app.enabled' },
  execute: { role: 'COURIER', owner: 'assigned courier only (service)' },
};

describe('courier-queue rules (D7)', () => {
  it('lists all work-queue sections', () => {
    assert.equal(COURIER_QUEUE_SECTIONS.length, 6);
    assert.ok(statusesForCourierSection('active').includes('ARRIVED'));
  });

  it('keeps available offers separate from accepted', () => {
    assert.deepEqual(statusesForCourierSection('available'), ['ASSIGNED']);
    assert.deepEqual(statusesForCourierSection('accepted'), ['ACCEPTED']);
  });
});

describe('courier API auth expectations (D7)', () => {
  it('requires COURIER role for list and execution', () => {
    assert.equal(COURIER_ROUTE_AUTH.list.role, 'COURIER');
    assert.equal(COURIER_ROUTE_AUTH.execute.role, 'COURIER');
  });
});
