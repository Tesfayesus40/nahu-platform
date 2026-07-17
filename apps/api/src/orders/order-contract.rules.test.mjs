import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

class OrderContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OrderContractError';
  }
}

function resolveOrderQuantity(input, listing) {
  const listingUnit = (listing.unitCode || 'KG').toUpperCase();
  const pricePerUnit = Number(listing.pricePerUnit ?? listing.pricePerKg);
  const available = Number(listing.quantity ?? listing.quantityKg);
  const hasModern = input.quantity !== undefined || input.unitCode !== undefined;
  const hasLegacy = input.quantityKg !== undefined;

  let quantity;
  let unitCode;
  if (hasModern) {
    if (input.quantity === undefined) {
      throw new OrderContractError('quantity is required when using unit-aware order fields');
    }
    quantity = input.quantity;
    unitCode = (input.unitCode || listingUnit).toUpperCase();
  } else if (hasLegacy) {
    quantity = input.quantityKg;
    unitCode = 'KG';
  } else {
    throw new OrderContractError('Provide quantity or quantityKg');
  }

  if (quantity <= 0) throw new OrderContractError('quantity must be greater than zero');
  if (unitCode !== listingUnit) {
    throw new OrderContractError(
      `unitCode ${unitCode} does not match listing unit ${listingUnit}`,
    );
  }
  if (quantity > available) {
    throw new OrderContractError(`Only ${available} ${listingUnit} available`);
  }

  return {
    quantity,
    unitCode,
    quantityKg: quantity,
    pricePerUnit,
    totalEtb: pricePerUnit * quantity,
  };
}

describe('order-contract.rules', () => {
  const listing = {
    quantity: 40,
    unitCode: 'KG',
    quantityKg: 40,
    pricePerUnit: 280,
    pricePerKg: 280,
  };

  it('resolves legacy quantityKg', () => {
    const r = resolveOrderQuantity({ quantityKg: 10 }, listing);
    assert.equal(r.quantity, 10);
    assert.equal(r.unitCode, 'KG');
    assert.equal(r.totalEtb, 2800);
  });

  it('resolves modern quantity with listing unit default', () => {
    const r = resolveOrderQuantity({ quantity: 5 }, listing);
    assert.equal(r.unitCode, 'KG');
    assert.equal(r.totalEtb, 1400);
  });

  it('rejects unit mismatch and oversell', () => {
    assert.throws(
      () => resolveOrderQuantity({ quantity: 1, unitCode: 'DOZEN' }, listing),
      OrderContractError,
    );
    assert.throws(() => resolveOrderQuantity({ quantityKg: 50 }, listing), OrderContractError);
  });
});
