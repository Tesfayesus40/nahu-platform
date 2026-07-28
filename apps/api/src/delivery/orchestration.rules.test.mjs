import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ORCHESTRATION_STATUSES,
  assignmentOfferExpired,
  canSettle,
  deliveryFullyConfirmed,
  nextOrchestrationStatus,
  orchestrationFromOrderStatus,
  orderStatusForOrchestration,
  pickupFullyConfirmed,
} from './orchestration.rules.ts';

describe('G8 orchestration state machine', () => {
  it('runs the happy path PLACED → SETTLED', () => {
    let s = 'PLACED';
    s = nextOrchestrationStatus('MARK_PAID', s);
    assert.equal(s, 'PAID');
    s = nextOrchestrationStatus('SELLER_ACCEPT', s);
    assert.equal(s, 'SELLER_ACCEPTED');
    s = nextOrchestrationStatus('START_PREPARING', s);
    assert.equal(s, 'PREPARING');
    s = nextOrchestrationStatus('MARK_READY_FOR_PICKUP', s);
    assert.equal(s, 'READY_FOR_PICKUP');
    s = nextOrchestrationStatus('ASSIGN_COURIER', s);
    assert.equal(s, 'COURIER_ASSIGNED');
    s = nextOrchestrationStatus('MARK_PICKED_UP', s);
    assert.equal(s, 'PICKED_UP');
    s = nextOrchestrationStatus('MARK_IN_TRANSIT', s);
    assert.equal(s, 'IN_TRANSIT');
    s = nextOrchestrationStatus('MARK_DELIVERED', s);
    assert.equal(s, 'DELIVERED');
    s = nextOrchestrationStatus('SETTLE', s);
    assert.equal(s, 'SETTLED');
  });

  it('allows ready-for-pickup without preparing', () => {
    assert.equal(
      nextOrchestrationStatus('MARK_READY_FOR_PICKUP', 'SELLER_ACCEPTED'),
      'READY_FOR_PICKUP',
    );
  });

  it('allows reassign while COURIER_ASSIGNED', () => {
    assert.equal(
      nextOrchestrationStatus('ASSIGN_COURIER', 'COURIER_ASSIGNED'),
      'COURIER_ASSIGNED',
    );
  });

  it('rejects invalid transitions', () => {
    assert.throws(() => nextOrchestrationStatus('SELLER_ACCEPT', 'PLACED'));
    assert.throws(() => nextOrchestrationStatus('SETTLE', 'IN_TRANSIT'));
    assert.throws(() => nextOrchestrationStatus('MARK_PICKED_UP', 'READY_FOR_PICKUP'));
    assert.throws(() => nextOrchestrationStatus('MARK_PAID', 'PAID'));
  });

  it('blocks settle after SETTLED / CANCELLED', () => {
    assert.throws(() => nextOrchestrationStatus('SETTLE', 'SETTLED'));
    assert.throws(() => nextOrchestrationStatus('CANCEL', 'DELIVERED'));
  });
});

describe('G8 RC1 order dual-write mapping', () => {
  it('maps order statuses into orchestration', () => {
    assert.equal(orchestrationFromOrderStatus('PENDING_PAYMENT'), 'PLACED');
    assert.equal(orchestrationFromOrderStatus('PAID_ESCROW'), 'PAID');
    assert.equal(orchestrationFromOrderStatus('CONFIRMED'), 'SELLER_ACCEPTED');
    assert.equal(orchestrationFromOrderStatus('COMPLETED'), 'SETTLED');
  });

  it('maps orchestration milestones back to RC1 order statuses', () => {
    assert.equal(orderStatusForOrchestration('PAID'), 'PAID_ESCROW');
    assert.equal(orderStatusForOrchestration('READY_FOR_PICKUP'), 'CONFIRMED');
    assert.equal(orderStatusForOrchestration('IN_TRANSIT'), 'SHIPPED');
    assert.equal(orderStatusForOrchestration('SETTLED'), 'COMPLETED');
  });

  it('keeps known orchestration statuses finite', () => {
    assert.ok(ORCHESTRATION_STATUSES.includes('SETTLED'));
    assert.equal(ORCHESTRATION_STATUSES.length, 12);
  });
});

describe('G8 pickup / delivery confirmation + settlement policy', () => {
  it('requires both parties for pickup confirmation', () => {
    assert.equal(
      pickupFullyConfirmed({
        sellerPickupConfirmedAt: new Date(),
        courierPickupConfirmedAt: null,
      }),
      false,
    );
    assert.equal(
      pickupFullyConfirmed({
        sellerPickupConfirmedAt: new Date(),
        courierPickupConfirmedAt: new Date(),
      }),
      true,
    );
  });

  it('requires buyer + courier for delivery confirmation', () => {
    assert.equal(
      deliveryFullyConfirmed({
        buyerDeliveryConfirmedAt: new Date(),
        courierDeliveryConfirmedAt: null,
      }),
      false,
    );
    assert.equal(
      deliveryFullyConfirmed({
        buyerDeliveryConfirmedAt: new Date(),
        courierDeliveryConfirmedAt: new Date(),
      }),
      true,
    );
  });

  it('settles only when DELIVERED and dual-confirmed', () => {
    assert.equal(
      canSettle({
        orchestrationStatus: 'DELIVERED',
        deliveryFullyConfirmed: true,
      }),
      true,
    );
    assert.equal(
      canSettle({
        orchestrationStatus: 'DELIVERED',
        deliveryFullyConfirmed: false,
      }),
      false,
    );
    assert.equal(
      canSettle({
        orchestrationStatus: 'IN_TRANSIT',
        deliveryFullyConfirmed: true,
      }),
      false,
    );
  });
});

describe('G8 assignment offer timeout', () => {
  it('detects expired offers', () => {
    const now = new Date('2026-07-28T12:00:00Z');
    assert.equal(
      assignmentOfferExpired(new Date('2026-07-28T11:59:00Z'), now),
      true,
    );
    assert.equal(
      assignmentOfferExpired(new Date('2026-07-28T12:01:00Z'), now),
      false,
    );
    assert.equal(assignmentOfferExpired(null, now), false);
  });
});
