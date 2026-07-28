import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/catalog/product-resolve.rules.ts */
function isProductSellable(
  categoryIsActive,
  productStatus,
  categorySellEnabled = true,
) {
  return categoryIsActive && categorySellEnabled && productStatus === 'ACTIVE';
}

function productCategoryConflicts(productCategoryCode, requestedCategoryCode) {
  if (!requestedCategoryCode) return false;
  return productCategoryCode.toUpperCase() !== requestedCategoryCode.toUpperCase();
}

function isListingKind(value) {
  return ['GOODS', 'SUPPLIES', 'SERVICE'].includes(value);
}

describe('product-resolve.rules', () => {
  it('allows sell when category active, sell-enabled, and product ACTIVE', () => {
    assert.equal(isProductSellable(true, 'ACTIVE', true), true);
    assert.equal(isProductSellable(true, 'ACTIVE'), true);
  });

  it('blocks sell for COMING_SOON / INACTIVE / DISCONTINUED', () => {
    assert.equal(isProductSellable(true, 'COMING_SOON', true), false);
    assert.equal(isProductSellable(true, 'INACTIVE', true), false);
    assert.equal(isProductSellable(true, 'DISCONTINUED', true), false);
  });

  it('blocks sell when category inactive even if product ACTIVE', () => {
    assert.equal(isProductSellable(false, 'ACTIVE', true), false);
  });

  it('blocks sell when category sell_enabled is false', () => {
    assert.equal(isProductSellable(true, 'ACTIVE', false), false);
  });

  it('detects category/product code conflicts case-insensitively', () => {
    assert.equal(productCategoryConflicts('COFFEE', 'CEREALS'), true);
    assert.equal(productCategoryConflicts('COFFEE', 'coffee'), false);
    assert.equal(productCategoryConflicts('COFFEE', undefined), false);
  });

  it('validates listing kinds', () => {
    assert.equal(isListingKind('GOODS'), true);
    assert.equal(isListingKind('SUPPLIES'), true);
    assert.equal(isListingKind('SERVICE'), true);
    assert.equal(isListingKind('PRODUCE'), false);
  });
});
