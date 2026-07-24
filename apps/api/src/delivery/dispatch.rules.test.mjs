import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors dispatch.rules.ts + selection scoring */

const DISPATCH_ACTIVE_STATUSES = [
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'BUYER_CONFIRMED',
];

class DispatchDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function assertCanAssign({ shipmentStatus, hasActiveAssignment }) {
  if (shipmentStatus !== 'AWAITING_ASSIGNMENT') {
    throw new DispatchDomainError(
      'INVALID_STATUS_FOR_ASSIGN',
      `Shipment must be AWAITING_ASSIGNMENT to assign (got ${shipmentStatus})`,
    );
  }
  if (hasActiveAssignment) {
    throw new DispatchDomainError(
      'ACTIVE_ASSIGNMENT_EXISTS',
      'Shipment already has an active assignment; use reassign',
    );
  }
}

function assertCourierEligibleForDispatch(input) {
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

function scoreCourierCandidate(candidate, input) {
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
  const zoneBonus =
    zone && regions.some((r) => r.toLowerCase() === zone.toLowerCase()) ? 100 : 0;
  return zoneBonus + spare * 10;
}

function selectBestCourier(candidates, input) {
  let best = null;
  for (const c of candidates) {
    const score = scoreCourierCandidate(c, input);
    if (score == null) continue;
    if (!best || score > best.score) best = { userId: c.userId, score };
  }
  return best;
}

function parseMaxActiveShipments(raw) {
  const n = Number(raw ?? 3);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.floor(n);
}

/** In-memory dispatch flow integration (no DB). */
function createMemoryDispatch() {
  const state = {
    shipment: {
      id: 's1',
      currentStatus: 'AWAITING_ASSIGNMENT',
      courierUserId: null,
      deliveryZone: 'bole',
    },
    assignments: [],
    events: [],
  };

  function appendEvent(type, from, to, payload) {
    state.events.push({ type, from, to, payload });
  }

  function assign(courierId) {
    assertCanAssign({
      shipmentStatus: state.shipment.currentStatus,
      hasActiveAssignment: state.assignments.some((a) => a.isActive),
    });
    assertCourierEligibleForDispatch({
      exists: true,
      active: true,
      deleted: false,
      availabilityDb: 'AVAILABLE',
      activeShipmentCount: 0,
      maxActiveShipments: 3,
    });
    const id = `a${state.assignments.length + 1}`;
    state.assignments.push({
      id,
      courierUserId: courierId,
      isActive: true,
      rejectedAt: null,
      cancelledAt: null,
    });
    appendEvent(
      'delivery.shipment.assigned',
      'AWAITING_ASSIGNMENT',
      'ASSIGNED',
      { assignmentId: id, courierUserId: courierId },
    );
    state.shipment.currentStatus = 'ASSIGNED';
    state.shipment.courierUserId = courierId;
  }

  function accept(courierId) {
    const active = state.assignments.find((a) => a.isActive);
    if (!active || active.courierUserId !== courierId) {
      throw new DispatchDomainError('ASSIGNMENT_WRONG_COURIER', 'wrong');
    }
    appendEvent('delivery.shipment.accepted', 'ASSIGNED', 'ACCEPTED', {
      assignmentId: active.id,
    });
    state.shipment.currentStatus = 'ACCEPTED';
  }

  function reject(courierId) {
    const active = state.assignments.find((a) => a.isActive);
    if (!active || active.courierUserId !== courierId) {
      throw new DispatchDomainError('ASSIGNMENT_WRONG_COURIER', 'wrong');
    }
    active.isActive = false;
    active.rejectedAt = new Date();
    appendEvent(
      'delivery.shipment.rejected',
      state.shipment.currentStatus,
      'AWAITING_ASSIGNMENT',
      { rejected: true },
    );
    state.shipment.currentStatus = 'AWAITING_ASSIGNMENT';
    state.shipment.courierUserId = null;
  }

  function reassign(newCourierId) {
    const active = state.assignments.find((a) => a.isActive);
    if (!active) throw new DispatchDomainError('NO_ACTIVE_ASSIGNMENT', 'none');
    active.isActive = false;
    active.cancelledAt = new Date();
    const id = `a${state.assignments.length + 1}`;
    state.assignments.push({
      id,
      courierUserId: newCourierId,
      isActive: true,
      rejectedAt: null,
      cancelledAt: null,
    });
    appendEvent('delivery.shipment.reassigned', 'ASSIGNED', 'ASSIGNED', {
      priorAssignmentId: active.id,
      assignmentId: id,
      courierUserId: newCourierId,
    });
    state.shipment.currentStatus = 'ASSIGNED';
    state.shipment.courierUserId = newCourierId;
  }

  return { state, assign, accept, reject, reassign };
}

describe('dispatch.rules (D4)', () => {
  it('allows assign only from AWAITING_ASSIGNMENT without active assignment', () => {
    assert.doesNotThrow(() =>
      assertCanAssign({
        shipmentStatus: 'AWAITING_ASSIGNMENT',
        hasActiveAssignment: false,
      }),
    );
    assert.throws(
      () =>
        assertCanAssign({
          shipmentStatus: 'CREATED',
          hasActiveAssignment: false,
        }),
      (e) => e.code === 'INVALID_STATUS_FOR_ASSIGN',
    );
    assert.throws(
      () =>
        assertCanAssign({
          shipmentStatus: 'AWAITING_ASSIGNMENT',
          hasActiveAssignment: true,
        }),
      (e) => e.code === 'ACTIVE_ASSIGNMENT_EXISTS',
    );
  });

  it('rejects unavailable / overloaded couriers', () => {
    assert.throws(
      () =>
        assertCourierEligibleForDispatch({
          exists: true,
          active: true,
          deleted: false,
          availabilityDb: 'OFFLINE',
          activeShipmentCount: 0,
          maxActiveShipments: 3,
        }),
      (e) => e.code === 'COURIER_NOT_ONLINE',
    );
    assert.throws(
      () =>
        assertCourierEligibleForDispatch({
          exists: true,
          active: true,
          deleted: false,
          availabilityDb: 'AVAILABLE',
          activeShipmentCount: 3,
          maxActiveShipments: 3,
        }),
      (e) => e.code === 'COURIER_WORKLOAD_EXCEEDED',
    );
  });

  it('selects courier by zone match and lowest workload', () => {
    const best = selectBestCourier(
      [
        {
          userId: 'c1',
          availabilityDb: 'AVAILABLE',
          active: true,
          deletedAt: null,
          serviceRegions: ['bole'],
          activeShipmentCount: 2,
        },
        {
          userId: 'c2',
          availabilityDb: 'AVAILABLE',
          active: true,
          deletedAt: null,
          serviceRegions: ['bole'],
          activeShipmentCount: 0,
        },
        {
          userId: 'c3',
          availabilityDb: 'AVAILABLE',
          active: true,
          deletedAt: null,
          serviceRegions: ['piassa'],
          activeShipmentCount: 0,
        },
      ],
      { deliveryZone: 'bole', maxActiveShipments: 3 },
    );
    assert.equal(best.userId, 'c2');
    assert.ok(best.score > 100);
  });

  it('excludes zone mismatches when regions are set', () => {
    const best = selectBestCourier(
      [
        {
          userId: 'c3',
          availabilityDb: 'AVAILABLE',
          active: true,
          deletedAt: null,
          serviceRegions: ['piassa'],
          activeShipmentCount: 0,
        },
      ],
      { deliveryZone: 'bole', maxActiveShipments: 3 },
    );
    assert.equal(best, null);
  });

  it('parses max active shipments', () => {
    assert.equal(parseMaxActiveShipments('5'), 5);
    assert.equal(parseMaxActiveShipments('bad'), 3);
  });
});

describe('dispatch flow integration (in-memory D4)', () => {
  it('assign → accept → reassign preserves assignment history and events', () => {
    const d = createMemoryDispatch();
    d.assign('c1');
    assert.equal(d.state.shipment.currentStatus, 'ASSIGNED');
    assert.equal(d.state.events.length, 1);
    d.accept('c1');
    assert.equal(d.state.shipment.currentStatus, 'ACCEPTED');
    // simulate return to ASSIGNED then reassign path used after accept+unassign style
    d.state.shipment.currentStatus = 'ASSIGNED';
    d.reassign('c2');
    assert.equal(d.state.assignments.length, 2);
    assert.equal(d.state.assignments.filter((a) => a.isActive).length, 1);
    assert.equal(d.state.assignments[0].isActive, false);
    assert.equal(d.state.shipment.courierUserId, 'c2');
    assert.ok(d.state.events.some((e) => e.type === 'delivery.shipment.reassigned'));
  });

  it('reject returns to AWAITING_ASSIGNMENT and deactivates assignment', () => {
    const d = createMemoryDispatch();
    d.assign('c1');
    d.reject('c1');
    assert.equal(d.state.shipment.currentStatus, 'AWAITING_ASSIGNMENT');
    assert.equal(d.state.assignments.every((a) => !a.isActive), true);
    assert.ok(d.state.events.some((e) => e.type === 'delivery.shipment.rejected'));
  });

  it('duplicate active assignment is blocked', () => {
    assert.throws(
      () =>
        assertCanAssign({
          shipmentStatus: 'AWAITING_ASSIGNMENT',
          hasActiveAssignment: true,
        }),
      (e) => e.code === 'ACTIVE_ASSIGNMENT_EXISTS',
    );
    const d = createMemoryDispatch();
    d.assign('c1');
    assert.throws(
      () => d.assign('c2'),
      (e) =>
        e.code === 'ACTIVE_ASSIGNMENT_EXISTS' ||
        e.code === 'INVALID_STATUS_FOR_ASSIGN',
    );
  });
});

describe('dispatch active statuses', () => {
  it('counts workload statuses', () => {
    assert.deepEqual(DISPATCH_ACTIVE_STATUSES, [
      'ASSIGNED',
      'ACCEPTED',
      'PICKED_UP',
      'IN_TRANSIT',
      'ARRIVED',
      'DELIVERED',
      'BUYER_CONFIRMED',
    ]);
  });
});
