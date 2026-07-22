import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function evaluateThreshold(value, warnAbove, criticalAbove) {
  if (criticalAbove != null && value >= criticalAbove) return 'CRITICAL';
  if (warnAbove != null && value >= warnAbove) return 'WARN';
  return 'OK';
}

describe('evaluateThreshold', () => {
  it('returns OK / WARN / CRITICAL', () => {
    assert.equal(evaluateThreshold(1, 10, 50), 'OK');
    assert.equal(evaluateThreshold(10, 10, 50), 'WARN');
    assert.equal(evaluateThreshold(50, 10, 50), 'CRITICAL');
  });
});
