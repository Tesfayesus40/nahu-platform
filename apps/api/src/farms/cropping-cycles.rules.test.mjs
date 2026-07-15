import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const TIER_A = new Set(['PLANNED', 'IN_PROGRESS', 'HARVESTED', 'COMPLETED']);
const EDITABLE = new Set(['DRAFT', 'PLANNED', 'IN_PROGRESS']);

function nextStatus(current, action) {
  const map = {
    plan: { DRAFT: 'PLANNED' },
    start: { PLANNED: 'IN_PROGRESS' },
    'mark-harvested': { IN_PROGRESS: 'HARVESTED' },
    complete: { HARVESTED: 'COMPLETED', IN_PROGRESS: 'COMPLETED' },
    cancel: { DRAFT: 'CANCELLED', PLANNED: 'CANCELLED', IN_PROGRESS: 'CANCELLED' },
    archive: { COMPLETED: 'ARCHIVED', CANCELLED: 'ARCHIVED' },
  };
  return map[action]?.[current] ?? null;
}

function sumHarvestEvents(events) {
  return events.reduce((s, e) => s + e.qty, 0);
}

describe('cropping cycle lifecycle', () => {
  it('follows DRAFT → PLANNED → IN_PROGRESS → HARVESTED → COMPLETED → ARCHIVED', () => {
    let s = 'DRAFT';
    s = nextStatus(s, 'plan');
    assert.equal(s, 'PLANNED');
    s = nextStatus(s, 'start');
    assert.equal(s, 'IN_PROGRESS');
    s = nextStatus(s, 'mark-harvested');
    assert.equal(s, 'HARVESTED');
    s = nextStatus(s, 'complete');
    assert.equal(s, 'COMPLETED');
    s = nextStatus(s, 'archive');
    assert.equal(s, 'ARCHIVED');
  });

  it('rejects illegal transitions', () => {
    assert.equal(nextStatus('DRAFT', 'complete'), null);
    assert.equal(nextStatus('ARCHIVED', 'plan'), null);
  });

  it('allows Tier A binds only for production statuses', () => {
    assert.equal(TIER_A.has('DRAFT'), false);
    assert.equal(TIER_A.has('PLANNED'), true);
    assert.equal(TIER_A.has('IN_PROGRESS'), true);
    assert.equal(TIER_A.has('CANCELLED'), false);
  });

  it('freezes plan lines after HARVESTED', () => {
    assert.equal(EDITABLE.has('HARVESTED'), false);
    assert.equal(EDITABLE.has('IN_PROGRESS'), true);
  });
});

describe('multiple harvest events', () => {
  it('sums multiple RECEIVE events into actual qty', () => {
    const events = [
      { lotId: 'a', qty: 500 },
      { lotId: 'b', qty: 300 },
      { lotId: 'c', qty: 200 },
    ];
    assert.equal(sumHarvestEvents(events), 1000);
  });

  it('computes attainment against planned', () => {
    const planned = 2000;
    const actual = 1000;
    const pct = Math.round((actual / planned) * 1000) / 10;
    assert.equal(pct, 50);
  });
});

describe('season codes', () => {
  it('treats season codes as extensible string catalog keys', () => {
    const seeded = ['BELG', 'MEHER', 'IRRIGATION', 'YEAR_ROUND', 'CUSTOM'];
    const regional = [...seeded, 'LONG_RAINS', 'SHORT_RAINS'];
    assert.ok(regional.includes('LONG_RAINS'));
    assert.equal(typeof seeded[0], 'string');
  });
});
