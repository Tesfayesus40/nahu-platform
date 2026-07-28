import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  availableEscrowRelease,
  canRefundPayment,
  canSettlePayment,
  nextPaymentStatus,
  planSettlementFromSnapshot,
} from './payment-orchestration.rules.ts';

describe('G9 payment state machine', () => {
  it('runs happy path CREATED → SETTLED via escrow shortcut', () => {
    let s = 'CREATED';
    s = nextPaymentStatus('INITIATE', s);
    assert.equal(s, 'PENDING');
    s = nextPaymentStatus('CAPTURE_TO_ESCROW', s);
    assert.equal(s, 'ESCROWED');
    s = nextPaymentStatus('SETTLE', s);
    assert.equal(s, 'SETTLED');
  });

  it('supports full authorize → capture → escrow path', () => {
    let s = 'PENDING';
    s = nextPaymentStatus('AUTHORIZE', s);
    s = nextPaymentStatus('CAPTURE', s);
    s = nextPaymentStatus('ESCROW', s);
    assert.equal(s, 'ESCROWED');
  });

  it('allows partial then full settlement', () => {
    let s = nextPaymentStatus('PARTIAL_SETTLE', 'ESCROWED');
    assert.equal(s, 'PARTIALLY_SETTLED');
    s = nextPaymentStatus('SETTLE', s);
    assert.equal(s, 'SETTLED');
  });

  it('rejects invalid transitions', () => {
    assert.throws(() => nextPaymentStatus('SETTLE', 'PENDING'));
    assert.throws(() => nextPaymentStatus('CAPTURE_TO_ESCROW', 'SETTLED'));
    assert.throws(() => nextPaymentStatus('CANCEL', 'ESCROWED'));
  });
});

describe('G9 Revenue Engine settlement plan', () => {
  it('splits buyer charge into farmer / courier / platform', () => {
    const goods = 1000;
    const buyerFee = 50;
    const farmerFee = 30;
    const deliveryFee = 100;
    const deliveryCommission = 20;
    const farmerPayout = goods - farmerFee;
    const courierPayout = deliveryFee - deliveryCommission;
    const lines = planSettlementFromSnapshot({
      farmerPayoutEtb: farmerPayout,
      courierPayoutEtb: courierPayout,
      buyerFeeEtb: buyerFee,
      farmerFeeEtb: farmerFee,
      deliveryCommissionEtb: deliveryCommission,
    });
    const byParty = Object.fromEntries(lines.map((l) => [l.partyCode, l.amountEtb]));
    assert.equal(byParty.FARMER, 970);
    assert.equal(byParty.COURIER, 80);
    assert.equal(byParty.PLATFORM, 100);
    const sum = lines.reduce((a, l) => a + l.amountEtb, 0);
    assert.equal(sum, goods + buyerFee + deliveryFee);
  });
});

describe('G9 escrow availability', () => {
  it('computes releasable remainder', () => {
    assert.equal(availableEscrowRelease(1150, 970, 0), 180);
    assert.equal(availableEscrowRelease(1150, 1150, 0), 0);
    assert.equal(availableEscrowRelease(1150, 0, 200), 950);
  });
});

describe('G9 refund workflow', () => {
  it('allows refund from escrowed / captured states', () => {
    assert.equal(canRefundPayment('ESCROWED'), true);
    assert.equal(canRefundPayment('CAPTURED'), true);
    assert.equal(canRefundPayment('SETTLED'), false);
    assert.equal(canRefundPayment('CANCELLED'), false);
    assert.equal(nextPaymentStatus('REFUND', 'ESCROWED'), 'REFUNDED');
  });
});

describe('G9 settle gate', () => {
  it('settle gate matches FSM', () => {
    assert.equal(canSettlePayment('ESCROWED'), true);
    assert.equal(canSettlePayment('PARTIALLY_SETTLED'), true);
    assert.equal(canSettlePayment('PENDING'), false);
  });
});
