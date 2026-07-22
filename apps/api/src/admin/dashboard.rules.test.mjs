import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function fillDailySeries(rows, days, end = new Date('2026-07-22T12:00:00Z')) {
  const map = new Map();
  for (const row of rows) {
    const key =
      typeof row.day === 'string'
        ? row.day.slice(0, 10)
        : row.day.toISOString().slice(0, 10);
    map.set(key, Number(row.count));
  }
  const out = [];
  const cursor = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  );
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(cursor);
    d.setUTCDate(cursor.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

function sumSeries(points) {
  return points.reduce((acc, p) => acc + p.count, 0);
}

function disputePressure(byStatus) {
  return (
    (byStatus.OPEN ?? 0) +
    (byStatus.UNDER_REVIEW ?? 0) +
    (byStatus.ESCALATED ?? 0) * 2
  );
}

describe('fillDailySeries', () => {
  it('fills missing days with zero', () => {
    const series = fillDailySeries(
      [{ day: '2026-07-20', count: 3 }, { day: '2026-07-22', count: 1 }],
      3,
    );
    assert.equal(series.length, 3);
    assert.deepEqual(series, [
      { date: '2026-07-20', count: 3 },
      { date: '2026-07-21', count: 0 },
      { date: '2026-07-22', count: 1 },
    ]);
  });
});

describe('KPIs', () => {
  it('sums series and weights escalated disputes', () => {
    assert.equal(sumSeries([{ date: 'a', count: 2 }, { date: 'b', count: 5 }]), 7);
    assert.equal(
      disputePressure({ OPEN: 2, UNDER_REVIEW: 1, ESCALATED: 3, RESOLVED: 9 }),
      9,
    );
  });
});
