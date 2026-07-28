import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AUDIT_DOMAIN_PREFIXES,
  isAwaitingCourierAssignment,
  isAwaitingSellerAction,
  isDeliveryInTransit,
  isExpiredCourierOffer,
  isSettlementPending,
  isStuckOrder,
  planSellerAdminAction,
} from './ops.rules.ts';

describe('G10 seller admin actions', () => {
  it('verifies active seller', () => {
    const next = planSellerAdminAction('VERIFY', {
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    });
    assert.equal(next.verified, true);
    assert.equal(next.verificationStatus, 'APPROVED');
  });

  it('blocks verify while suspended', () => {
    assert.throws(() =>
      planSellerAdminAction('VERIFY', {
        status: 'SUSPENDED',
        verificationStatus: 'SUSPENDED',
      }),
    );
  });

  it('suspends then activates', () => {
    const suspended = planSellerAdminAction('SUSPEND', {
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
    });
    assert.equal(suspended.status, 'SUSPENDED');
    const active = planSellerAdminAction('ACTIVATE', suspended);
    assert.equal(active.status, 'ACTIVE');
    assert.equal(active.verificationStatus, 'APPROVED');
  });
});

describe('G10 queue classifiers', () => {
  it('classifies awaiting seller / courier / in-transit', () => {
    assert.equal(isAwaitingSellerAction({ orderStatus: 'PAID_ESCROW' }), true);
    assert.equal(
      isAwaitingCourierAssignment({ shipmentStatus: 'AWAITING_ASSIGNMENT' }),
      true,
    );
    assert.equal(isDeliveryInTransit({ shipmentStatus: 'IN_TRANSIT' }), true);
  });

  it('flags settlement pending from escrowed payment', () => {
    assert.equal(isSettlementPending({ paymentStatus: 'ESCROWED' }), true);
    assert.equal(
      isSettlementPending({
        paymentStatus: 'SETTLED',
        settlementStatus: 'COMPLETED',
      }),
      false,
    );
  });
});

describe('G10 health signals', () => {
  it('detects stuck non-terminal orders', () => {
    const now = new Date('2026-07-28T12:00:00Z');
    assert.equal(
      isStuckOrder({
        orderStatus: 'CONFIRMED',
        updatedAt: new Date('2026-07-24T12:00:00Z'),
        now,
      }),
      true,
    );
    assert.equal(
      isStuckOrder({
        orderStatus: 'COMPLETED',
        updatedAt: new Date('2026-07-24T12:00:00Z'),
        now,
      }),
      false,
    );
  });

  it('detects expired courier offers', () => {
    const now = new Date('2026-07-28T12:00:00Z');
    assert.equal(
      isExpiredCourierOffer({
        offerExpiresAt: new Date('2026-07-28T11:00:00Z'),
        acceptedAt: null,
        rejectedAt: null,
        isActive: true,
        now,
      }),
      true,
    );
    assert.equal(
      isExpiredCourierOffer({
        offerExpiresAt: new Date('2026-07-28T11:00:00Z'),
        acceptedAt: new Date('2026-07-28T10:30:00Z'),
        rejectedAt: null,
        isActive: true,
        now,
      }),
      false,
    );
  });
});

describe('G10 audit domain prefixes', () => {
  it('maps domains for search', () => {
    assert.ok(AUDIT_DOMAIN_PREFIXES.orders.includes('orders.'));
    assert.ok(AUDIT_DOMAIN_PREFIXES.payments.length > 0);
    assert.ok(AUDIT_DOMAIN_PREFIXES.sellers.includes('seller.'));
  });
});
