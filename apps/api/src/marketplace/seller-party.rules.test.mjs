import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function buildFarmerDisplayName(input) {
  const name = [input.firstName, input.middleName, input.lastName]
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  if (name) return name;
  if (input.region) return `Farmer — ${input.region}`;
  return 'Farmer';
}

function buildFarmerAddressText(input) {
  const parts = [input.woreda, input.zone, input.region]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function canManageListing(opts) {
  if (opts.listingSellerOwnerUserId && opts.listingSellerOwnerUserId === opts.actorUserId) {
    return true;
  }
  if (opts.listingFarmerUserId && opts.listingFarmerUserId === opts.actorUserId) {
    return true;
  }
  return false;
}

describe('seller-party.rules', () => {
  it('builds display name from user names', () => {
    assert.equal(
      buildFarmerDisplayName({ firstName: 'Abebe', lastName: 'Kebede' }),
      'Abebe Kebede',
    );
  });

  it('falls back to region when names missing', () => {
    assert.equal(buildFarmerDisplayName({ region: 'Sidama' }), 'Farmer — Sidama');
  });

  it('builds address text', () => {
    assert.equal(
      buildFarmerAddressText({ woreda: 'Yirga', zone: 'Gedeo', region: 'SNNPR' }),
      'Yirga, Gedeo, SNNPR',
    );
  });

  it('authorizes via seller party owner or farmer user', () => {
    assert.equal(
      canManageListing({
        actorUserId: 'u1',
        listingSellerOwnerUserId: 'u1',
        listingFarmerUserId: 'u2',
      }),
      true,
    );
    assert.equal(
      canManageListing({
        actorUserId: 'u1',
        listingSellerOwnerUserId: 'u9',
        listingFarmerUserId: 'u1',
      }),
      true,
    );
    assert.equal(
      canManageListing({
        actorUserId: 'u1',
        listingSellerOwnerUserId: 'u9',
        listingFarmerUserId: 'u8',
      }),
      false,
    );
  });
});
