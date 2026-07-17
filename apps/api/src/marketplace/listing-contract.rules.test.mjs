import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/marketplace/listing-contract.rules.ts */
class ListingContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ListingContractError';
  }
}

function resolveListingQuantity(input) {
  const hasModern =
    input.quantity !== undefined ||
    input.unitCode !== undefined ||
    input.pricePerUnit !== undefined;
  const hasLegacy = input.quantityKg !== undefined || input.pricePerKg !== undefined;

  if (hasModern) {
    if (
      input.quantity === undefined ||
      input.unitCode === undefined ||
      input.pricePerUnit === undefined
    ) {
      throw new ListingContractError(
        'quantity, unitCode, and pricePerUnit are required together',
      );
    }
    if (input.quantity <= 0 || input.pricePerUnit <= 0) {
      throw new ListingContractError('quantity and pricePerUnit must be greater than zero');
    }
    const unitCode = input.unitCode.toUpperCase();
    return {
      quantity: input.quantity,
      unitCode,
      pricePerUnit: input.pricePerUnit,
      quantityKg: input.quantityKg ?? input.quantity,
      pricePerKg: input.pricePerKg ?? input.pricePerUnit,
    };
  }

  if (hasLegacy) {
    if (input.quantityKg === undefined || input.pricePerKg === undefined) {
      throw new ListingContractError('quantityKg and pricePerKg are required together');
    }
    if (input.quantityKg <= 0 || input.pricePerKg <= 0) {
      throw new ListingContractError('quantityKg and pricePerKg must be greater than zero');
    }
    return {
      quantity: input.quantityKg,
      unitCode: 'KG',
      pricePerUnit: input.pricePerKg,
      quantityKg: input.quantityKg,
      pricePerKg: input.pricePerKg,
    };
  }

  throw new ListingContractError(
    'Provide quantity/unitCode/pricePerUnit or quantityKg/pricePerKg',
  );
}

function assertCoffeeExtensionRequirements(input) {
  const grade = input.qualityGrade ?? input.grade;
  const processMethod = input.processMethod;
  if (!grade) {
    throw new ListingContractError('qualityGrade (or grade) is required for COFFEE listings');
  }
  if (!processMethod) {
    throw new ListingContractError('processMethod is required for COFFEE listings');
  }
  return { grade, processMethod };
}

describe('listing-contract.rules', () => {
  it('resolves legacy kg fields into dual-written unit fields', () => {
    assert.deepEqual(resolveListingQuantity({ quantityKg: 40, pricePerKg: 280 }), {
      quantity: 40,
      unitCode: 'KG',
      pricePerUnit: 280,
      quantityKg: 40,
      pricePerKg: 280,
    });
  });

  it('resolves modern KG unit fields and mirrors kg columns', () => {
    const resolved = resolveListingQuantity({
      quantity: 12.5,
      unitCode: 'kg',
      pricePerUnit: 300,
    });
    assert.equal(resolved.unitCode, 'KG');
    assert.equal(resolved.quantityKg, 12.5);
    assert.equal(resolved.pricePerKg, 300);
  });

  it('resolves non-KG modern units while filling legacy kg columns', () => {
    const resolved = resolveListingQuantity({
      quantity: 24,
      unitCode: 'DOZEN',
      pricePerUnit: 180,
    });
    assert.equal(resolved.unitCode, 'DOZEN');
    assert.equal(resolved.quantity, 24);
  });

  it('rejects incomplete modern or legacy payloads', () => {
    assert.throws(
      () => resolveListingQuantity({ quantity: 1, unitCode: 'KG' }),
      ListingContractError,
    );
    assert.throws(() => resolveListingQuantity({ quantityKg: 10 }), ListingContractError);
    assert.throws(() => resolveListingQuantity({}), ListingContractError);
  });

  it('requires coffee grade and process method', () => {
    assert.throws(
      () => assertCoffeeExtensionRequirements({ processMethod: 'WASHED' }),
      ListingContractError,
    );
    assert.deepEqual(
      assertCoffeeExtensionRequirements({
        qualityGrade: 'GRADE_1',
        processMethod: 'WASHED',
      }),
      { grade: 'GRADE_1', processMethod: 'WASHED' },
    );
  });
});
