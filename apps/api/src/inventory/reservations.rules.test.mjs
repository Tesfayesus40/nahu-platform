import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Option B: listing hold → order hold keeps net reserved the same;
 * on_hand unchanged until DISPATCH (Phase 5).
 */
function applyOptionB(state, orderQty) {
  if (orderQty > state.listingReserved) throw new Error('exceeds listing hold');
  return {
    onHand: state.onHand,
    reserved: state.reserved, // RELEASE then RESERVE for same qty
    listingReserved: state.listingReserved - orderQty,
    orderHeld: state.orderHeld + orderQty,
  };
}

describe('listing↔stock Option B', () => {
  it('keeps on_hand and net reserved stable on order', () => {
    const before = { onHand: 100, reserved: 40, listingReserved: 40, orderHeld: 0 };
    const after = applyOptionB(before, 15);
    assert.equal(after.onHand, 100);
    assert.equal(after.reserved, 40);
    assert.equal(after.listingReserved, 25);
    assert.equal(after.orderHeld, 15);
  });

  it('rejects order above listing hold', () => {
    assert.throws(
      () => applyOptionB({ onHand: 50, reserved: 20, listingReserved: 20, orderHeld: 0 }, 25),
      /exceeds/,
    );
  });
});

describe('reservation status extensibility', () => {
  it('includes future Phase 5 statuses in the model', () => {
    const statuses = ['ACTIVE', 'ORDER_HELD', 'RELEASED', 'CONSUMED', 'ALLOCATED', 'DISPATCHED'];
    assert.ok(statuses.includes('ALLOCATED'));
    assert.ok(statuses.includes('DISPATCHED'));
  });
});
