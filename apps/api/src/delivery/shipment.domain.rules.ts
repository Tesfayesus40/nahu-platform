/**
 * Delivery D2/D3 — Shipment aggregate domain rules (pure, no I/O).
 *
 * AGGREGATE WRITE PATH (enforced by ShipmentAggregateService):
 * All mutations to stops, assignments, events, PODs, and earnings MUST go through
 * shipment domain/aggregate services — never via ad-hoc Prisma updates in
 * unrelated modules.
 *
 * EVENT CONSISTENCY: every current_status change produces exactly one
 * ShipmentEvent via buildShipmentStatusEvent / planStatusTransition.
 *
 * DeliveryEventsPublisher fans out after shipment_events persist
 * (notifications, analytics, ETA, AI). Do not invent a parallel stream.
 */

export const SHIPMENT_STATUSES = [
  'CREATED',
  'AWAITING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'BUYER_CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'RETURNED',
  'FAILED',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/** Statuses that count as "active" for the one-active-outbound partial unique index. */
export const ACTIVE_OUTBOUND_STATUSES: readonly ShipmentStatus[] = [
  'CREATED',
  'AWAITING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'BUYER_CONFIRMED',
] as const;

export const TERMINAL_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  'COMPLETED',
  'CANCELLED',
  'RETURNED',
  'FAILED',
] as const;

export const SHIPMENT_TYPES = [
  'OUTBOUND',
  'RETURN',
  'SPLIT_LEG',
  'BATCH_LEG',
] as const;

export type ShipmentType = (typeof SHIPMENT_TYPES)[number];

export const STOP_TYPES = [
  'PICKUP',
  'DROPOFF',
  'RETURN_PICKUP',
  'RETURN_DROPOFF',
] as const;

export type StopType = (typeof STOP_TYPES)[number];

export const STOP_STATUSES = [
  'PENDING',
  'ARRIVED',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
] as const;

export type StopStatus = (typeof STOP_STATUSES)[number];

export const COURIER_AVAILABILITY = [
  'OFFLINE',
  'AVAILABLE',
  'BUSY',
  'ON_BREAK',
] as const;

export type CourierAvailability = (typeof COURIER_AVAILABILITY)[number];

export const POD_METHODS = [
  'PHOTO',
  'SIGNATURE',
  'OTP',
  'PIN',
  'GPS_ONLY',
  'PHOTO_AND_SIGNATURE',
  'PHOTO_AND_OTP',
] as const;

export type PodMethod = (typeof POD_METHODS)[number];

export const EARNING_TYPES = [
  'DROPOFF_FLAT',
  'PICKUP_FEE',
  'DISTANCE',
  'BONUS',
  'ADJUSTMENT',
  'VOID',
  'OTHER',
  'DELIVERY_EARNING',
  'REVERSAL',
  'PENALTY',
] as const;

export type EarningType = (typeof EARNING_TYPES)[number];

export const EARNING_LEDGER_STATUSES = [
  'ACCRUED',
  'ADJUSTED',
  'PAID',
  'VOID',
  'PENDING',
  'ELIGIBLE',
  'APPROVED',
  'REVERSED',
] as const;

export type EarningLedgerStatus = (typeof EARNING_LEDGER_STATUSES)[number];

/** Canonical domain event types for future notification/analytics/AI consumers. */
export const SHIPMENT_EVENT_TYPES = [
  'delivery.shipment.created',
  'delivery.shipment.awaiting_assignment',
  'delivery.shipment.assigned',
  'delivery.shipment.reassigned',
  'delivery.shipment.accepted',
  'delivery.shipment.rejected',
  'delivery.shipment.pickup_started',
  'delivery.shipment.picked_up',
  'delivery.shipment.in_transit',
  'delivery.shipment.arrived',
  'delivery.shipment.delivered',
  'delivery.shipment.buyer_confirmed',
  'delivery.shipment.completed',
  'delivery.shipment.cancelled',
  'delivery.shipment.returned',
  'delivery.shipment.failed',
  'delivery.stop.arrived',
  'delivery.stop.completed',
  'delivery.stop.failed',
  'delivery.pod.started',
  'delivery.pod.verified',
  'delivery.pod.failed',
  'delivery.pod.captured',
  'delivery.earning.accrued',
  'delivery.earning.adjusted',
  'delivery.earning.voided',
  'delivery.courier.availability_changed',
] as const;

export type ShipmentEventType = (typeof SHIPMENT_EVENT_TYPES)[number];

/** Allowed current_status transitions (D4 dispatch + D5 execution). */
const TRANSITIONS: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  CREATED: ['AWAITING_ASSIGNMENT', 'ASSIGNED', 'CANCELLED'],
  AWAITING_ASSIGNMENT: ['ASSIGNED', 'CANCELLED', 'FAILED'],
  ASSIGNED: ['ACCEPTED', 'AWAITING_ASSIGNMENT', 'CANCELLED', 'FAILED'],
  ACCEPTED: ['PICKED_UP', 'ASSIGNED', 'AWAITING_ASSIGNMENT', 'CANCELLED', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED', 'CANCELLED', 'RETURNED'],
  IN_TRANSIT: ['ARRIVED', 'FAILED', 'CANCELLED', 'RETURNED'],
  ARRIVED: ['DELIVERED', 'FAILED', 'CANCELLED', 'RETURNED'],
  DELIVERED: ['BUYER_CONFIRMED', 'COMPLETED', 'RETURNED', 'FAILED'],
  BUYER_CONFIRMED: ['COMPLETED', 'RETURNED'],
  COMPLETED: [],
  CANCELLED: [],
  RETURNED: ['COMPLETED'],
  FAILED: ['AWAITING_ASSIGNMENT', 'CANCELLED'],
};

export function isShipmentStatus(value: string): value is ShipmentStatus {
  return (SHIPMENT_STATUSES as readonly string[]).includes(value);
}

export function isTerminalShipmentStatus(status: ShipmentStatus): boolean {
  return (TERMINAL_SHIPMENT_STATUSES as readonly string[]).includes(status);
}

export function isActiveOutboundStatus(status: ShipmentStatus): boolean {
  return (ACTIVE_OUTBOUND_STATUSES as readonly string[]).includes(status);
}

export function canTransitionShipmentStatus(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  if (from === to) {
    return false;
  }
  return TRANSITIONS[from].includes(to);
}

export function eventTypeForStatusTransition(
  to: ShipmentStatus,
): ShipmentEventType {
  const map: Record<ShipmentStatus, ShipmentEventType> = {
    CREATED: 'delivery.shipment.created',
    AWAITING_ASSIGNMENT: 'delivery.shipment.awaiting_assignment',
    ASSIGNED: 'delivery.shipment.assigned',
    ACCEPTED: 'delivery.shipment.accepted',
    PICKED_UP: 'delivery.shipment.picked_up',
    IN_TRANSIT: 'delivery.shipment.in_transit',
    ARRIVED: 'delivery.shipment.arrived',
    DELIVERED: 'delivery.shipment.delivered',
    BUYER_CONFIRMED: 'delivery.shipment.buyer_confirmed',
    COMPLETED: 'delivery.shipment.completed',
    CANCELLED: 'delivery.shipment.cancelled',
    RETURNED: 'delivery.shipment.returned',
    FAILED: 'delivery.shipment.failed',
  };
  return map[to];
}

/**
 * Build an immutable event row shape for a status change.
 * Callers persist this; they must not UPDATE prior events.
 */
export function buildShipmentStatusEvent(input: {
  shipmentId: string;
  fromStatus: ShipmentStatus | null;
  toStatus: ShipmentStatus;
  actorUserId?: string | null;
  correlationId?: string | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  occurredAt?: Date;
}): {
  shipmentId: string;
  eventType: ShipmentEventType;
  fromStatus: ShipmentStatus | null;
  toStatus: ShipmentStatus;
  actorUserId: string | null;
  correlationId: string | null;
  message: string | null;
  payloadJson: Record<string, unknown> | null;
  occurredAt: Date;
} {
  return {
    shipmentId: input.shipmentId,
    eventType: eventTypeForStatusTransition(input.toStatus),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorUserId: input.actorUserId ?? null,
    correlationId: input.correlationId ?? null,
    message: input.message ?? null,
    payloadJson: input.payload ?? null,
    occurredAt: input.occurredAt ?? new Date(),
  };
}

/**
 * Plan a status change + its mandatory event (1:1).
 * Callers must persist both in one transaction; never update current_status alone.
 */
export function planStatusTransition(input: {
  shipmentId: string;
  fromStatus: ShipmentStatus;
  toStatus: ShipmentStatus;
  actorUserId?: string | null;
  correlationId?: string | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
}):
  | {
      ok: true;
      nextStatus: ShipmentStatus;
      event: ReturnType<typeof buildShipmentStatusEvent>;
    }
  | { ok: false; reason: string } {
  if (!canTransitionShipmentStatus(input.fromStatus, input.toStatus)) {
    return {
      ok: false,
      reason: `Illegal shipment transition ${input.fromStatus} → ${input.toStatus}`,
    };
  }
  return {
    ok: true,
    nextStatus: input.toStatus,
    event: buildShipmentStatusEvent({
      shipmentId: input.shipmentId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      message: input.message,
      payload: input.payload,
    }),
  };
}

/** UI availability (D3) ↔ DB courier_profiles.availability (D2). */
export const COURIER_AVAILABILITY_UI = [
  'ONLINE',
  'OFFLINE',
  'BUSY',
  'BREAK',
] as const;

export type CourierAvailabilityUi = (typeof COURIER_AVAILABILITY_UI)[number];

export function toDbAvailability(
  value: string,
): CourierAvailability | null {
  const normalized = value.toUpperCase();
  if (normalized === 'ONLINE') return 'AVAILABLE';
  if (normalized === 'BREAK') return 'ON_BREAK';
  if ((COURIER_AVAILABILITY as readonly string[]).includes(normalized)) {
    return normalized as CourierAvailability;
  }
  return null;
}

export function toUiAvailability(
  value: string,
): CourierAvailabilityUi {
  if (value === 'AVAILABLE') return 'ONLINE';
  if (value === 'ON_BREAK') return 'BREAK';
  if (value === 'BUSY') return 'BUSY';
  return 'OFFLINE';
}

export type StopDraft = {
  sequence: number;
  stopType: StopType;
};

/** Build a readable location line from farmer profile geography. */
export function formatFarmerPickupAddress(input: {
  region?: string | null;
  zone?: string | null;
  woreda?: string | null;
}): string {
  const parts = [input.region, input.zone, input.woreda]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(', ') : 'Farmer pickup location';
}

export function formatPersonName(input: {
  firstName?: string | null;
  lastName?: string | null;
}): string | null {
  const parts = [input.firstName, input.lastName]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

/**
 * RC1 outbound stop plan from fulfillment/order parties.
 * Status stays CREATED until Admin Release → Assign (DispatchService).
 * Optional pickup/dropoff overrides enrich from saved locations when present.
 */
export function planOutboundStopsFromOrder(input: {
  deliveryAddress: string;
  pickupNotes?: string | null;
  deliveryNotes?: string | null;
  farmer?: {
    region?: string | null;
    zone?: string | null;
    woreda?: string | null;
    user?: {
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  buyer?: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  } | null;
  pickup?: {
    addressText?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    instructions?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  dropoff?: {
    addressText?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    instructions?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
}): {
  pickup: {
    sequence: 1;
    stopType: 'PICKUP';
    addressText: string;
    contactName: string | null;
    contactPhone: string | null;
    instructions: string | null;
    lat: number | null;
    lng: number | null;
  };
  dropoff: {
    sequence: 2;
    stopType: 'DROPOFF';
    addressText: string;
    contactName: string | null;
    contactPhone: string | null;
    instructions: string | null;
    lat: number | null;
    lng: number | null;
  };
} {
  const farmerUser = input.farmer?.user ?? null;
  const pickupOverride = input.pickup ?? null;
  const dropoffOverride = input.dropoff ?? null;

  const pickupAddress =
    (typeof pickupOverride?.addressText === 'string' &&
      pickupOverride.addressText.trim()) ||
    formatFarmerPickupAddress(input.farmer ?? {});
  const dropoffAddress =
    (typeof dropoffOverride?.addressText === 'string' &&
      dropoffOverride.addressText.trim()) ||
    input.deliveryAddress.trim() ||
    'Buyer delivery address';

  return {
    pickup: {
      sequence: 1,
      stopType: 'PICKUP',
      addressText: pickupAddress,
      contactName:
        pickupOverride?.contactName?.trim() ||
        formatPersonName(farmerUser ?? {}),
      contactPhone:
        pickupOverride?.contactPhone?.trim() || farmerUser?.phone || null,
      instructions:
        pickupOverride?.instructions?.trim() ||
        input.pickupNotes?.trim() ||
        null,
      lat: toOptionalCoord(pickupOverride?.lat),
      lng: toOptionalCoord(pickupOverride?.lng),
    },
    dropoff: {
      sequence: 2,
      stopType: 'DROPOFF',
      addressText: dropoffAddress,
      contactName:
        dropoffOverride?.contactName?.trim() ||
        formatPersonName(input.buyer ?? {}),
      contactPhone:
        dropoffOverride?.contactPhone?.trim() || input.buyer?.phone || null,
      instructions:
        dropoffOverride?.instructions?.trim() ||
        input.deliveryNotes?.trim() ||
        null,
      lat: toOptionalCoord(dropoffOverride?.lat),
      lng: toOptionalCoord(dropoffOverride?.lng),
    },
  };
}

function toOptionalCoord(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Shipment may leave CREATED / be offered only with ≥1 stop; RC1 expects PICKUP+DROPOFF. */
export function assertStopsReadyForAssignment(stops: StopDraft[]): {
  ok: true;
} | { ok: false; reason: string } {
  const live = stops.filter(Boolean);
  if (live.length < 1) {
    return { ok: false, reason: 'Shipment requires at least one stop' };
  }
  const sequences = live.map((s) => s.sequence);
  if (new Set(sequences).size !== sequences.length) {
    return { ok: false, reason: 'Stop sequences must be unique within a shipment' };
  }
  const hasPickup = live.some(
    (s) => s.stopType === 'PICKUP' || s.stopType === 'RETURN_PICKUP',
  );
  const hasDropoff = live.some(
    (s) => s.stopType === 'DROPOFF' || s.stopType === 'RETURN_DROPOFF',
  );
  if (!hasPickup || !hasDropoff) {
    return {
      ok: false,
      reason: 'Shipment requires at least one pickup and one dropoff stop',
    };
  }
  return { ok: true };
}

const STOP_TRANSITIONS: Record<StopStatus, readonly StopStatus[]> = {
  PENDING: ['ARRIVED', 'SKIPPED', 'FAILED'],
  ARRIVED: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['PENDING'],
  SKIPPED: [],
};

export function canTransitionStopStatus(
  from: StopStatus,
  to: StopStatus,
): boolean {
  return STOP_TRANSITIONS[from].includes(to);
}

/** Earnings ledger: corrections are new rows; never mutate amount in place. */
export function buildEarningCorrection(input: {
  originalId: string;
  originalAmount: number;
  correctionAmount: number;
  earningType: 'ADJUSTMENT' | 'VOID' | 'REVERSAL';
  reference?: string;
}): {
  replacesEarningId: string;
  amount: number;
  earningType: 'ADJUSTMENT' | 'VOID' | 'REVERSAL';
  ledgerStatus: EarningLedgerStatus;
  reference: string | null;
} {
  if (input.earningType === 'VOID' || input.earningType === 'REVERSAL') {
    return {
      replacesEarningId: input.originalId,
      amount: -Math.abs(input.originalAmount),
      earningType: input.earningType,
      ledgerStatus: input.earningType === 'REVERSAL' ? 'REVERSED' : 'VOID',
      reference:
        input.reference ??
        `${input.earningType.toLowerCase()}:${input.originalId}`,
    };
  }
  return {
    replacesEarningId: input.originalId,
    amount: input.correctionAmount,
    earningType: 'ADJUSTMENT',
    ledgerStatus: 'ADJUSTED',
    reference: input.reference ?? `adjust:${input.originalId}`,
  };
}

/** Derive ledger balance from append-only rows (future payouts). */
export function sumEarningLedger(
  rows: ReadonlyArray<{ amount: number | string; ledgerStatus: string }>,
): number {
  return rows.reduce((sum, row) => {
    const n = typeof row.amount === 'string' ? Number(row.amount) : row.amount;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export function isValidPodCapture(input: {
  method: PodMethod;
  photoUrl?: string | null;
  mediaUrls?: string[] | null;
  signatureUrl?: string | null;
  otpVerified?: boolean;
  lat?: number | null;
  lng?: number | null;
  recipientName?: string | null;
  capturedAt?: Date | null;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.capturedAt) {
    return { ok: false, reason: 'capturedAt is required' };
  }
  const hasPhoto =
    Boolean(input.photoUrl) ||
    (Array.isArray(input.mediaUrls) && input.mediaUrls.length > 0);
  const hasSignature = Boolean(input.signatureUrl);
  const hasOtp = Boolean(input.otpVerified);
  const hasGps =
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);

  switch (input.method) {
    case 'PHOTO':
    case 'PHOTO_AND_SIGNATURE':
    case 'PHOTO_AND_OTP':
      if (!hasPhoto) {
        return { ok: false, reason: 'Photo evidence required for this POD method' };
      }
      if (input.method === 'PHOTO_AND_SIGNATURE' && !hasSignature) {
        return { ok: false, reason: 'Signature required for PHOTO_AND_SIGNATURE' };
      }
      if (input.method === 'PHOTO_AND_OTP' && !hasOtp) {
        return { ok: false, reason: 'OTP verification required for PHOTO_AND_OTP' };
      }
      return { ok: true };
    case 'SIGNATURE':
      if (!hasSignature) {
        return { ok: false, reason: 'Signature required' };
      }
      return { ok: true };
    case 'OTP':
    case 'PIN':
      if (!hasOtp) {
        return { ok: false, reason: 'OTP/PIN verification required' };
      }
      return { ok: true };
    case 'GPS_ONLY':
      if (!hasGps) {
        return { ok: false, reason: 'GPS coordinates required for GPS_ONLY' };
      }
      return { ok: true };
    default:
      return { ok: false, reason: 'Unknown POD method' };
  }
}

/** Map SAD v1.1 shorthand labels → D2 shipment statuses (docs + D4 sync). */
export function mapLegacySadStatusToD2(
  legacy: string,
): ShipmentStatus | null {
  const map: Record<string, ShipmentStatus> = {
    DRAFT: 'CREATED',
    OFFERED: 'ASSIGNED',
    ACCEPTED: 'ACCEPTED',
    IN_PROGRESS: 'IN_TRANSIT',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  };
  return map[legacy] ?? null;
}
