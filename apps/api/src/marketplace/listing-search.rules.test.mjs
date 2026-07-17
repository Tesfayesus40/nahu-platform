import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/marketplace/listing-search.rules.ts */
function buildListingKeywordOr(q) {
  const term = (q || '').trim();
  if (!term) return undefined;
  const contains = { contains: term, mode: 'insensitive' };
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

function shapePublicFarmSummary(farm) {
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

function shapePublicCertificateSummary(cert) {
  if (!cert) return null;
  return {
    id: cert.id,
    certNumber: cert.certNumber,
    region: cert.region ?? null,
    qualityGrade: cert.grade ?? null,
    grade: cert.grade ?? null,
    processMethod: cert.processMethod ?? null,
    quantity:
      cert.quantity != null
        ? Number(cert.quantity)
        : cert.quantityKg != null
          ? Number(cert.quantityKg)
          : null,
    unitCode: cert.unitCode ?? 'KG',
    quantityKg: cert.quantityKg != null ? Number(cert.quantityKg) : null,
    harvestDate: cert.harvestDate ?? null,
    createdAt: cert.createdAt ?? null,
  };
}

function sellerProfileExtensions(verified) {
  return {
    ratings: null,
    reviews: null,
    verifiedSellerBadge: verified
      ? { type: 'verified', labelEn: 'Verified seller', labelAm: 'የተረጋገጠ ሻጭ' }
      : null,
    responseMetrics: null,
  };
}

describe('listing-search.rules', () => {
  it('returns undefined for empty q', () => {
    assert.equal(buildListingKeywordOr(''), undefined);
    assert.equal(buildListingKeywordOr('   '), undefined);
    assert.equal(buildListingKeywordOr(null), undefined);
  });

  it('builds OR clauses for keyword search', () => {
    const or = buildListingKeywordOr('yirga');
    assert.ok(Array.isArray(or));
    assert.ok(or.length >= 10);
    assert.deepEqual(or[0], { region: { contains: 'yirga', mode: 'insensitive' } });
    assert.ok(or.some((c) => c.product && c.product.is?.nameEn));
    assert.ok(or.some((c) => c.farmer && c.farmer.is?.user));
  });

  it('shapes public farm and certificate summaries', () => {
    const farm = shapePublicFarmSummary({
      id: 'f1',
      name: 'Highlands',
      nameAm: null,
      status: 'ACTIVE',
      region: 'ሲዳማ',
      regionEn: 'Sidama',
      zone: 'Bensa',
      woreda: 'Chire',
      kebele: null,
      altitudeM: '1900',
      sizeHa: '2.5',
    });
    assert.equal(farm.name, 'Highlands');
    assert.equal(farm.altitudeM, 1900);
    assert.equal(farm.sizeHa, 2.5);

    const cert = shapePublicCertificateSummary({
      id: 'c1',
      certNumber: 'NBG-2026-1',
      region: 'Jimma',
      grade: 'GRADE_1',
      processMethod: 'WASHED',
      quantity: 10,
      unitCode: 'KG',
      quantityKg: 10,
      harvestDate: '2026-01-01',
      createdAt: '2026-07-01',
    });
    assert.equal(cert.certNumber, 'NBG-2026-1');
    assert.equal(cert.qualityGrade, 'GRADE_1');
    assert.equal(cert.quantity, 10);
  });

  it('exposes seller extension points', () => {
    const ext = sellerProfileExtensions(true);
    assert.equal(ext.ratings, null);
    assert.equal(ext.reviews, null);
    assert.equal(ext.responseMetrics, null);
    assert.equal(ext.verifiedSellerBadge.type, 'verified');
    assert.equal(sellerProfileExtensions(false).verifiedSellerBadge, null);
  });
});
