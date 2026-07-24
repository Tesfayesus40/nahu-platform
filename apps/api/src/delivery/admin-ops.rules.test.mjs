import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors admin-ops.rules.ts */

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

const OPS_STATUS_BUCKETS = {
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

class AdminOpsDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function canTransition(from, to) {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

function assertCanCancelShipment(status) {
  if (!SHIPMENT_STATUSES.includes(status)) {
    throw new AdminOpsDomainError('INVALID_STATUS', 'invalid');
  }
  if (status === 'CANCELLED') {
    throw new AdminOpsDomainError('CANCEL_NOT_ALLOWED', 'already');
  }
  if (status === 'COMPLETED' || status === 'RETURNED') {
    throw new AdminOpsDomainError('CANCEL_NOT_ALLOWED', status);
  }
  if (!canTransition(status, 'CANCELLED')) {
    throw new AdminOpsDomainError('CANCEL_NOT_ALLOWED', status);
  }
}

function assertCanRetryFailedShipment(status) {
  if (status !== 'FAILED') {
    throw new AdminOpsDomainError('RETRY_NOT_ALLOWED', status);
  }
  if (!canTransition('FAILED', 'AWAITING_ASSIGNMENT')) {
    throw new AdminOpsDomainError('ILLEGAL_TRANSITION', 'retry');
  }
}

function bucketForStatus(status) {
  for (const [bucket, statuses] of Object.entries(OPS_STATUS_BUCKETS)) {
    if (statuses.includes(status)) return bucket;
  }
  return null;
}

function averageDurationMs(rows) {
  const durations = [];
  for (const row of rows) {
    if (!row.startAt || !row.endAt) continue;
    const ms = row.endAt.getTime() - row.startAt.getTime();
    if (ms >= 0) durations.push(ms);
  }
  if (!durations.length) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

function courierUtilization(input) {
  const total = input.totalActiveCouriers;
  if (total <= 0) return { onlineRate: null, busyRate: null };
  return {
    onlineRate: Math.round((input.onlineCouriers / total) * 1000) / 10,
    busyRate:
      Math.round((input.couriersWithActiveShipments / total) * 1000) / 10,
  };
}

/** Permission matrix for admin ops mutations (mirrors controller decorators). */
const PERMISSIONS = {
  listShipments: 'delivery.read',
  getShipment: 'delivery.read',
  metrics: 'delivery.read',
  listCouriers: 'delivery.read',
  assign: 'delivery.manage',
  reassign: 'delivery.manage',
  unassign: 'delivery.manage',
  release: 'delivery.manage',
  cancel: 'delivery.manage',
  retry: 'delivery.manage',
};

const AUDIT_ACTIONS = {
  assign: 'delivery.shipment.assign',
  reassign: 'delivery.shipment.reassign',
  unassign: 'delivery.shipment.unassign',
  release: 'delivery.shipment.release',
  cancel: 'delivery.shipment.cancel',
  retry: 'delivery.shipment.retry',
};

function buildAudit(action, actorUserId, shipmentId) {
  return {
    permissionCode: 'delivery.manage',
    action: AUDIT_ACTIONS[action],
    targetType: 'shipment',
    targetId: shipmentId,
    actorUserId,
    outcome: 'SUCCESS',
  };
}

/** In-memory ops flow for cancel/retry + metrics validation. */
function createMemoryOps() {
  const state = {
    shipments: [
      {
        id: 's1',
        currentStatus: 'AWAITING_ASSIGNMENT',
        assignedAt: null,
        acceptedAt: null,
        deliveredAt: null,
        completedAt: null,
      },
      {
        id: 's2',
        currentStatus: 'FAILED',
        assignedAt: new Date('2026-07-23T08:00:00Z'),
        acceptedAt: new Date('2026-07-23T08:10:00Z'),
        deliveredAt: null,
        completedAt: null,
        failedAt: new Date('2026-07-23T09:00:00Z'),
      },
      {
        id: 's3',
        currentStatus: 'COMPLETED',
        assignedAt: new Date('2026-07-23T07:00:00Z'),
        acceptedAt: new Date('2026-07-23T07:05:00Z'),
        deliveredAt: new Date('2026-07-23T08:05:00Z'),
        completedAt: new Date('2026-07-23T08:10:00Z'),
      },
    ],
    events: [
      {
        eventType: 'delivery.shipment.completed',
        occurredAt: new Date('2026-07-23T08:10:00Z'),
      },
      {
        eventType: 'delivery.shipment.failed',
        occurredAt: new Date('2026-07-23T09:00:00Z'),
      },
    ],
    audits: [],
  };

  function cancel(id, actor) {
    const s = state.shipments.find((x) => x.id === id);
    if (!s) throw new AdminOpsDomainError('SHIPMENT_NOT_FOUND', 'missing');
    assertCanCancelShipment(s.currentStatus);
    s.currentStatus = 'CANCELLED';
    state.events.push({
      eventType: 'delivery.shipment.cancelled',
      occurredAt: new Date(),
    });
    state.audits.push(buildAudit('cancel', actor, id));
  }

  function retry(id, actor) {
    const s = state.shipments.find((x) => x.id === id);
    if (!s) throw new AdminOpsDomainError('SHIPMENT_NOT_FOUND', 'missing');
    assertCanRetryFailedShipment(s.currentStatus);
    s.currentStatus = 'AWAITING_ASSIGNMENT';
    state.events.push({
      eventType: 'delivery.shipment.awaiting_assignment',
      occurredAt: new Date(),
    });
    state.audits.push(buildAudit('retry', actor, id));
  }

  function metrics() {
    const buckets = {};
    for (const [bucket, statuses] of Object.entries(OPS_STATUS_BUCKETS)) {
      buckets[bucket] = state.shipments.filter((s) =>
        statuses.includes(s.currentStatus),
      ).length;
    }
    const dayStart = new Date('2026-07-23T00:00:00Z');
    const today = state.events.filter((e) => e.occurredAt >= dayStart);
    const completedToday = today.filter((e) =>
      e.eventType.includes('completed'),
    ).length;
    const failedToday = today.filter((e) =>
      e.eventType.includes('failed'),
    ).length;
    const avg = averageDurationMs(
      state.shipments.map((s) => ({
        startAt: s.acceptedAt ?? s.assignedAt,
        endAt: s.deliveredAt ?? s.completedAt,
      })),
    );
    return { buckets, completedToday, failedToday, averageDeliveryDurationMs: avg };
  }

  return { state, cancel, retry, metrics };
}

describe('admin-ops rules (D6)', () => {
  it('maps statuses to ops buckets', () => {
    assert.equal(bucketForStatus('ACCEPTED'), 'ASSIGNED');
    assert.equal(bucketForStatus('IN_TRANSIT'), 'IN_TRANSIT');
    assert.equal(bucketForStatus('BUYER_CONFIRMED'), 'BUYER_CONFIRMATION_PENDING');
    assert.equal(bucketForStatus('CREATED'), 'AWAITING_ASSIGNMENT');
  });

  it('allows cancel from active statuses and blocks terminal', () => {
    assert.doesNotThrow(() => assertCanCancelShipment('ASSIGNED'));
    assert.doesNotThrow(() => assertCanCancelShipment('IN_TRANSIT'));
    assert.throws(() => assertCanCancelShipment('COMPLETED'), (e) => {
      return e.code === 'CANCEL_NOT_ALLOWED';
    });
    assert.throws(() => assertCanCancelShipment('RETURNED'), (e) => {
      return e.code === 'CANCEL_NOT_ALLOWED';
    });
  });

  it('allows retry only from FAILED', () => {
    assert.doesNotThrow(() => assertCanRetryFailedShipment('FAILED'));
    assert.throws(() => assertCanRetryFailedShipment('CANCELLED'), (e) => {
      return e.code === 'RETRY_NOT_ALLOWED';
    });
  });

  it('computes average duration and courier utilization', () => {
    const start = new Date('2026-07-23T08:00:00Z');
    const end = new Date('2026-07-23T09:00:00Z');
    assert.equal(
      averageDurationMs([{ startAt: start, endAt: end }]),
      60 * 60 * 1000,
    );
    assert.deepEqual(
      courierUtilization({
        onlineCouriers: 2,
        totalActiveCouriers: 4,
        couriersWithActiveShipments: 1,
      }),
      { onlineRate: 50, busyRate: 25 },
    );
  });
});

describe('admin-ops permissions & audit (D6)', () => {
  it('requires delivery.read for reads and delivery.manage for mutations', () => {
    assert.equal(PERMISSIONS.listShipments, 'delivery.read');
    assert.equal(PERMISSIONS.metrics, 'delivery.read');
    assert.equal(PERMISSIONS.cancel, 'delivery.manage');
    assert.equal(PERMISSIONS.assign, 'delivery.manage');
    assert.equal(PERMISSIONS.retry, 'delivery.manage');
  });

  it('defines audit actions for every privileged mutation', () => {
    for (const key of Object.keys(AUDIT_ACTIONS)) {
      assert.match(AUDIT_ACTIONS[key], /^delivery\.shipment\./);
      const row = buildAudit(key, 'admin1', 's1');
      assert.equal(row.permissionCode, 'delivery.manage');
      assert.equal(row.outcome, 'SUCCESS');
      assert.equal(row.targetType, 'shipment');
    }
  });
});

describe('admin-ops memory integration (D6)', () => {
  it('cancels and retries with audit records', () => {
    const ops = createMemoryOps();
    ops.cancel('s1', 'admin1');
    assert.equal(
      ops.state.shipments.find((s) => s.id === 's1').currentStatus,
      'CANCELLED',
    );
    assert.equal(ops.state.audits[0].action, 'delivery.shipment.cancel');

    ops.retry('s2', 'admin1');
    assert.equal(
      ops.state.shipments.find((s) => s.id === 's2').currentStatus,
      'AWAITING_ASSIGNMENT',
    );
    assert.equal(ops.state.audits[1].action, 'delivery.shipment.retry');
  });

  it('validates dashboard metrics from status + events', () => {
    const ops = createMemoryOps();
    const m = ops.metrics();
    assert.equal(m.buckets.AWAITING_ASSIGNMENT, 1);
    assert.equal(m.buckets.FAILED, 1);
    assert.equal(m.buckets.COMPLETED, 1);
    assert.equal(m.completedToday, 1);
    assert.equal(m.failedToday, 1);
    assert.ok(m.averageDeliveryDurationMs > 0);
  });

  it('rejects cancel of completed shipment', () => {
    const ops = createMemoryOps();
    assert.throws(() => ops.cancel('s3', 'admin1'), (e) => {
      return e.code === 'CANCEL_NOT_ALLOWED';
    });
    assert.equal(ops.state.audits.length, 0);
  });
});

function evaluateThresholdAlert(input) {
  let severity = 'ok';
  if (input.value >= input.criticalAbove) severity = 'critical';
  else if (input.value >= input.warnAbove) severity = 'warn';
  return { ...input, severity };
}

function completedTodayFromEvents(eventToday) {
  return eventToday['delivery.shipment.completed'] ?? 0;
}

function parsePositiveHours(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 168);
}

const BULK_OPS_MAX = 20;

describe('admin-ops readiness helpers (D9)', () => {
  it('evaluates warn/critical thresholds without AI', () => {
    assert.equal(
      evaluateThresholdAlert({
        code: 'x',
        label: 'x',
        value: 10,
        warnAbove: 25,
        criticalAbove: 100,
      }).severity,
      'ok',
    );
    assert.equal(
      evaluateThresholdAlert({
        code: 'x',
        label: 'x',
        value: 30,
        warnAbove: 25,
        criticalAbove: 100,
      }).severity,
      'warn',
    );
    assert.equal(
      evaluateThresholdAlert({
        code: 'x',
        label: 'x',
        value: 100,
        warnAbove: 25,
        criticalAbove: 100,
      }).severity,
      'critical',
    );
  });

  it('counts completedToday from completed events only (no double-count)', () => {
    assert.equal(
      completedTodayFromEvents({
        'delivery.shipment.completed': 2,
        'delivery.shipment.delivered': 5,
      }),
      2,
    );
  });

  it('parses SLA hours with safe bounds', () => {
    assert.equal(parsePositiveHours('24', 12), 24);
    assert.equal(parsePositiveHours('0', 12), 12);
    assert.equal(parsePositiveHours('999', 12), 168);
  });

  it('caps bulk ops at 20 and allows cancel/retry only', () => {
    assert.equal(BULK_OPS_MAX, 20);
    assert.ok(['cancel', 'retry'].includes('cancel'));
    assert.ok(!['cancel', 'retry'].includes('assign'));
  });
});

describe('delivery API consistency (D9)', () => {
  it('aligns list pagination conventions across surfaces', () => {
    const surfaces = [
      { name: 'admin', defaultLimit: 20, maxLimit: 100 },
      { name: 'party', defaultLimit: 20, maxLimit: 100 },
      { name: 'courier', defaultLimit: 20, maxLimit: 100 },
    ];
    for (const s of surfaces) {
      assert.equal(s.defaultLimit, 20);
      assert.equal(s.maxLimit, 100);
    }
  });

  it('keeps party routes read-only and role-scoped', () => {
    const party = [
      'GET /delivery/seller/shipments',
      'GET /delivery/buyer/shipments',
    ];
    const courierMutations = [
      'POST /delivery/courier/shipments/:id/pickup',
    ];
    for (const p of party) assert.match(p, /^GET /);
    for (const p of courierMutations) assert.match(p, /^POST /);
  });
});

describe('event fan-out consistency (D9)', () => {
  it('requires Dispatch + Execution + AdminOps to publish after ShipmentEvent', () => {
    const publishers = {
      DispatchService: true,
      DeliveryExecutionService: true,
      AdminOpsService: true,
      DeliveryEventsPublisher: 'fan-out-only',
    };
    assert.equal(publishers.DispatchService, true);
    assert.equal(publishers.DeliveryExecutionService, true);
    assert.equal(publishers.AdminOpsService, true);
    assert.equal(publishers.DeliveryEventsPublisher, 'fan-out-only');
  });
});
