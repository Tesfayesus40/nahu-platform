import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function assertOnFarmHasFarm(siteType, farmId) {
  if (siteType === 'ON_FARM' && !farmId) {
    throw new Error('ON_FARM site requires farmId');
  }
}

function canRelocateSameFarm(lotFarmId, toSite) {
  if (toSite.siteType === 'ON_FARM' && toSite.farmId && toSite.farmId !== lotFarmId) {
    return false;
  }
  return true;
}

describe('warehouse ON_FARM rules', () => {
  it('requires farmId for ON_FARM', () => {
    assert.throws(() => assertOnFarmHasFarm('ON_FARM', null), /requires farmId/);
    assert.doesNotThrow(() => assertOnFarmHasFarm('ON_FARM', 'farm-1'));
  });

  it('allows COOPERATIVE without farmId', () => {
    assert.doesNotThrow(() => assertOnFarmHasFarm('COOPERATIVE', null));
  });
});

describe('warehouse RELOCATE vs TRANSFER', () => {
  it('blocks ON_FARM relocate across farms', () => {
    assert.equal(
      canRelocateSameFarm('farm-a', { siteType: 'ON_FARM', farmId: 'farm-b' }),
      false,
    );
  });

  it('allows relocate within same farm', () => {
    assert.equal(
      canRelocateSameFarm('farm-a', { siteType: 'ON_FARM', farmId: 'farm-a' }),
      true,
    );
  });
});
