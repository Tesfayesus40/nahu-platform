import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const TRANSITIONS = {
  CONFIRM_PAYMENT_SIMULATION: { from: ['PENDING_PAYMENT'], to: 'PAID_ESCROW' },
  CANCEL_UNPAID: { from: ['PENDING_PAYMENT'], to: 'CANCELLED' },
  START_FULFILLMENT: { from: ['PAID_ESCROW'], to: 'CONFIRMED' },
  MARK_SHIPPED: { from: ['CONFIRMED'], to: 'SHIPPED' },
  MARK_DELIVERED: { from: ['SHIPPED', 'CONFIRMED'], to: 'DELIVERED' },
  COMPLETE_ORDER: {
    from: ['DELIVERED', 'PAID_ESCROW', 'CONFIRMED', 'SHIPPED'],
    to: 'COMPLETED',
  },
};

function nextOrderStatus(action, current) {
  if (action === 'NOTE') return current;
  const rule = TRANSITIONS[action];
  if (!rule || !rule.from.includes(current)) return null;
  return rule.to;
}

function isStalledEscrow(status, paidAt, days = 3, now = Date.now()) {
  if (status !== 'PAID_ESCROW' || !paidAt) return false;
  return now - paidAt.getTime() >= days * 24 * 60 * 60 * 1000;
}

describe('nextOrderStatus', () => {
  it('allows payment simulation and fulfillment path', () => {
    assert.equal(nextOrderStatus('CONFIRM_PAYMENT_SIMULATION', 'PENDING_PAYMENT'), 'PAID_ESCROW');
    assert.equal(nextOrderStatus('START_FULFILLMENT', 'PAID_ESCROW'), 'CONFIRMED');
    assert.equal(nextOrderStatus('MARK_SHIPPED', 'CONFIRMED'), 'SHIPPED');
    assert.equal(nextOrderStatus('MARK_DELIVERED', 'SHIPPED'), 'DELIVERED');
    assert.equal(nextOrderStatus('COMPLETE_ORDER', 'DELIVERED'), 'COMPLETED');
    assert.equal(nextOrderStatus('CANCEL_UNPAID', 'PAID_ESCROW'), null);
  });
});

describe('isStalledEscrow', () => {
  it('flags paid escrow older than threshold', () => {
    const now = Date.parse('2026-07-22T00:00:00Z');
    assert.equal(
      isStalledEscrow('PAID_ESCROW', new Date('2026-07-18T00:00:00Z'), 3, now),
      true,
    );
    assert.equal(
      isStalledEscrow('PAID_ESCROW', new Date('2026-07-21T00:00:00Z'), 3, now),
      false,
    );
  });
});
