/**
 * Pure B1 order quantity resolution — dual-write with listing unit.
 */

export type OrderQuantityInput = {
  quantity?: number;
  unitCode?: string;
  quantityKg?: number;
};

export type ListingQuantitySnapshot = {
  quantity?: number | null;
  unitCode?: string | null;
  quantityKg: number;
  pricePerUnit?: number | null;
  pricePerKg: number;
};

export type ResolvedOrderQuantity = {
  quantity: number;
  unitCode: string;
  quantityKg: number;
  pricePerUnit: number;
  totalEtb: number;
};

export class OrderContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderContractError';
  }
}

export function resolveOrderQuantity(
  input: OrderQuantityInput,
  listing: ListingQuantitySnapshot,
): ResolvedOrderQuantity {
  const listingUnit = (listing.unitCode || 'KG').toUpperCase();
  const pricePerUnit = Number(listing.pricePerUnit ?? listing.pricePerKg);
  const available = Number(listing.quantity ?? listing.quantityKg);

  const hasModern = input.quantity !== undefined || input.unitCode !== undefined;
  const hasLegacy = input.quantityKg !== undefined;

  let quantity: number;
  let unitCode: string;

  if (hasModern) {
    if (input.quantity === undefined) {
      throw new OrderContractError('quantity is required when using unit-aware order fields');
    }
    quantity = input.quantity;
    unitCode = (input.unitCode || listingUnit).toUpperCase();
  } else if (hasLegacy) {
    quantity = input.quantityKg!;
    unitCode = 'KG';
  } else {
    throw new OrderContractError('Provide quantity or quantityKg');
  }

  if (quantity <= 0) {
    throw new OrderContractError('quantity must be greater than zero');
  }
  if (unitCode !== listingUnit) {
    throw new OrderContractError(
      `unitCode ${unitCode} does not match listing unit ${listingUnit}`,
    );
  }
  if (quantity > available) {
    throw new OrderContractError(`Only ${available} ${listingUnit} available`);
  }

  const quantityKg = listingUnit === 'KG' ? quantity : quantity;
  const totalEtb = pricePerUnit * quantity;

  return {
    quantity,
    unitCode,
    quantityKg,
    pricePerUnit,
    totalEtb,
  };
}
