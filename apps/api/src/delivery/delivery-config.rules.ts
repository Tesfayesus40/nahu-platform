/**
 * Pure helpers for Delivery D1 config defaults (unit-tested without DB).
 * Runtime reads go through DeliveryConfigService + Prisma.
 */

export function parseEarningFlatEtb(raw: string | null | undefined): number {
  if (raw == null || raw === '') {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function resolveFlagEnabled(
  flag: { enabled: boolean } | null | undefined,
  defaultEnabled: boolean,
): boolean {
  if (!flag) {
    return defaultEnabled;
  }
  return flag.enabled;
}

export function isCourierOtpBlockedByFlag(
  role: string,
  flag: { enabled: boolean } | null | undefined,
): boolean {
  if (role !== 'COURIER') {
    return false;
  }
  // Missing flag → not blocked (pre-migrate). Explicit false → blocked.
  return Boolean(flag && !flag.enabled);
}
