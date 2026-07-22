import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const REPORT_TYPES = [
  'orders.summary',
  'delivery.exceptions',
  'audit.events',
  'verification.pending',
  'listings.moderation',
];

function isKnownReportType(value) {
  return REPORT_TYPES.includes(value);
}

function toCsv(header, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}

describe('reporting rules', () => {
  it('validates known report types and builds csv', () => {
    assert.equal(isKnownReportType('orders.summary'), true);
    assert.equal(isKnownReportType('ai.future'), false);
    assert.equal(
      toCsv(['a', 'b'], [[1, 'x'], [2, 'y,z']]),
      'a,b\n1,x\n2,"y,z"',
    );
  });
});
