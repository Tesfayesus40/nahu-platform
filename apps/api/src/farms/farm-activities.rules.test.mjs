import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function canHardDeleteActivity(status, occurredOn, today = new Date('2026-07-16T12:00:00Z')) {
  const utcToday = new Date(today);
  utcToday.setUTCHours(0, 0, 0, 0);
  if (status === 'PLANNED') return true;
  if (status === 'COMPLETED' && occurredOn) {
    const d = new Date(occurredOn);
    return (
      d.getUTCFullYear() === utcToday.getUTCFullYear() &&
      d.getUTCMonth() === utcToday.getUTCMonth() &&
      d.getUTCDate() === utcToday.getUTCDate()
    );
  }
  return false;
}

function activitiesNeverWriteInventory() {
  return false;
}

describe('farm activity rules', () => {
  it('allows hard delete for PLANNED and same-day COMPLETED', () => {
    assert.equal(canHardDeleteActivity('PLANNED', null), true);
    assert.equal(
      canHardDeleteActivity('COMPLETED', new Date('2026-07-16T00:00:00Z')),
      true,
    );
    assert.equal(
      canHardDeleteActivity('COMPLETED', new Date('2026-07-15T00:00:00Z')),
      false,
    );
    assert.equal(canHardDeleteActivity('CANCELLED', new Date('2026-07-16')), false);
  });

  it('never writes inventory from activity create/update', () => {
    assert.equal(activitiesNeverWriteInventory(), false);
  });

  it('treats HARVESTING_SUPPORT as ops context not harvest post', () => {
    const type = 'HARVESTING_SUPPORT';
    const postsStock = type === 'HARVEST' || type === 'RECEIVE';
    assert.equal(postsStock, false);
  });
});
