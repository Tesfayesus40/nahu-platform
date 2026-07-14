/**
 * Pure rules for product sellability and category/product conflicts.
 * Kept free of Nest/Prisma so they can be unit-tested without a database.
 */

export type ProductLifecycleStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'COMING_SOON'
  | 'DISCONTINUED';

export function isProductSellable(
  categoryIsActive: boolean,
  productStatus: ProductLifecycleStatus,
): boolean {
  return categoryIsActive && productStatus === 'ACTIVE';
}

export function productCategoryConflicts(
  productCategoryCode: string,
  requestedCategoryCode?: string,
): boolean {
  if (!requestedCategoryCode) return false;
  return productCategoryCode.toUpperCase() !== requestedCategoryCode.toUpperCase();
}
