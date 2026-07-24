/**
 * D4 — Dispatch domain rules (pure).
 * Controllers must not reimplement these; DispatchService is the sole owner.
 */

import {
  ShipmentStatus,
  canTransitionShipmentStatus,
  isShipmentStatus,
} from './shipment.domain.rules';

/** Workload-counting statuses (active courier jobs through execution). */
export const DISPATCH_ACTIVE_STATUSES: readonly ShipmentStatus[] = [
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'BUYER_CONFIRMED',
] as const;

export const DEFAULT_MAX_ACTIVE_SHIPMENTS = 3;

export type DispatchErrorCode =
  | 'SHIPMENT_NOT_FOUND'
  | 'COURIER_NOT_FOUND'
  | 'COURIER_INACTIVE'
  | 'COURIER_NOT_ONLINE'
  | 'COURIER_WORKLOAD_EXCEEDED'
  | 'INVALID_STATUS_FOR_ASSIGN'
  | 'INVALID_STATUS_FOR_REASSIGN'
  | 'INVALID_STATUS_FOR_UNASSIGN'
  | 'INVALID_STATUS_FOR_ACCEPT'
  | 'INVALID_STATUS_FOR_REJECT'
  | 'ACTIVE_ASSIGNMENT_EXISTS'
  | 'NO_ACTIVE_ASSIGNMENT'
  | 'ASSIGNMENT_WRONG_COURIER'
  | 'ILLEGAL_TRANSITION'
  | 'NO_ELIGIBLE_COURIER';

export class DispatchDomainError extends Error {
  constructor(
    public readonly code: DispatchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DispatchDomainError';
  }
}

export function isDispatchActiveStatus(status: string): boolean {
  return (DISPATCH_ACTIVE_STATUSES as readonly string[]).includes(status);
}

export function assertCanAssign(input: {
  shipmentStatus: string;
  hasActiveAssignment: boolean;
}): void {
  if (!isShipmentStatus(input.shipmentStatus)) {
    throw new DispatchDomainError(
      'ILLEGAL_TRANSITION',
      `Invalid shipment status ${input.shipmentStatus}`,
    );
  }
  if (input.shipmentStatus !== 'AWAITING_ASSIGNMENT') {
    throw new DispatchDomainError(
      'INVALID_STATUS_FOR_ASSIGN',
      `Shipment must be AWAITING_ASSIGNMENT to assign (got ${input.shipmentStatus})`,
    );
  }
  if (input.hasActiveAssignment) {
    throw new DispatchDomainError(
      'ACTIVE_ASSIGNMENT_EXISTS',
      'Shipment already has an active assignment; use reassign',
    );
  }
  if (!canTransitionShipmentStatus('AWAITING_ASSIGNMENT', 'ASSIGNED')) {
    throw new DispatchDomainError(
      'ILLEGAL_TRANSITION',
      'Cannot transition AWAITING_ASSIGNMENT → ASSIGNED',
    );
  }
}

export function assertCanReassign(input: {
  shipmentStatus: string;
  hasActiveAssignment: boolean;
}): void {
  if (!isShipmentStatus(input.shipmentStatus)) {
    throw new DispatchDomainError(
      'ILLEGAL_TRANSITION',
      `Invalid shipment status ${input.shipmentStatus}`,
    );
  }
  const allowed: ShipmentStatus[] = ['ASSIGNED', 'ACCEPTED'];
  if (!allowed.includes(input.shipmentStatus as ShipmentStatus)) {
    throw new DispatchDomainError(
      'INVALID_STATUS_FOR_REASSIGN',
      `Shipment must be ASSIGNED or ACCEPTED to reassign (got ${input.shipmentStatus})`,
    );
  }
  if (!input.hasActiveAssignment) {
    throw new DispatchDomainError(
      'NO_ACTIVE_ASSIGNMENT',
      'No active assignment to replace',
    );
  }
}

export function assertCanUnassign(input: {
  shipmentStatus: string;
  hasActiveAssignment: boolean;
}): void {
  if (!isShipmentStatus(input.shipmentStatus)) {
    throw new DispatchDomainError(
      'ILLEGAL_TRANSITION',
      `Invalid shipment status ${input.shipmentStatus}`,
    );
  }
  const allowed: ShipmentStatus[] = ['ASSIGNED', 'ACCEPTED'];
  if (!allowed.includes(input.shipmentStatus as ShipmentStatus)) {
    throw new DispatchDomainError(
      'INVALID_STATUS_FOR_UNASSIGN',
      `Shipment must be ASSIGNED or ACCEPTED to unassign (got ${input.shipmentStatus})`,
    );
  }
  if (!input.hasActiveAssignment) {
    throw new DispatchDomainError(
      'NO_ACTIVE_ASSIGNMENT',
      'No active assignment to clear',
    );
  }
}

export function assertCourierEligibleForDispatch(input: {
  exists: boolean;
  active: boolean;
  deleted: boolean;
  /** DB availability: AVAILABLE means ONLINE for dispatch */
  availabilityDb: string;
  activeShipmentCount: number;
  maxActiveShipments: number;
}): void {
  if (!input.exists || input.deleted) {
    throw new DispatchDomainError('COURIER_NOT_FOUND', 'Courier profile not found');
  }
  if (!input.active) {
    throw new DispatchDomainError('COURIER_INACTIVE', 'Courier is inactive');
  }
  if (input.availabilityDb !== 'AVAILABLE') {
    throw new DispatchDomainError(
      'COURIER_NOT_ONLINE',
      'Courier must be ONLINE (AVAILABLE) to receive assignments',
    );
  }
  if (input.activeShipmentCount >= input.maxActiveShipments) {
    throw new DispatchDomainError(
      'COURIER_WORKLOAD_EXCEEDED',
      `Courier has ${input.activeShipmentCount} active shipments (max ${input.maxActiveShipments})`,
    );
  }
}

export function assertCanAccept(input: {
  shipmentStatus: string;
  assignmentCourierId: string | null;
  actorCourierId: string;
}): void {
  if (input.shipmentStatus === 'ACCEPTED') {
    return; // idempotent
  }
  if (input.shipmentStatus !== 'ASSIGNED') {
    throw new DispatchDomainError(
      'INVALID_STATUS_FOR_ACCEPT',
      `Cannot accept shipment in status ${input.shipmentStatus}`,
    );
  }
  if (
    input.assignmentCourierId &&
    input.assignmentCourierId !== input.actorCourierId
  ) {
    throw new DispatchDomainError(
      'ASSIGNMENT_WRONG_COURIER',
      'Shipment assigned to another courier',
    );
  }
}

export function assertCanReject(input: {
  shipmentStatus: string;
  assignmentCourierId: string | null;
  actorCourierId: string;
}): void {
  if (
    input.shipmentStatus !== 'ASSIGNED' &&
    input.shipmentStatus !== 'ACCEPTED'
  ) {
    throw new DispatchDomainError(
      'INVALID_STATUS_FOR_REJECT',
      `Cannot reject shipment in status ${input.shipmentStatus}`,
    );
  }
  if (
    input.assignmentCourierId &&
    input.assignmentCourierId !== input.actorCourierId
  ) {
    throw new DispatchDomainError(
      'ASSIGNMENT_WRONG_COURIER',
      'Shipment assigned to another courier',
    );
  }
}

export type CourierCandidate = {
  userId: string;
  availabilityDb: string;
  active: boolean;
  deletedAt: Date | null;
  serviceRegions: string[];
  activeShipmentCount: number;
};

/**
 * Score candidates for rule-based selection (higher = better).
 * Zone match + spare capacity. Replaceable by AI scorer later.
 */
export function scoreCourierCandidate(
  candidate: CourierCandidate,
  input: {
    deliveryZone: string | null;
    maxActiveShipments: number;
  },
): number | null {
  if (candidate.deletedAt || !candidate.active) return null;
  if (candidate.availabilityDb !== 'AVAILABLE') return null;
  if (candidate.activeShipmentCount >= input.maxActiveShipments) return null;

  const zone = input.deliveryZone?.trim() || null;
  const regions = candidate.serviceRegions ?? [];
  const zoneOk =
    !zone ||
    regions.length === 0 ||
    regions.some((r) => r.toLowerCase() === zone.toLowerCase());
  if (!zoneOk) return null;

  const spare = input.maxActiveShipments - candidate.activeShipmentCount;
  const zoneBonus = zone && regions.some((r) => r.toLowerCase() === zone.toLowerCase()) ? 100 : 0;
  return zoneBonus + spare * 10;
}

export function selectBestCourier(
  candidates: CourierCandidate[],
  input: { deliveryZone: string | null; maxActiveShipments: number },
): { userId: string; score: number } | null {
  let best: { userId: string; score: number } | null = null;
  for (const c of candidates) {
    const score = scoreCourierCandidate(c, input);
    if (score == null) continue;
    if (!best || score > best.score) {
      best = { userId: c.userId, score };
    }
  }
  return best;
}

export function parseMaxActiveShipments(raw: string | null | undefined): number {
  const n = Number(raw ?? DEFAULT_MAX_ACTIVE_SHIPMENTS);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_ACTIVE_SHIPMENTS;
  return Math.floor(n);
}
