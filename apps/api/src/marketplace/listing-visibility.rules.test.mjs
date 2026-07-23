import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors owner-aware listing detail visibility in MarketplaceService.getListingById */

function canViewListingDetail(listing, viewerUserId) {
  if (!listing) return false;
  const isOwner = Boolean(viewerUserId) && listing.farmerUserId === viewerUserId;
  if (isOwner) return true;
  return listing.status === 'ACTIVE' && listing.moderationStatus === 'APPROVED';
}

describe('canViewListingDetail', () => {
  const pending = {
    status: 'ACTIVE',
    moderationStatus: 'PENDING',
    farmerUserId: 'farmer-1',
  };

  it('hides pending listings from anonymous and other users', () => {
    assert.equal(canViewListingDetail(pending), false);
    assert.equal(canViewListingDetail(pending, 'buyer-1'), false);
  });

  it('allows the owner to view pending listings', () => {
    assert.equal(canViewListingDetail(pending, 'farmer-1'), true);
  });

  it('allows public view of approved active listings', () => {
    assert.equal(
      canViewListingDetail({
        status: 'ACTIVE',
        moderationStatus: 'APPROVED',
        farmerUserId: 'farmer-1',
      }),
      true,
    );
  });
});
