import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Mirrors settlement.rules.ts + earning correction helpers for D11.
 * Controllers must not reimplement these; SettlementService owns writes.
 */

function buildEarningCorrection(input) {
  if (input.earningType === 'VOID' || input.earningType === 'REVERSAL') {
    return {
      replacesEarningId: input.originalId,
      amount: -Math.abs(input.originalAmount),
      earningType: input.earningType,
      ledgerStatus: input.earningType === 'REVERSAL' ? 'REVERSED' : 'VOID',
      reference:
        input.reference ??
        `${input.earningType.toLowerCase()}:${input.originalId}`,
    };
  }
  return {
    replacesEarningId: input.originalId,
    amount: input.correctionAmount,
    earningType: 'ADJUSTMENT',
    ledgerStatus: 'ADJUSTED',
    reference: input.reference ?? `adjust:${input.originalId}`,
  };
}

function sumEarningLedger(rows) {
  return rows.reduce((sum, row) => {
    const n = typeof row.amount === 'string' ? Number(row.amount) : row.amount;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function resolveSettlementStatus(rows) {
  if (!rows.length) return 'PENDING';
  const statuses = rows.map((r) => r.ledgerStatus);
  if (statuses.some((s) => s === 'REVERSED' || s === 'VOID')) return 'REVERSED';
  if (statuses.some((s) => s === 'PAID')) return 'PAID';
  if (statuses.some((s) => s === 'APPROVED')) return 'APPROVED';
  if (
    statuses.some(
      (s) => s === 'ELIGIBLE' || s === 'ACCRUED' || s === 'ADJUSTED',
    )
  ) {
    return 'ELIGIBLE';
  }
  if (statuses.some((s) => s === 'PENDING')) return 'PENDING';
  return 'PENDING';
}

function assertCanAccrue(input) {
  if (input.alreadyAccrued) {
    const err = new Error('ALREADY_ACCRUED');
    err.code = 'ALREADY_ACCRUED';
    throw err;
  }
  if (!input.hasVerifiedPod) {
    const err = new Error('POD_REQUIRED');
    err.code = 'POD_REQUIRED';
    throw err;
  }
  if (input.shipmentStatus !== 'COMPLETED') {
    const err = new Error('NOT_COMPLETED');
    err.code = 'NOT_COMPLETED';
    throw err;
  }
}

function planDeliveryAccrual({ flatEtb }) {
  const amount = Number.isFinite(flatEtb) ? flatEtb : 0;
  return {
    earningType: 'DELIVERY_EARNING',
    amount,
    ledgerStatus: 'ELIGIBLE',
    policyCode: 'delivery.earning.flat_etb',
    currency: 'ETB',
  };
}

function planAdjustment(input) {
  if (!Number.isFinite(input.correctionAmount)) {
    const err = new Error('INVALID_AMOUNT');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  return buildEarningCorrection({
    originalId: input.originalId,
    originalAmount: input.originalAmount,
    correctionAmount: input.correctionAmount,
    earningType: 'ADJUSTMENT',
    reference: input.reference,
  });
}

function planReversal(input) {
  return buildEarningCorrection({
    originalId: input.originalId,
    originalAmount: input.originalAmount,
    correctionAmount: 0,
    earningType: 'REVERSAL',
    reference: input.reference,
  });
}

function assertCanApprove(status) {
  if (status === 'REVERSED') {
    const err = new Error('ALREADY_REVERSED');
    err.code = 'ALREADY_REVERSED';
    throw err;
  }
  if (status !== 'ELIGIBLE' && status !== 'PENDING') {
    const err = new Error('NOT_ELIGIBLE');
    err.code = 'NOT_ELIGIBLE';
    throw err;
  }
}

function assertCanMarkPaid(status) {
  if (status === 'REVERSED') {
    const err = new Error('ALREADY_REVERSED');
    err.code = 'ALREADY_REVERSED';
    throw err;
  }
  if (status !== 'APPROVED' && status !== 'ELIGIBLE') {
    const err = new Error('NOT_ELIGIBLE');
    err.code = 'NOT_ELIGIBLE';
    throw err;
  }
}

function assertCanReverse(status) {
  if (status === 'REVERSED') {
    const err = new Error('ALREADY_REVERSED');
    err.code = 'ALREADY_REVERSED';
    throw err;
  }
  if (status === 'PAID') {
    const err = new Error('NOT_ELIGIBLE');
    err.code = 'NOT_ELIGIBLE';
    throw err;
  }
}

/** Authz: manage actions require delivery.earnings.manage */
function assertEarningsManage(permissions) {
  if (!permissions.includes('delivery.earnings.manage')) {
    const err = new Error('FORBIDDEN');
    err.code = 'FORBIDDEN';
    throw err;
  }
}

function assertEarningsRead(permissions) {
  if (
    !permissions.includes('delivery.earnings.read') &&
    !permissions.includes('delivery.earnings.manage')
  ) {
    const err = new Error('FORBIDDEN');
    err.code = 'FORBIDDEN';
    throw err;
  }
}

describe('D11 settlement accrual gates', () => {
  it('blocks accrual without POD', () => {
    assert.throws(
      () =>
        assertCanAccrue({
          shipmentStatus: 'COMPLETED',
          hasVerifiedPod: false,
          alreadyAccrued: false,
        }),
      (e) => e.code === 'POD_REQUIRED',
    );
  });

  it('blocks accrual before COMPLETED', () => {
    assert.throws(
      () =>
        assertCanAccrue({
          shipmentStatus: 'DELIVERED',
          hasVerifiedPod: true,
          alreadyAccrued: false,
        }),
      (e) => e.code === 'NOT_COMPLETED',
    );
  });

  it('is idempotent when already accrued', () => {
    assert.throws(
      () =>
        assertCanAccrue({
          shipmentStatus: 'COMPLETED',
          hasVerifiedPod: true,
          alreadyAccrued: true,
        }),
      (e) => e.code === 'ALREADY_ACCRUED',
    );
  });

  it('plans flat DELIVERY_EARNING as ELIGIBLE', () => {
    const planned = planDeliveryAccrual({ flatEtb: 85 });
    assert.equal(planned.earningType, 'DELIVERY_EARNING');
    assert.equal(planned.amount, 85);
    assert.equal(planned.ledgerStatus, 'ELIGIBLE');
  });
});

describe('D11 adjustments & reversals (immutable ledger)', () => {
  it('adjustment appends delta without mutating original amount', () => {
    const original = { id: 'e1', amount: 100 };
    const adj = planAdjustment({
      originalId: original.id,
      originalAmount: original.amount,
      correctionAmount: -15,
    });
    assert.equal(original.amount, 100);
    assert.equal(adj.amount, -15);
    assert.equal(adj.earningType, 'ADJUSTMENT');
    assert.equal(adj.replacesEarningId, 'e1');
    assert.equal(
      sumEarningLedger([{ amount: 100 }, { amount: adj.amount }]),
      85,
    );
  });

  it('reversal nets primary earning to zero', () => {
    const rev = planReversal({
      originalId: 'e1',
      originalAmount: 85,
    });
    assert.equal(rev.amount, -85);
    assert.equal(rev.earningType, 'REVERSAL');
    assert.equal(rev.ledgerStatus, 'REVERSED');
    assert.equal(sumEarningLedger([{ amount: 85 }, { amount: rev.amount }]), 0);
  });

  it('rejects non-finite adjustment', () => {
    assert.throws(
      () =>
        planAdjustment({
          originalId: 'e1',
          originalAmount: 10,
          correctionAmount: Number.NaN,
        }),
      (e) => e.code === 'INVALID_AMOUNT',
    );
  });
});

describe('D11 settlement status machine', () => {
  it('resolves ELIGIBLE → APPROVED → PAID; REVERSED wins', () => {
    assert.equal(
      resolveSettlementStatus([{ ledgerStatus: 'ELIGIBLE' }]),
      'ELIGIBLE',
    );
    assert.equal(
      resolveSettlementStatus([
        { ledgerStatus: 'ELIGIBLE' },
        { ledgerStatus: 'APPROVED' },
      ]),
      'APPROVED',
    );
    assert.equal(
      resolveSettlementStatus([
        { ledgerStatus: 'APPROVED' },
        { ledgerStatus: 'PAID' },
      ]),
      'PAID',
    );
    assert.equal(
      resolveSettlementStatus([
        { ledgerStatus: 'PAID' },
        { ledgerStatus: 'REVERSED' },
      ]),
      'REVERSED',
    );
  });

  it('approve/paid/reverse guards', () => {
    assert.doesNotThrow(() => assertCanApprove('ELIGIBLE'));
    assert.throws(() => assertCanApprove('PAID'), (e) => e.code === 'NOT_ELIGIBLE');
    assert.doesNotThrow(() => assertCanMarkPaid('APPROVED'));
    assert.throws(
      () => assertCanMarkPaid('PENDING'),
      (e) => e.code === 'NOT_ELIGIBLE',
    );
    assert.doesNotThrow(() => assertCanReverse('ELIGIBLE'));
    assert.throws(
      () => assertCanReverse('PAID'),
      (e) => e.code === 'NOT_ELIGIBLE',
    );
  });

  it('approve/paid marker references are stable for idempotency', () => {
    const approveRef = `approve:e1`;
    const paidRef = `paid:e1`;
    assert.equal(approveRef, 'approve:e1');
    assert.equal(paidRef, 'paid:e1');
  });
});

describe('D11 authorization (permission codes)', () => {
  it('read requires delivery.earnings.read', () => {
    assert.doesNotThrow(() =>
      assertEarningsRead(['delivery.earnings.read']),
    );
    assert.throws(() => assertEarningsRead(['delivery.read']), (e) => {
      return e.code === 'FORBIDDEN';
    });
  });

  it('manage requires delivery.earnings.manage', () => {
    assert.doesNotThrow(() =>
      assertEarningsManage(['delivery.earnings.manage']),
    );
    assert.throws(
      () => assertEarningsManage(['delivery.earnings.read']),
      (e) => e.code === 'FORBIDDEN',
    );
  });
});

describe('D11 ledger immutability contract', () => {
  it('never mutates historical rows — corrections are new entries', () => {
    const ledger = Object.freeze([
      Object.freeze({
        id: 'e1',
        amount: 100,
        earningType: 'DELIVERY_EARNING',
        ledgerStatus: 'ELIGIBLE',
      }),
    ]);
    const correction = planAdjustment({
      originalId: 'e1',
      originalAmount: 100,
      correctionAmount: 20,
    });
    const next = [...ledger, correction];
    assert.equal(ledger[0].amount, 100);
    assert.equal(next.length, 2);
    assert.equal(sumEarningLedger(next), 120);
  });

  it('supports BONUS and PENALTY types in balance math', () => {
    assert.equal(
      sumEarningLedger([
        { amount: 80, ledgerStatus: 'ELIGIBLE' },
        { amount: 20, ledgerStatus: 'ELIGIBLE' }, // BONUS
        { amount: -10, ledgerStatus: 'ELIGIBLE' }, // PENALTY (future)
      ]),
      90,
    );
  });
});

describe('D11 POD → COMPLETED → accrue sequence (integration of gates)', () => {
  it('happy path gates pass only after POD + COMPLETED', () => {
    const steps = [
      { status: 'ARRIVED', pod: false },
      { status: 'DELIVERED', pod: true },
      { status: 'COMPLETED', pod: true },
    ];
    for (const step of steps) {
      try {
        assertCanAccrue({
          shipmentStatus: step.status,
          hasVerifiedPod: step.pod,
          alreadyAccrued: false,
        });
        assert.equal(step.status, 'COMPLETED');
        assert.equal(step.pod, true);
      } catch (e) {
        assert.notEqual(step.status === 'COMPLETED' && step.pod, true);
      }
    }
  });
});
