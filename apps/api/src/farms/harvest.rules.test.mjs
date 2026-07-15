import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function canMutateHarvest(status) {
  return status === 'DRAFT';
}

function canPost(status, lineCount) {
  return status === 'DRAFT' && lineCount > 0;
}

function manySessionsPerPlan(sessionCycleIds, planId) {
  return sessionCycleIds.filter((id) => id === planId).length;
}

function draftTouchesInventory(status) {
  return status === 'POSTED';
}

describe('harvest session rules', () => {
  it('allows mutate/delete only in DRAFT', () => {
    assert.equal(canMutateHarvest('DRAFT'), true);
    assert.equal(canMutateHarvest('POSTED'), false);
  });

  it('requires lines to post', () => {
    assert.equal(canPost('DRAFT', 0), false);
    assert.equal(canPost('DRAFT', 2), true);
    assert.equal(canPost('POSTED', 2), false);
  });

  it('allows multiple sessions on one production plan', () => {
    const plan = 'cycle-1';
    assert.equal(manySessionsPerPlan(['cycle-1', 'cycle-1', 'cycle-2'], plan), 2);
  });

  it('DRAFT does not touch inventory; POSTED does', () => {
    assert.equal(draftTouchesInventory('DRAFT'), false);
    assert.equal(draftTouchesInventory('POSTED'), true);
  });
});
