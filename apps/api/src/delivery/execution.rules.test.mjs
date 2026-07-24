import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors execution.rules.ts + shipment transition slice used by D5. */

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

const TERMINAL = ['COMPLETED', 'CANCELLED', 'RETURNED', 'FAILED'];

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

const EXECUTION_TARGET = {
  startPickup: null,
  confirmPickup: 'PICKED_UP',
  startTransit: 'IN_TRANSIT',
  arriveAtDestination: 'ARRIVED',
  markDelivered: 'DELIVERED',
  completeDelivery: 'COMPLETED',
  markFailed: 'FAILED',
  markReturned: 'RETURNED',
};

const EXECUTION_REQUIRED_STATUS = {
  startPickup: ['ACCEPTED'],
  confirmPickup: ['ACCEPTED'],
  startTransit: ['PICKED_UP'],
  arriveAtDestination: ['IN_TRANSIT'],
  markDelivered: ['ARRIVED'],
  completeDelivery: ['DELIVERED'],
  markFailed: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'],
  markReturned: ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'],
};

class ExecutionDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function isShipmentStatus(value) {
  return SHIPMENT_STATUSES.includes(value);
}

function isTerminalShipmentStatus(status) {
  return TERMINAL.includes(status);
}

function canTransitionShipmentStatus(from, to) {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

function assertCourierMayExecute(input) {
  if (!isShipmentStatus(input.shipmentStatus)) {
    throw new ExecutionDomainError(
      'INVALID_STATUS',
      `Invalid shipment status ${input.shipmentStatus}`,
    );
  }
  if (isTerminalShipmentStatus(input.shipmentStatus)) {
    throw new ExecutionDomainError(
      'TERMINAL_SHIPMENT',
      `Shipment is terminal (${input.shipmentStatus})`,
    );
  }
  const owner =
    input.assignmentCourierId ?? input.denormCourierUserId ?? null;
  if (!owner) {
    throw new ExecutionDomainError(
      'NO_ACTIVE_ASSIGNMENT',
      'No active assignment on shipment',
    );
  }
  if (owner !== input.courierUserId) {
    throw new ExecutionDomainError(
      'NOT_ASSIGNED_COURIER',
      'Only the assigned courier may execute this shipment',
    );
  }
}

function planExecutionAction(input) {
  if (!isShipmentStatus(input.currentStatus)) {
    return {
      ok: false,
      error: new ExecutionDomainError(
        'INVALID_STATUS',
        `Invalid shipment status ${input.currentStatus}`,
      ),
    };
  }
  const current = input.currentStatus;
  const target = EXECUTION_TARGET[input.action];
  const required = EXECUTION_REQUIRED_STATUS[input.action];

  if (target && current === target) {
    return {
      ok: true,
      idempotent: true,
      nextStatus: target,
      eventType: `delivery.shipment.${target.toLowerCase()}`,
    };
  }

  if (isTerminalShipmentStatus(current) && input.action !== 'completeDelivery') {
    return {
      ok: false,
      error: new ExecutionDomainError(
        'TERMINAL_SHIPMENT',
        `Shipment is terminal (${current})`,
      ),
    };
  }

  if (!required.includes(current)) {
    return {
      ok: false,
      error: new ExecutionDomainError(
        'INVALID_STATUS',
        `Cannot ${input.action} from status ${current}`,
      ),
    };
  }

  if (input.action === 'completeDelivery' && input.buyerConfirmRequired) {
    return {
      ok: false,
      error: new ExecutionDomainError(
        'BUYER_CONFIRM_REQUIRED',
        'Buyer confirmation is required before completion',
      ),
    };
  }

  if (input.action === 'startPickup') {
    return {
      ok: true,
      idempotent: Boolean(input.hasPickupStarted),
      nextStatus: null,
      eventType: 'delivery.shipment.pickup_started',
    };
  }

  if (!target) {
    return {
      ok: false,
      error: new ExecutionDomainError('ILLEGAL_TRANSITION', 'No target status'),
    };
  }

  if (!canTransitionShipmentStatus(current, target)) {
    return {
      ok: false,
      error: new ExecutionDomainError(
        'ILLEGAL_TRANSITION',
        `Illegal transition ${current} → ${target}`,
      ),
    };
  }

  return {
    ok: true,
    idempotent: false,
    nextStatus: target,
    eventType: `delivery.shipment.${
      target === 'IN_TRANSIT' ? 'in_transit' : target.toLowerCase()
    }`,
  };
}

/** In-memory execution engine (integration-style, no DB). */
function createMemoryExecution(opts = {}) {
  const state = {
    shipment: {
      id: 's1',
      currentStatus: opts.status ?? 'ACCEPTED',
      courierUserId: opts.courierUserId ?? 'c1',
    },
    assignment: opts.noAssignment
      ? null
      : {
          id: 'a1',
          courierUserId: opts.assignmentCourierId ?? opts.courierUserId ?? 'c1',
          isActive: true,
        },
    events: [],
    publications: [],
    buyerConfirmRequired: opts.buyerConfirmRequired ?? false,
  };

  function authorize(courierUserId) {
    assertCourierMayExecute({
      shipmentStatus: state.shipment.currentStatus,
      courierUserId,
      assignmentCourierId: state.assignment?.courierUserId ?? null,
      denormCourierUserId: state.shipment.courierUserId,
    });
    if (!state.assignment) {
      throw new ExecutionDomainError(
        'NO_ACTIVE_ASSIGNMENT',
        'No active assignment on shipment',
      );
    }
    if (state.assignment.courierUserId !== courierUserId) {
      throw new ExecutionDomainError(
        'NOT_ASSIGNED_COURIER',
        'Only the assigned courier may execute this shipment',
      );
    }
  }

  function run(courierUserId, action) {
    authorize(courierUserId);
    const hasPickupStarted = state.events.some(
      (e) => e.type === 'delivery.shipment.pickup_started',
    );
    const planned = planExecutionAction({
      action,
      currentStatus: state.shipment.currentStatus,
      buyerConfirmRequired: state.buyerConfirmRequired,
      hasPickupStarted,
    });
    if (!planned.ok) throw planned.error;
    if (planned.idempotent) {
      return { idempotent: true, status: state.shipment.currentStatus };
    }
    const from = state.shipment.currentStatus;
    if (planned.nextStatus == null) {
      state.events.push({
        type: planned.eventType,
        from,
        to: from,
      });
      state.publications.push(planned.eventType);
      return { idempotent: false, status: from, eventOnly: true };
    }
    state.events.push({
      type: planned.eventType,
      from,
      to: planned.nextStatus,
    });
    state.publications.push(planned.eventType);
    state.shipment.currentStatus = planned.nextStatus;
    return { idempotent: false, status: planned.nextStatus };
  }

  return { state, run };
}

describe('execution rules (D5)', () => {
  it('plans the happy-path ACCEPTED → COMPLETED sequence', () => {
    const steps = [
      ['startPickup', null, 'delivery.shipment.pickup_started'],
      ['confirmPickup', 'PICKED_UP', 'delivery.shipment.picked_up'],
      ['startTransit', 'IN_TRANSIT', 'delivery.shipment.in_transit'],
      ['arriveAtDestination', 'ARRIVED', 'delivery.shipment.arrived'],
      ['markDelivered', 'DELIVERED', 'delivery.shipment.delivered'],
      ['completeDelivery', 'COMPLETED', 'delivery.shipment.completed'],
    ];
    let status = 'ACCEPTED';
    for (const [action, next, eventType] of steps) {
      const planned = planExecutionAction({
        action,
        currentStatus: status,
        buyerConfirmRequired: false,
      });
      assert.equal(planned.ok, true);
      assert.equal(planned.idempotent, false);
      assert.equal(planned.nextStatus, next);
      assert.equal(planned.eventType, eventType);
      if (next) status = next;
    }
  });

  it('rejects invalid transitions', () => {
    const bad = planExecutionAction({
      action: 'markDelivered',
      currentStatus: 'ACCEPTED',
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.error.code, 'INVALID_STATUS');

    assert.equal(
      canTransitionShipmentStatus('IN_TRANSIT', 'DELIVERED'),
      false,
    );
    assert.equal(canTransitionShipmentStatus('IN_TRANSIT', 'ARRIVED'), true);
    assert.equal(canTransitionShipmentStatus('ACCEPTED', 'IN_TRANSIT'), false);
  });

  it('rejects unauthorized courier', () => {
    assert.throws(
      () =>
        assertCourierMayExecute({
          shipmentStatus: 'ACCEPTED',
          courierUserId: 'c2',
          assignmentCourierId: 'c1',
          denormCourierUserId: 'c1',
        }),
      (err) => err.code === 'NOT_ASSIGNED_COURIER',
    );
  });

  it('rejects cancelled / completed / returned shipments', () => {
    for (const status of ['CANCELLED', 'COMPLETED', 'RETURNED', 'FAILED']) {
      assert.throws(
        () =>
          assertCourierMayExecute({
            shipmentStatus: status,
            courierUserId: 'c1',
            assignmentCourierId: 'c1',
            denormCourierUserId: 'c1',
          }),
        (err) => err.code === 'TERMINAL_SHIPMENT',
      );
    }
  });

  it('blocks complete when buyer confirm is required', () => {
    const planned = planExecutionAction({
      action: 'completeDelivery',
      currentStatus: 'DELIVERED',
      buyerConfirmRequired: true,
    });
    assert.equal(planned.ok, false);
    assert.equal(planned.error.code, 'BUYER_CONFIRM_REQUIRED');
  });

  it('treats duplicate status actions as idempotent', () => {
    const planned = planExecutionAction({
      action: 'confirmPickup',
      currentStatus: 'PICKED_UP',
    });
    assert.equal(planned.ok, true);
    assert.equal(planned.idempotent, true);
    assert.equal(planned.nextStatus, 'PICKED_UP');
  });

  it('supports fail and return paths', () => {
    const failed = planExecutionAction({
      action: 'markFailed',
      currentStatus: 'IN_TRANSIT',
    });
    assert.equal(failed.ok, true);
    assert.equal(failed.nextStatus, 'FAILED');

    const returned = planExecutionAction({
      action: 'markReturned',
      currentStatus: 'ARRIVED',
    });
    assert.equal(returned.ok, true);
    assert.equal(returned.nextStatus, 'RETURNED');
  });
});

describe('execution memory integration (D5)', () => {
  it('runs complete successful execution with one event per step', () => {
    const eng = createMemoryExecution();
    const actions = [
      'startPickup',
      'confirmPickup',
      'startTransit',
      'arriveAtDestination',
      'markDelivered',
      'completeDelivery',
    ];
    for (const action of actions) {
      eng.run('c1', action);
    }
    assert.equal(eng.state.shipment.currentStatus, 'COMPLETED');
    assert.equal(eng.state.events.length, 6);
    assert.equal(eng.state.publications.length, 6);
    assert.deepEqual(
      eng.state.events.map((e) => e.to),
      [
        'ACCEPTED',
        'PICKED_UP',
        'IN_TRANSIT',
        'ARRIVED',
        'DELIVERED',
        'COMPLETED',
      ],
    );
    // status consistency: final status matches last event.to
    assert.equal(
      eng.state.shipment.currentStatus,
      eng.state.events[eng.state.events.length - 1].to,
    );
  });

  it('rejects unauthorized courier at execution boundary', () => {
    const eng = createMemoryExecution();
    assert.throws(() => eng.run('other', 'confirmPickup'), (err) => {
      return err.code === 'NOT_ASSIGNED_COURIER';
    });
    assert.equal(eng.state.events.length, 0);
    assert.equal(eng.state.shipment.currentStatus, 'ACCEPTED');
  });

  it('duplicate confirmPickup is idempotent (no extra event)', () => {
    const eng = createMemoryExecution();
    eng.run('c1', 'confirmPickup');
    assert.equal(eng.state.events.length, 1);
    const again = eng.run('c1', 'confirmPickup');
    assert.equal(again.idempotent, true);
    assert.equal(eng.state.events.length, 1);
    assert.equal(eng.state.shipment.currentStatus, 'PICKED_UP');
  });

  it('blocks execution on cancelled shipment', () => {
    const eng = createMemoryExecution({ status: 'CANCELLED' });
    assert.throws(() => eng.run('c1', 'confirmPickup'), (err) => {
      return err.code === 'TERMINAL_SHIPMENT';
    });
  });

  it('blocks execution on returned shipment', () => {
    const eng = createMemoryExecution({ status: 'RETURNED' });
    assert.throws(() => eng.run('c1', 'startTransit'), (err) => {
      return err.code === 'TERMINAL_SHIPMENT';
    });
  });

  it('blocks execution on completed shipment', () => {
    const eng = createMemoryExecution({ status: 'COMPLETED' });
    assert.throws(() => eng.run('c1', 'markDelivered'), (err) => {
      return err.code === 'TERMINAL_SHIPMENT';
    });
  });

  it('marks returned mid-flight and stays consistent', () => {
    const eng = createMemoryExecution();
    eng.run('c1', 'confirmPickup');
    eng.run('c1', 'startTransit');
    eng.run('c1', 'markReturned');
    assert.equal(eng.state.shipment.currentStatus, 'RETURNED');
    assert.equal(
      eng.state.events[eng.state.events.length - 1].type,
      'delivery.shipment.returned',
    );
  });

  it('keeps event count equal to non-idempotent execution steps', () => {
    const eng = createMemoryExecution();
    eng.run('c1', 'confirmPickup');
    eng.run('c1', 'startTransit');
    eng.run('c1', 'arriveAtDestination');
    assert.equal(eng.state.events.length, 3);
    assert.equal(eng.state.publications.length, 3);
    for (let i = 0; i < eng.state.events.length; i++) {
      assert.equal(eng.state.events[i].type, eng.state.publications[i]);
    }
  });

  it('does not duplicate startPickup events on retry', () => {
    const eng = createMemoryExecution();
    eng.run('c1', 'startPickup');
    const again = eng.run('c1', 'startPickup');
    assert.equal(again.idempotent, true);
    assert.equal(
      eng.state.events.filter((e) => e.type === 'delivery.shipment.pickup_started')
        .length,
      1,
    );
  });
});
