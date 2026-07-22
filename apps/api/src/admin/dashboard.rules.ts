export const DASHBOARD_TREND_DAYS = 14;

export type TrendPoint = { date: string; count: number };

/** Build a continuous date series filling missing days with 0. */
export function fillDailySeries(
  rows: Array<{ day: string | Date; count: number | bigint }>,
  days: number,
  end: Date = new Date(),
): TrendPoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key =
      typeof row.day === 'string'
        ? row.day.slice(0, 10)
        : row.day.toISOString().slice(0, 10);
    map.set(key, Number(row.count));
  }

  const out: TrendPoint[] = [];
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

export function sumSeries(points: TrendPoint[]): number {
  return points.reduce((acc, p) => acc + p.count, 0);
}

/** Operational KPI: open queue pressure = open + escalated weight. */
export function disputePressure(byStatus: Record<string, number>): number {
  return (
    (byStatus.OPEN ?? 0) +
    (byStatus.UNDER_REVIEW ?? 0) +
    (byStatus.ESCALATED ?? 0) * 2
  );
}
