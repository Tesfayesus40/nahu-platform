import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/delivery/delivery-config.rules.ts */

function parseEarningFlatEtb(raw) {
  if (raw == null || raw === '') {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function resolveFlagEnabled(flag, defaultEnabled) {
  if (!flag) {
    return defaultEnabled;
  }
  return flag.enabled;
}

function isCourierOtpBlockedByFlag(role, flag) {
  if (role !== 'COURIER') {
    return false;
  }
  return Boolean(flag && !flag.enabled);
}

describe('delivery-config.rules (D1)', () => {
  it('parseEarningFlatEtb accepts numeric strings', () => {
    assert.equal(parseEarningFlatEtb('150.5'), 150.5);
    assert.equal(parseEarningFlatEtb('0'), 0);
  });

  it('parseEarningFlatEtb falls back for empty or invalid', () => {
    assert.equal(parseEarningFlatEtb(null), 0);
    assert.equal(parseEarningFlatEtb(''), 0);
    assert.equal(parseEarningFlatEtb('abc'), 0);
  });

  it('resolveFlagEnabled uses defaults when flag missing', () => {
    assert.equal(resolveFlagEnabled(null, true), true);
    assert.equal(resolveFlagEnabled(undefined, false), false);
    assert.equal(resolveFlagEnabled({ enabled: false }, true), false);
    assert.equal(resolveFlagEnabled({ enabled: true }, false), true);
  });

  it('isCourierOtpBlockedByFlag only blocks COURIER when flag off', () => {
    assert.equal(isCourierOtpBlockedByFlag('FARMER', { enabled: false }), false);
    assert.equal(isCourierOtpBlockedByFlag('COURIER', null), false);
    assert.equal(isCourierOtpBlockedByFlag('COURIER', { enabled: true }), false);
    assert.equal(isCourierOtpBlockedByFlag('COURIER', { enabled: false }), true);
  });
});
