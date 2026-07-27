import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors buyer-confirm.rules.ts */

const DELIVERY_CONFIRM_ORDER_STATUSES = [
  'PAID_ESCROW',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
];

class BuyerConfirmDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function planBuyerConfirm(input) {
  const {
    orderStatus,
    orderDisputed = false,
    activeShipmentStatus = null,
  } = input;

  if (orderDisputed || orderStatus === 'DISPUTED') {
    return {
      ok: false,
      error: new BuyerConfirmDomainError(
        'ORDER_DISPUTED',
        'Cannot confirm delivery while the order is disputed',
      ),
    };
  }
  if (orderStatus === 'COMPLETED') {
    return {
      ok: false,
      error: new BuyerConfirmDomainError(
        'ALREADY_COMPLETED',
        'Order is already completed',
      ),
    };
  }
  if (orderStatus === 'CANCELLED') {
    return {
      ok: false,
      error: new BuyerConfirmDomainError(
        'ORDER_CANCELLED',
        'Cannot confirm a cancelled order',
      ),
    };
  }

  if (activeShipmentStatus === 'DELIVERED') {
    if (!DELIVERY_CONFIRM_ORDER_STATUSES.includes(orderStatus)) {
      return {
        ok: false,
        error: new BuyerConfirmDomainError(
          'INVALID_ORDER_STATUS',
          `Cannot confirm delivery while order is ${orderStatus}`,
        ),
      };
    }
    return {
      ok: true,
      path: 'DELIVERED_SHIPMENT',
      orderToStatus: 'COMPLETED',
      shipmentTransitions: [
        { from: 'DELIVERED', to: 'BUYER_CONFIRMED' },
        { from: 'BUYER_CONFIRMED', to: 'COMPLETED' },
      ],
    };
  }

  if (activeShipmentStatus === 'BUYER_CONFIRMED') {
    if (!DELIVERY_CONFIRM_ORDER_STATUSES.includes(orderStatus)) {
      return {
        ok: false,
        error: new BuyerConfirmDomainError(
          'INVALID_ORDER_STATUS',
          `Cannot confirm delivery while order is ${orderStatus}`,
        ),
      };
    }
    return {
      ok: true,
      path: 'BUYER_CONFIRMED_SHIPMENT',
      orderToStatus: 'COMPLETED',
      shipmentTransitions: [{ from: 'BUYER_CONFIRMED', to: 'COMPLETED' }],
    };
  }

  if (activeShipmentStatus != null && activeShipmentStatus !== 'COMPLETED') {
    return {
      ok: false,
      error: new BuyerConfirmDomainError(
        'SHIPMENT_NOT_DELIVERED',
        `Shipment must be DELIVERED before buyer confirmation (got ${activeShipmentStatus})`,
      ),
    };
  }

  if (orderStatus === 'PAID_ESCROW') {
    return {
      ok: true,
      path: 'LEGACY_ESCROW',
      orderToStatus: 'COMPLETED',
      shipmentTransitions: [],
    };
  }

  return {
    ok: false,
    error: new BuyerConfirmDomainError(
      'CONFIRM_NOT_AVAILABLE',
      'Confirm delivery is not available for this order',
    ),
  };
}

function canConfirmDelivery(input) {
  return planBuyerConfirm(input).ok === true;
}

/** Minimal shipment SM used by the e2e workflow simulation. */
const TRANSITIONS = {
  DELIVERED: ['BUYER_CONFIRMED', 'COMPLETED', 'RETURNED', 'FAILED'],
  BUYER_CONFIRMED: ['COMPLETED', 'RETURNED'],
  COMPLETED: [],
};

function applyShipmentTransitions(start, steps) {
  let status = start;
  const events = [];
  for (const step of steps) {
    assert.equal(status, step.from, `expected from ${step.from}, got ${status}`);
    assert.ok(
      TRANSITIONS[status]?.includes(step.to),
      `illegal ${status} → ${step.to}`,
    );
    events.push({ from: status, to: step.to });
    status = step.to;
  }
  return { status, events };
}

describe('planBuyerConfirm', () => {
  it('plans DELIVERED → BUYER_CONFIRMED → COMPLETED as distinct transitions', () => {
    const planned = planBuyerConfirm({
      orderStatus: 'CONFIRMED',
      activeShipmentStatus: 'DELIVERED',
    });
    assert.equal(planned.ok, true);
    assert.equal(planned.path, 'DELIVERED_SHIPMENT');
    assert.equal(planned.orderToStatus, 'COMPLETED');
    assert.deepEqual(planned.shipmentTransitions, [
      { from: 'DELIVERED', to: 'BUYER_CONFIRMED' },
      { from: 'BUYER_CONFIRMED', to: 'COMPLETED' },
    ]);
    assert.equal(planned.shipmentTransitions.length, 2);
  });

  it('allows confirm for post-fulfillment order statuses with delivered shipment', () => {
    for (const orderStatus of ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'PAID_ESCROW']) {
      assert.equal(
        planBuyerConfirm({
          orderStatus,
          activeShipmentStatus: 'DELIVERED',
        }).ok,
        true,
        orderStatus,
      );
    }
  });

  it('blocks confirm when shipment is still in transit', () => {
    const planned = planBuyerConfirm({
      orderStatus: 'CONFIRMED',
      activeShipmentStatus: 'IN_TRANSIT',
    });
    assert.equal(planned.ok, false);
    assert.equal(planned.error.code, 'SHIPMENT_NOT_DELIVERED');
  });

  it('keeps legacy PAID_ESCROW confirm when there is no active shipment', () => {
    const planned = planBuyerConfirm({
      orderStatus: 'PAID_ESCROW',
      activeShipmentStatus: null,
    });
    assert.equal(planned.ok, true);
    assert.equal(planned.path, 'LEGACY_ESCROW');
    assert.deepEqual(planned.shipmentTransitions, []);
  });

  it('blocks disputed and completed orders', () => {
    assert.equal(
      planBuyerConfirm({
        orderStatus: 'DISPUTED',
        activeShipmentStatus: 'DELIVERED',
      }).ok,
      false,
    );
    assert.equal(
      planBuyerConfirm({
        orderStatus: 'COMPLETED',
        activeShipmentStatus: 'DELIVERED',
      }).ok,
      false,
    );
  });
});

describe('canConfirmDelivery', () => {
  it('gates UI on delivered shipment or legacy escrow', () => {
    assert.equal(
      canConfirmDelivery({
        orderStatus: 'CONFIRMED',
        activeShipmentStatus: 'DELIVERED',
      }),
      true,
    );
    assert.equal(
      canConfirmDelivery({
        orderStatus: 'PAID_ESCROW',
        activeShipmentStatus: null,
      }),
      true,
    );
    assert.equal(
      canConfirmDelivery({
        orderStatus: 'CONFIRMED',
        activeShipmentStatus: 'ASSIGNED',
      }),
      false,
    );
  });
});

describe('e2e workflow: courier DELIVERED → buyer confirm → order COMPLETED', () => {
  it('runs full AD-1 closeout with BUYER_CONFIRMED visible in the event stream', () => {
    const order = { status: 'CONFIRMED' };
    const shipment = { status: 'DELIVERED' };

    assert.equal(
      canConfirmDelivery({
        orderStatus: order.status,
        activeShipmentStatus: shipment.status,
      }),
      true,
    );

    const planned = planBuyerConfirm({
      orderStatus: order.status,
      activeShipmentStatus: shipment.status,
    });
    assert.equal(planned.ok, true);

    const { status, events } = applyShipmentTransitions(
      shipment.status,
      planned.shipmentTransitions,
    );

    assert.equal(events.length, 2);
    assert.deepEqual(events[0], { from: 'DELIVERED', to: 'BUYER_CONFIRMED' });
    assert.deepEqual(events[1], { from: 'BUYER_CONFIRMED', to: 'COMPLETED' });
    assert.equal(status, 'COMPLETED');

    // BUYER_CONFIRMED must appear as its own acknowledged state in history.
    assert.ok(events.some((e) => e.to === 'BUYER_CONFIRMED'));

    order.status = planned.orderToStatus;
    shipment.status = status;
    assert.equal(order.status, 'COMPLETED');
    assert.equal(shipment.status, 'COMPLETED');

    assert.equal(
      canConfirmDelivery({
        orderStatus: order.status,
        activeShipmentStatus: shipment.status,
      }),
      false,
    );
  });
});
