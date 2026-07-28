/**
 * Pure rules for product sellability and category/product conflicts.
 * Kept free of Nest/Prisma so they can be unit-tested without a database.
 */

export type ProductLifecycleStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'COMING_SOON'
  | 'DISCONTINUED';

/**
 * A product may be sold when its category is active, sell_enabled, and the
 * product lifecycle status is ACTIVE. `sellEnabled` defaults to true for
 * callers that predate G2 (treat missing as enabled).
 */
export function isProductSellable(
  categoryIsActive: boolean,
  productStatus: ProductLifecycleStatus,
  categorySellEnabled: boolean = true,
): boolean {
  return categoryIsActive && categorySellEnabled && productStatus === 'ACTIVE';
}

export function productCategoryConflicts(
  productCategoryCode: string,
  requestedCategoryCode?: string,
): boolean {
  if (!requestedCategoryCode) return false;
  return productCategoryCode.toUpperCase() !== requestedCategoryCode.toUpperCase();
}

export const LISTING_KINDS = ['GOODS', 'SUPPLIES', 'SERVICE'] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

export function isListingKind(value: string): value is ListingKind {
  return (LISTING_KINDS as readonly string[]).includes(value);
}
