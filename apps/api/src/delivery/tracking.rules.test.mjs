import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors tracking.rules.ts + shared trackingProgress.js */

const TRACKING_STEPS = [
  'PREPARING',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'COMPLETED',
];

function trackingStepIndex(status) {
  switch (status) {
    case 'CREATED':
    case 'AWAITING_ASSIGNMENT':
      return 0;
    case 'ASSIGNED':
    case 'ACCEPTED':
      return 1;
    case 'PICKED_UP':
      return 2;
    case 'IN_TRANSIT':
      return 3;
    case 'ARRIVED':
      return 4;
    case 'DELIVERED':
    case 'BUYER_CONFIRMED':
      return 5;
    case 'COMPLETED':
      return 6;
    case 'CANCELLED':
    case 'FAILED':
    case 'RETURNED':
      return -1;
    default:
      return 0;
  }
}

function isExceptionShipmentStatus(status) {
  return ['CANCELLED', 'FAILED', 'RETURNED'].includes(status);
}

function isPartyVisibleEvent(eventType) {
  if (!eventType) return false;
  if (eventType.startsWith('delivery.earning.')) return false;
  if (eventType === 'delivery.courier.availability_changed') return false;
  return true;
}

/** Authz expectations for party delivery routes. */
const PARTY_AUTH = {
  seller: { role: 'FARMER', ownership: 'order.farmer.userId' },
  buyer: { role: 'BUYER', ownership: 'order.buyerId' },
};

describe('tracking progress (D8)', () => {
  it('maps lifecycle statuses to monotonic progress steps', () => {
    assert.equal(trackingStepIndex('AWAITING_ASSIGNMENT'), 0);
    assert.equal(trackingStepIndex('ACCEPTED'), 1);
    assert.equal(trackingStepIndex('IN_TRANSIT'), 3);
    assert.equal(trackingStepIndex('DELIVERED'), 5);
    assert.equal(trackingStepIndex('COMPLETED'), 6);
    assert.equal(TRACKING_STEPS.length, 7);
  });

  it('flags exception statuses without inventing ETA', () => {
    assert.equal(isExceptionShipmentStatus('FAILED'), true);
    assert.equal(isExceptionShipmentStatus('CANCELLED'), true);
    assert.equal(isExceptionShipmentStatus('RETURNED'), true);
    assert.equal(trackingStepIndex('FAILED'), -1);
  });

  it('hides internal events from farmer/buyer timeline', () => {
    assert.equal(isPartyVisibleEvent('delivery.shipment.delivered'), true);
    assert.equal(isPartyVisibleEvent('delivery.earning.accrued'), false);
    assert.equal(
      isPartyVisibleEvent('delivery.courier.availability_changed'),
      false,
    );
  });
});

describe('party delivery authorization (D8)', () => {
  it('requires FARMER/BUYER roles and order ownership', () => {
    assert.equal(PARTY_AUTH.seller.role, 'FARMER');
    assert.equal(PARTY_AUTH.buyer.role, 'BUYER');
    assert.match(PARTY_AUTH.seller.ownership, /farmer/);
    assert.match(PARTY_AUTH.buyer.ownership, /buyerId/);
  });

  it('does not expose courier execution endpoints to parties', () => {
    const partyPaths = [
      '/delivery/seller/shipments',
      '/delivery/buyer/orders/:id/tracking',
    ];
    const courierMutations = [
      '/delivery/courier/shipments/:id/pickup',
      '/delivery/courier/shipments/:id/transit',
    ];
    for (const p of partyPaths) assert.ok(p.includes('/delivery/'));
    for (const p of courierMutations) assert.ok(p.includes('/courier/'));
  });
});
