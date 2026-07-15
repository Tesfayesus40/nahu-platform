import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  availableQty,
  isLowInventory,
  isOverdueProductionPlan,
  isUpcomingHarvest,
  capAlerts,
  productionEmptyState,
} from './dashboard.rules.mjs';

describe('dashboard quantities', () => {
  it('floors available at 0', () => {
    assert.equal(availableQty(10, 4), 6);
    assert.equal(availableQty(5, 9), 0);
  });

  it('flags low inventory', () => {
    assert.equal(isLowInventory(100, 95), true);
    assert.equal(isLowInventory(0, 10), true);
    assert.equal(isLowInventory(100, 20), false);
    assert.equal(isLowInventory(0, 0), false);
  });
});

describe('dashboard production empty-state', () => {
  it('returns NO_CURRENT_PLAN when no active cycles', () => {
    const empty = productionEmptyState(0);
    assert.equal(empty.code, 'NO_CURRENT_PLAN');
    assert.ok(empty.messageEn);
    assert.ok(empty.messageAm);
  });

  it('returns null when cycles exist', () => {
    assert.equal(productionEmptyState(2), null);
  });
});

describe('dashboard alerts', () => {
  const today = new Date('2026-07-15T12:00:00Z');

  it('detects overdue production plans', () => {
    assert.equal(
      isOverdueProductionPlan('IN_PROGRESS', '2026-07-01', 40, today),
      true,
    );
    assert.equal(
      isOverdueProductionPlan('IN_PROGRESS', '2026-07-01', 100, today),
      false,
    );
    assert.equal(
      isOverdueProductionPlan('HARVESTED', '2026-07-01', 40, today),
      false,
    );
  });

  it('detects upcoming harvest within 14 days', () => {
    assert.equal(isUpcomingHarvest('PLANNED', '2026-07-20', today), true);
    assert.equal(isUpcomingHarvest('PLANNED', '2026-08-20', today), false);
    assert.equal(isUpcomingHarvest('DRAFT', '2026-07-20', today), false);
  });

  it('caps and prioritizes ACTION over WARNING', () => {
    const capped = capAlerts(
      [
        { code: 'A', severity: 'INFO' },
        { code: 'B', severity: 'ACTION' },
        { code: 'C', severity: 'WARNING' },
      ],
      2,
    );
    assert.equal(capped.length, 2);
    assert.equal(capped[0].severity, 'ACTION');
    assert.equal(capped[1].severity, 'WARNING');
  });
});
