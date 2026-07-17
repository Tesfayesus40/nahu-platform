/**
 * Pure helpers for B2 listing search / seller shaping.
 * Kept separate so Node unit tests do not need Nest/Prisma.
 */

/**
 * Build Prisma `OR` clauses for keyword `q` against listing + related text.
 * Returns undefined when q is empty so callers can omit the OR entirely.
 */
export function buildListingKeywordOr(q?: string | null): Record<string, unknown>[] | undefined {
  const term = (q || '').trim();
  if (!term) return undefined;

  const contains = { contains: term, mode: 'insensitive' as const };

  return [
    { region: contains },
    { regionEn: contains },
    { woreda: contains },
    { variety: contains },
    { washingStation: contains },
    { cooperative: contains },
    { product: { is: { nameEn: contains } } },
    { product: { is: { nameAm: contains } } },
    { product: { is: { code: contains } } },
    { category: { is: { nameEn: contains } } },
    { category: { is: { nameAm: contains } } },
    { category: { is: { code: contains } } },
    { farmer: { is: { region: contains } } },
    { farmer: { is: { zone: contains } } },
    { farmer: { is: { woreda: contains } } },
    { farmer: { is: { user: { is: { firstName: contains } } } } },
    { farmer: { is: { user: { is: { lastName: contains } } } } },
    { farmer: { is: { user: { is: { middleName: contains } } } } },
    { farmer: { is: { cooperative: { is: { name: contains } } } } },
  ];
}

export function shapePublicFarmSummary(farm: any) {
  if (!farm) return null;
  return {
    id: farm.id,
    name: farm.name,
    nameAm: farm.nameAm ?? null,
    status: farm.status,
    region: farm.region,
    regionEn: farm.regionEn ?? null,
    zone: farm.zone ?? null,
    woreda: farm.woreda ?? null,
    kebele: farm.kebele ?? null,
    altitudeM: farm.altitudeM != null ? Number(farm.altitudeM) : null,
    sizeHa: farm.sizeHa != null ? Number(farm.sizeHa) : null,
  };
}

export function shapePublicCertificateSummary(cert: any) {
  if (!cert) return null;
  return {
    id: cert.id,
    certNumber: cert.certNumber,
    region: cert.region ?? null,
    qualityGrade: cert.grade ?? null,
    grade: cert.grade ?? null,
    processMethod: cert.processMethod ?? null,
    quantity: cert.quantity != null ? Number(cert.quantity) : (cert.quantityKg != null ? Number(cert.quantityKg) : null),
    unitCode: cert.unitCode ?? 'KG',
    quantityKg: cert.quantityKg != null ? Number(cert.quantityKg) : null,
    harvestDate: cert.harvestDate ?? null,
    createdAt: cert.createdAt ?? null,
  };
}

/** Future Seller Profile extension slots — null until later milestones. */
export function sellerProfileExtensions(verified: boolean) {
  return {
    ratings: null,
    reviews: null,
    verifiedSellerBadge: verified
      ? { type: 'verified', labelEn: 'Verified seller', labelAm: 'የተረጋገጠ ሻጭ' }
      : null,
    responseMetrics: null,
  };
}
