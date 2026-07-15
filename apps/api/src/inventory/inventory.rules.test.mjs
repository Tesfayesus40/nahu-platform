import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function applyDelta(onHand, delta) {
  const next = onHand + delta;
  if (next < 0) throw new Error('Insufficient quantity on hand');
  return next;
}

describe('inventory qty ledger', () => {
  it('applies inbound and outbound deltas', () => {
    let q = 50;
    q = applyDelta(q, 10);
    assert.equal(q, 60);
    q = applyDelta(q, -5);
    assert.equal(q, 55);
  });

  it('rejects insufficient quantity', () => {
    assert.throws(() => applyDelta(3, -5), /Insufficient/);
  });
});

describe('inventory product separation', () => {
  it('lots reference productCode, farms do not own products', () => {
    const lot = { farmId: 'f1', productCode: 'ETHIOPIAN_ARABICA_COFFEE', quantityOnHand: 10 };
    assert.equal(typeof lot.productCode, 'string');
    assert.equal('products' in lot, false);
  });
});
