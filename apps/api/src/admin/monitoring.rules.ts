export type MetricSnapshot = Record<string, number>;

export type AlertLevel = 'OK' | 'WARN' | 'CRITICAL';

export function evaluateThreshold(
  value: number,
  warnAbove: number | null,
  criticalAbove: number | null,
): AlertLevel {
  if (criticalAbove != null && value >= criticalAbove) return 'CRITICAL';
  if (warnAbove != null && value >= warnAbove) return 'WARN';
  return 'OK';
}

export function unreadNotificationCount(
  items: Array<{ readAt: Date | null }>,
): number {
  return items.filter((i) => !i.readAt).length;
}
