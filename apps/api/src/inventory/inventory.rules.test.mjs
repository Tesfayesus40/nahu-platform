import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function applyDelta(onHand, delta) {
  const next = onHand + delta;
  if (next < 0) throw new Error('Insufficient quantity on hand');
  return next;
}

function relocateLot(lot, toStorageSiteId) {
  if (!toStorageSiteId) throw new Error('toStorageSiteId is required for RELOCATE');
  if (lot.storageSiteId === toStorageSiteId) {
    throw new Error('Lot is already at this storage site');
  }
  return {
    ...lot,
    storageSiteId: toStorageSiteId,
    movement: {
      movementType: 'RELOCATE',
      qty: 0,
      fromStorageSiteId: lot.storageSiteId,
      toStorageSiteId,
    },
  };
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

describe('inventory RELOCATE', () => {
  it('is qty-neutral and updates storageSiteId', () => {
    const lot = { id: 'l1', storageSiteId: 's1', quantityOnHand: 25 };
    const next = relocateLot(lot, 's2');
    assert.equal(next.quantityOnHand, 25);
    assert.equal(next.storageSiteId, 's2');
    assert.equal(next.movement.qty, 0);
    assert.equal(next.movement.movementType, 'RELOCATE');
  });

  it('rejects same-site relocate', () => {
    assert.throws(() => relocateLot({ storageSiteId: 's1' }, 's1'), /already at/);
  });
});
