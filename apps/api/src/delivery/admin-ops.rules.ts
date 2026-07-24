/**
 * D6 — Admin delivery operations rules (pure).
 * Controllers/UI must not reimplement; AdminOpsService orchestrates services.
 */

import {
  ShipmentStatus,
  canTransitionShipmentStatus,
  isShipmentStatus,
  isTerminalShipmentStatus,
} from './shipment.domain.rules';

export type OpsBucket =
  | 'AWAITING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'BUYER_CONFIRMATION_PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETURNED'
  | 'CANCELLED';

/** UI/ops buckets → underlying shipment statuses. */
export const OPS_STATUS_BUCKETS: Record<OpsBucket, readonly ShipmentStatus[]> = {
  AWAITING_ASSIGNMENT: ['CREATED', 'AWAITING_ASSIGNMENT'],
  ASSIGNED: ['ASSIGNED', 'ACCEPTED'],
  IN_TRANSIT: ['PICKED_UP', 'IN_TRANSIT'],
  ARRIVED: ['ARRIVED'],
  DELIVERED: ['DELIVERED'],
  BUYER_CONFIRMATION_PENDING: ['BUYER_CONFIRMED'],
  COMPLETED: ['COMPLETED'],
  FAILED: ['FAILED'],
  RETURNED: ['RETURNED'],
  CANCELLED: ['CANCELLED'],
};

export const OPS_BUCKETS = Object.keys(OPS_STATUS_BUCKETS) as OpsBucket[];

export type AdminOpsErrorCode =
  | 'SHIPMENT_NOT_FOUND'
  | 'COURIER_NOT_FOUND'
  | 'INVALID_STATUS'
  | 'CANCEL_NOT_ALLOWED'
  | 'RETRY_NOT_ALLOWED'
  | 'ILLEGAL_TRANSITION';

export class AdminOpsDomainError extends Error {
  constructor(
    public readonly code: AdminOpsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AdminOpsDomainError';
  }
}

export function isOpsBucket(value: string): value is OpsBucket {
  return (OPS_BUCKETS as readonly string[]).includes(value);
}

export function statusesForBucket(bucket: string): ShipmentStatus[] | null {
  if (!isOpsBucket(bucket)) return null;
  return [...OPS_STATUS_BUCKETS[bucket]];
}

export function bucketForStatus(status: string): OpsBucket | null {
  if (!isShipmentStatus(status)) return null;
  for (const bucket of OPS_BUCKETS) {
    if (OPS_STATUS_BUCKETS[bucket].includes(status)) return bucket;
  }
  return null;
}

/** Statuses where admin may cancel (domain allows → CANCELLED). */
export function assertCanCancelShipment(status: string): void {
  if (!isShipmentStatus(status)) {
    throw new AdminOpsDomainError(
      'INVALID_STATUS',
      `Invalid shipment status ${status}`,
    );
  }
  if (status === 'CANCELLED') {
    throw new AdminOpsDomainError(
      'CANCEL_NOT_ALLOWED',
      'Shipment is already cancelled',
    );
  }
  if (status === 'COMPLETED') {
    throw new AdminOpsDomainError(
      'CANCEL_NOT_ALLOWED',
      'Completed shipments cannot be cancelled',
    );
  }
  if (status === 'RETURNED') {
    throw new AdminOpsDomainError(
      'CANCEL_NOT_ALLOWED',
      'Returned shipments cannot be cancelled',
    );
  }
  if (!canTransitionShipmentStatus(status, 'CANCELLED')) {
    throw new AdminOpsDomainError(
      'CANCEL_NOT_ALLOWED',
      `Cannot cancel shipment in status ${status}`,
    );
  }
}

/** FAILED → AWAITING_ASSIGNMENT retry path. */
export function assertCanRetryFailedShipment(status: string): void {
  if (!isShipmentStatus(status)) {
    throw new AdminOpsDomainError(
      'INVALID_STATUS',
      `Invalid shipment status ${status}`,
    );
  }
  if (status !== 'FAILED') {
    throw new AdminOpsDomainError(
      'RETRY_NOT_ALLOWED',
      `Retry is only allowed from FAILED (got ${status})`,
    );
  }
  if (!canTransitionShipmentStatus('FAILED', 'AWAITING_ASSIGNMENT')) {
    throw new AdminOpsDomainError(
      'ILLEGAL_TRANSITION',
      'Cannot retry FAILED → AWAITING_ASSIGNMENT',
    );
  }
}

export function startOfUtcDay(d = new Date()): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * Average duration (ms) from assigned/accepted start to delivered/completed.
 * Uses event stream when timestamps are present.
 */
export function averageDurationMs(
  rows: ReadonlyArray<{ startAt: Date | null; endAt: Date | null }>,
): number | null {
  const durations: number[] = [];
  for (const row of rows) {
    if (!row.startAt || !row.endAt) continue;
    const ms = row.endAt.getTime() - row.startAt.getTime();
    if (ms >= 0) durations.push(ms);
  }
  if (durations.length === 0) return null;
  return Math.round(
    durations.reduce((a, b) => a + b, 0) / durations.length,
  );
}

export function courierUtilization(input: {
  onlineCouriers: number;
  totalActiveCouriers: number;
  couriersWithActiveShipments: number;
}): {
  onlineRate: number | null;
  busyRate: number | null;
} {
  const total = input.totalActiveCouriers;
  if (total <= 0) {
    return { onlineRate: null, busyRate: null };
  }
  return {
    onlineRate: Math.round((input.onlineCouriers / total) * 1000) / 10,
    busyRate:
      Math.round((input.couriersWithActiveShipments / total) * 1000) / 10,
  };
}

export function isTerminalForOps(status: string): boolean {
  return (
    isShipmentStatus(status) &&
    isTerminalShipmentStatus(status as ShipmentStatus)
  );
}

/** Statuses considered "in transit" for SLA delay monitoring. */
export const DELAY_IN_TRANSIT_STATUSES: readonly ShipmentStatus[] = [
  'PICKED_UP',
  'IN_TRANSIT',
];

/** Statuses awaiting dropoff completion / POD (no AI — age-based only). */
export const DELAY_POD_PENDING_STATUSES: readonly ShipmentStatus[] = [
  'ARRIVED',
  'DELIVERED',
];

export function parsePositiveHours(raw: string, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 168);
}

export function staleCutoff(hours: number, now = new Date()): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export type OpsAlertSeverity = 'ok' | 'warn' | 'critical';

export function evaluateThresholdAlert(input: {
  code: string;
  label: string;
  value: number;
  warnAbove: number;
  criticalAbove: number;
}): {
  code: string;
  label: string;
  value: number;
  warnAbove: number;
  criticalAbove: number;
  severity: OpsAlertSeverity;
} {
  let severity: OpsAlertSeverity = 'ok';
  if (input.value >= input.criticalAbove) severity = 'critical';
  else if (input.value >= input.warnAbove) severity = 'warn';
  return { ...input, severity };
}

/** Prefer completed events only — delivered+completed same day must not double-count. */
export function completedTodayFromEvents(
  eventToday: Record<string, number>,
): number {
  return eventToday['delivery.shipment.completed'] ?? 0;
}

export const BULK_OPS_MAX = 20;

export type BulkOpsAction = 'cancel' | 'retry';

export function assertBulkOpsAction(action: string): BulkOpsAction {
  if (action !== 'cancel' && action !== 'retry') {
    throw new AdminOpsDomainError(
      'INVALID_STATUS',
      `Unsupported bulk action ${action}`,
    );
  }
  return action;
}
