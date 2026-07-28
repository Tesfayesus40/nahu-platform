/**
 * Pure helpers for G7 Seller Party foundation.
 */

export type SellerTypeCode =
  | 'FARMER'
  | 'INDIVIDUAL'
  | 'COOPERATIVE'
  | 'BUSINESS'
  | 'COMPANY'
  | 'ORGANISATION';

export function buildFarmerDisplayName(input: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  region?: string | null;
}): string {
  const name = [input.firstName, input.middleName, input.lastName]
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  if (name) return name;
  if (input.region) return `Farmer — ${input.region}`;
  return 'Farmer';
}

export function buildFarmerAddressText(input: {
  woreda?: string | null;
  zone?: string | null;
  region?: string | null;
}): string | null {
  const parts = [input.woreda, input.zone, input.region]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** True when the acting user may manage a listing owned by farmer/seller. */
export function canManageListing(opts: {
  actorUserId: string;
  listingFarmerUserId?: string | null;
  listingSellerOwnerUserId?: string | null;
}): boolean {
  if (
    opts.listingSellerOwnerUserId &&
    opts.listingSellerOwnerUserId === opts.actorUserId
  ) {
    return true;
  }
  if (
    opts.listingFarmerUserId &&
    opts.listingFarmerUserId === opts.actorUserId
  ) {
    return true;
  }
  return false;
}
