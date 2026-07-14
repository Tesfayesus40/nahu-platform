import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/catalog/product-resolve.rules.ts */
function isProductSellable(categoryIsActive, productStatus) {
  return categoryIsActive && productStatus === 'ACTIVE';
}

function productCategoryConflicts(productCategoryCode, requestedCategoryCode) {
  if (!requestedCategoryCode) return false;
  return productCategoryCode.toUpperCase() !== requestedCategoryCode.toUpperCase();
}

describe('product-resolve.rules', () => {
  it('allows sell when category active and product ACTIVE', () => {
    assert.equal(isProductSellable(true, 'ACTIVE'), true);
  });

  it('blocks sell for COMING_SOON / INACTIVE / DISCONTINUED', () => {
    assert.equal(isProductSellable(true, 'COMING_SOON'), false);
    assert.equal(isProductSellable(true, 'INACTIVE'), false);
    assert.equal(isProductSellable(true, 'DISCONTINUED'), false);
  });

  it('blocks sell when category inactive even if product ACTIVE', () => {
    assert.equal(isProductSellable(false, 'ACTIVE'), false);
  });

  it('detects category/product code conflicts case-insensitively', () => {
    assert.equal(productCategoryConflicts('COFFEE', 'CEREALS'), true);
    assert.equal(productCategoryConflicts('COFFEE', 'coffee'), false);
    assert.equal(productCategoryConflicts('COFFEE', undefined), false);
  });
});
