import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/delivery/shipment.domain.rules.ts */

const SHIPMENT_STATUSES = [
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
];

const ACTIVE_OUTBOUND_STATUSES = [
  'CREATED',
  'AWAITING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'BUYER_CONFIRMED',
];

const TRANSITIONS = {
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

function canTransitionShipmentStatus(from, to) {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

function isActiveOutboundStatus(status) {
  return ACTIVE_OUTBOUND_STATUSES.includes(status);
}

function assertStopsReadyForAssignment(stops) {
  if (stops.length < 1) {
    return { ok: false, reason: 'Shipment requires at least one stop' };
  }
  const sequences = stops.map((s) => s.sequence);
  if (new Set(sequences).size !== sequences.length) {
    return { ok: false, reason: 'Stop sequences must be unique within a shipment' };
  }
  const hasPickup = stops.some(
    (s) => s.stopType === 'PICKUP' || s.stopType === 'RETURN_PICKUP',
  );
  const hasDropoff = stops.some(
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

function buildEarningCorrection(input) {
  if (input.earningType === 'VOID') {
    return {
      replacesEarningId: input.originalId,
      amount: -Math.abs(input.originalAmount),
      earningType: 'VOID',
      ledgerStatus: 'VOID',
      reference: input.reference ?? `void:${input.originalId}`,
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

function sumEarningLedger(rows) {
  return rows.reduce((sum, row) => {
    const n = typeof row.amount === 'string' ? Number(row.amount) : row.amount;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function isValidPodCapture(input) {
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
      if (!hasPhoto) return { ok: false, reason: 'Photo evidence required for this POD method' };
      return { ok: true };
    case 'PHOTO_AND_OTP':
      if (!hasPhoto) return { ok: false, reason: 'Photo evidence required for this POD method' };
      if (!hasOtp) return { ok: false, reason: 'OTP verification required for PHOTO_AND_OTP' };
      return { ok: true };
    case 'OTP':
    case 'PIN':
      if (!hasOtp) return { ok: false, reason: 'OTP/PIN verification required' };
      return { ok: true };
    case 'GPS_ONLY':
      if (!hasGps) return { ok: false, reason: 'GPS coordinates required for GPS_ONLY' };
      return { ok: true };
    case 'SIGNATURE':
      if (!hasSignature) return { ok: false, reason: 'Signature required' };
      return { ok: true };
    default:
      return { ok: false, reason: 'Unknown POD method' };
  }
}

function buildShipmentStatusEvent(input) {
  return {
    shipmentId: input.shipmentId,
    eventType: `delivery.shipment.${input.toStatus.toLowerCase()}`,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    payloadJson: input.payload ?? null,
  };
}

function mapLegacySadStatusToD2(legacy) {
  const map = {
    DRAFT: 'CREATED',
    OFFERED: 'ASSIGNED',
    ACCEPTED: 'ACCEPTED',
    IN_PROGRESS: 'IN_TRANSIT',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  };
  return map[legacy] ?? null;
}

function planStatusTransition(input) {
  if (!canTransitionShipmentStatus(input.fromStatus, input.toStatus)) {
    return { ok: false, reason: 'illegal' };
  }
  return {
    ok: true,
    nextStatus: input.toStatus,
    event: buildShipmentStatusEvent({
      shipmentId: input.shipmentId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId,
    }),
  };
}

function toDbAvailability(value) {
  const normalized = value.toUpperCase();
  if (normalized === 'ONLINE') return 'AVAILABLE';
  if (normalized === 'BREAK') return 'ON_BREAK';
  if (['OFFLINE', 'AVAILABLE', 'BUSY', 'ON_BREAK'].includes(normalized)) {
    return normalized;
  }
  return null;
}

function toUiAvailability(value) {
  if (value === 'AVAILABLE') return 'ONLINE';
  if (value === 'ON_BREAK') return 'BREAK';
  if (value === 'BUSY') return 'BUSY';
  return 'OFFLINE';
}

describe('shipment domain (D2/D5)', () => {
  it('exposes the full lifecycle status set', () => {
    assert.equal(SHIPMENT_STATUSES.length, 13);
    assert.ok(SHIPMENT_STATUSES.includes('ARRIVED'));
    assert.ok(SHIPMENT_STATUSES.includes('BUYER_CONFIRMED'));
    assert.ok(SHIPMENT_STATUSES.includes('RETURNED'));
  });

  it('allows happy-path transitions and blocks illegal ones', () => {
    assert.equal(canTransitionShipmentStatus('CREATED', 'AWAITING_ASSIGNMENT'), true);
    assert.equal(canTransitionShipmentStatus('ASSIGNED', 'ACCEPTED'), true);
    assert.equal(canTransitionShipmentStatus('IN_TRANSIT', 'ARRIVED'), true);
    assert.equal(canTransitionShipmentStatus('ARRIVED', 'DELIVERED'), true);
    assert.equal(canTransitionShipmentStatus('IN_TRANSIT', 'DELIVERED'), false);
    assert.equal(canTransitionShipmentStatus('ACCEPTED', 'IN_TRANSIT'), false);
    assert.equal(canTransitionShipmentStatus('DELIVERED', 'BUYER_CONFIRMED'), true);
    assert.equal(canTransitionShipmentStatus('BUYER_CONFIRMED', 'COMPLETED'), true);
    assert.equal(canTransitionShipmentStatus('COMPLETED', 'IN_TRANSIT'), false);
    assert.equal(canTransitionShipmentStatus('CREATED', 'DELIVERED'), false);
  });

  it('marks active outbound statuses for partial unique index semantics', () => {
    assert.equal(isActiveOutboundStatus('IN_TRANSIT'), true);
    assert.equal(isActiveOutboundStatus('ARRIVED'), true);
    assert.equal(isActiveOutboundStatus('COMPLETED'), false);
    assert.equal(isActiveOutboundStatus('CANCELLED'), false);
  });

  it('requires pickup + dropoff stops with unique sequences', () => {
    assert.equal(
      assertStopsReadyForAssignment([
        { sequence: 1, stopType: 'PICKUP' },
        { sequence: 2, stopType: 'DROPOFF' },
      ]).ok,
      true,
    );
    assert.equal(assertStopsReadyForAssignment([]).ok, false);
    assert.equal(
      assertStopsReadyForAssignment([{ sequence: 1, stopType: 'DROPOFF' }]).ok,
      false,
    );
    assert.equal(
      assertStopsReadyForAssignment([
        { sequence: 1, stopType: 'PICKUP' },
        { sequence: 1, stopType: 'DROPOFF' },
      ]).ok,
      false,
    );
  });

  it('supports multi-stop drafts (batched / multi dropoff ready)', () => {
    const result = assertStopsReadyForAssignment([
      { sequence: 1, stopType: 'PICKUP' },
      { sequence: 2, stopType: 'DROPOFF' },
      { sequence: 3, stopType: 'DROPOFF' },
    ]);
    assert.equal(result.ok, true);
  });

  it('builds immutable status events without mutating history', () => {
    const event = buildShipmentStatusEvent({
      shipmentId: 's1',
      fromStatus: 'ASSIGNED',
      toStatus: 'ACCEPTED',
      payload: { courierUserId: 'c1' },
    });
    assert.equal(event.fromStatus, 'ASSIGNED');
    assert.equal(event.toStatus, 'ACCEPTED');
    assert.equal(event.eventType.includes('accepted'), true);
    assert.deepEqual(event.payloadJson, { courierUserId: 'c1' });
  });

  it('earning corrections are new rows referencing originals', () => {
    const voidRow = buildEarningCorrection({
      originalId: 'e1',
      originalAmount: 50,
      correctionAmount: 0,
      earningType: 'VOID',
    });
    assert.equal(voidRow.replacesEarningId, 'e1');
    assert.equal(voidRow.amount, -50);
    assert.equal(voidRow.ledgerStatus, 'VOID');

    const adj = buildEarningCorrection({
      originalId: 'e1',
      originalAmount: 50,
      correctionAmount: -10,
      earningType: 'ADJUSTMENT',
    });
    assert.equal(adj.amount, -10);
    assert.equal(adj.ledgerStatus, 'ADJUSTED');
  });

  it('sums append-only ledger for future payouts', () => {
    assert.equal(
      sumEarningLedger([
        { amount: 50, ledgerStatus: 'ACCRUED' },
        { amount: -50, ledgerStatus: 'VOID' },
        { amount: 40, ledgerStatus: 'ACCRUED' },
      ]),
      40,
    );
  });

  it('validates POD methods including OTP and GPS', () => {
    const now = new Date();
    assert.equal(
      isValidPodCapture({
        method: 'PHOTO',
        photoUrl: 'https://cdn/p.jpg',
        capturedAt: now,
      }).ok,
      true,
    );
    assert.equal(
      isValidPodCapture({
        method: 'PHOTO_AND_OTP',
        photoUrl: 'https://cdn/p.jpg',
        otpVerified: true,
        capturedAt: now,
        recipientName: 'Abebe',
        lat: 9.0,
        lng: 38.7,
      }).ok,
      true,
    );
    assert.equal(
      isValidPodCapture({ method: 'GPS_ONLY', lat: 9, lng: 38, capturedAt: now }).ok,
      true,
    );
    assert.equal(
      isValidPodCapture({ method: 'OTP', otpVerified: false, capturedAt: now }).ok,
      false,
    );
  });

  it('maps SAD shorthand statuses onto D2 lifecycle', () => {
    assert.equal(mapLegacySadStatusToD2('DRAFT'), 'CREATED');
    assert.equal(mapLegacySadStatusToD2('OFFERED'), 'ASSIGNED');
    assert.equal(mapLegacySadStatusToD2('IN_PROGRESS'), 'IN_TRANSIT');
  });

  it('plans status transition with exactly one event', () => {
    const planned = planStatusTransition({
      shipmentId: 's1',
      fromStatus: 'ASSIGNED',
      toStatus: 'ACCEPTED',
      actorUserId: 'c1',
    });
    assert.equal(planned.ok, true);
    if (planned.ok) {
      assert.equal(planned.nextStatus, 'ACCEPTED');
      assert.equal(planned.event.toStatus, 'ACCEPTED');
      assert.equal(planned.event.fromStatus, 'ASSIGNED');
    }
    assert.equal(
      planStatusTransition({
        shipmentId: 's1',
        fromStatus: 'CREATED',
        toStatus: 'DELIVERED',
      }).ok,
      false,
    );
  });

  it('maps UI availability ONLINE/BREAK to DB AVAILABLE/ON_BREAK', () => {
    assert.equal(toDbAvailability('ONLINE'), 'AVAILABLE');
    assert.equal(toDbAvailability('BREAK'), 'ON_BREAK');
    assert.equal(toUiAvailability('AVAILABLE'), 'ONLINE');
    assert.equal(toUiAvailability('ON_BREAK'), 'BREAK');
  });
});
