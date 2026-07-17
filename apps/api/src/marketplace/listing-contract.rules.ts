/**
 * Pure G1 listing contract rules — unit dual-write + coffee extension requirements.
 * Free of Nest/Prisma for unit testing.
 */

export type ListingQuantityInput = {
  quantity?: number;
  unitCode?: string;
  pricePerUnit?: number;
  quantityKg?: number;
  pricePerKg?: number;
};

export type ResolvedListingQuantity = {
  quantity: number;
  unitCode: string;
  pricePerUnit: number;
  quantityKg: number;
  pricePerKg: number;
};

export class ListingContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ListingContractError';
  }
}

/** Resolve modern unit fields and/or legacy kg fields into a dual-written set. */
export function resolveListingQuantity(input: ListingQuantityInput): ResolvedListingQuantity {
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
    const quantityKg =
      unitCode === 'KG'
        ? (input.quantityKg ?? input.quantity)
        : (input.quantityKg ?? input.quantity);
    const pricePerKg =
      unitCode === 'KG'
        ? (input.pricePerKg ?? input.pricePerUnit)
        : (input.pricePerKg ?? input.pricePerUnit);

    // Non-KG listings still populate kg columns for NOT NULL legacy schema;
    // values mirror the canonical unit qty/price until kg columns are dropped.
    return {
      quantity: input.quantity,
      unitCode,
      pricePerUnit: input.pricePerUnit,
      quantityKg,
      pricePerKg,
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

export type CoffeeExtensionInput = {
  qualityGrade?: string;
  grade?: string;
  processMethod?: string;
  cupScore?: number;
  washingStation?: string;
  cooperative?: string;
  altitudeM?: number;
  variety?: string;
};

/** Coffee extension requires quality grade + process method. */
export function assertCoffeeExtensionRequirements(input: CoffeeExtensionInput): {
  grade: string;
  processMethod: string;
} {
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

export function buildCoffeeExtension(listing: {
  processMethod?: string | null;
  cupScore?: number | null;
  washingStation?: string | null;
  cooperative?: string | null;
  altitudeM?: number | null;
  variety?: string | null;
}) {
  return {
    processMethod: listing.processMethod ?? null,
    cupScore: listing.cupScore ?? null,
    washingStation: listing.washingStation ?? null,
    cooperative: listing.cooperative ?? null,
    altitudeM: listing.altitudeM ?? null,
    variety: listing.variety ?? null,
  };
}
