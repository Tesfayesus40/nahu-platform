/** Pure helpers for Phase 4.6 dashboard alert / production rules (node:test). */

export const OPEN_ORDER_STATUSES = new Set(['PENDING_PAYMENT', 'PAID_ESCROW']);
export const PRODUCTION_STATUSES = new Set(['PLANNED', 'IN_PROGRESS', 'HARVESTED']);
export const ALERT_CAP = 20;

export function availableQty(onHand, reserved) {
  return Math.max(0, Number(onHand) - Number(reserved));
}

export function isLowInventory(onHand, reserved) {
  const oh = Number(onHand);
  const rs = Number(reserved);
  const avail = availableQty(oh, rs);
  if (avail <= 0 && (oh > 0 || rs > 0)) return true;
  if (oh > 0 && avail < oh * 0.1) return true;
  return false;
}

/** days from `today` (UTC date) to `endsOn` (Date or ISO). */
export function daysUntilEnd(endsOn, today = new Date()) {
  const end = new Date(endsOn);
  end.setUTCHours(0, 0, 0, 0);
  const t = new Date(today);
  t.setUTCHours(0, 0, 0, 0);
  return Math.round((end - t) / 86400000);
}

export function isOverdueProductionPlan(status, endsOn, attainmentPct, today = new Date()) {
  if (status !== 'PLANNED' && status !== 'IN_PROGRESS') return false;
  if (daysUntilEnd(endsOn, today) >= 0) return false;
  const pct = attainmentPct == null ? 0 : Number(attainmentPct);
  return pct < 100;
}

export function isUpcomingHarvest(status, endsOn, today = new Date()) {
  if (status !== 'PLANNED' && status !== 'IN_PROGRESS') return false;
  const d = daysUntilEnd(endsOn, today);
  return d >= 0 && d <= 14;
}

export function rankSeverity(severity) {
  if (severity === 'ACTION') return 0;
  if (severity === 'WARNING') return 1;
  return 2;
}

export function capAlerts(alerts, cap = ALERT_CAP) {
  return [...alerts]
    .sort((a, b) => rankSeverity(a.severity) - rankSeverity(b.severity))
    .slice(0, cap);
}

export function productionEmptyState(activeCycleCount) {
  if (activeCycleCount > 0) return null;
  return {
    code: 'NO_CURRENT_PLAN',
    messageEn: 'No production plan for this season yet.',
    messageAm:
      '\u1208\u12da\u1205\u0020\u12c8\u1245\u1275\u0020\u12e8\u121d\u122d\u1275\u0020\u12d5\u1245\u12f5\u0020\u12e8\u1208\u121d\u1362',
  };
}
