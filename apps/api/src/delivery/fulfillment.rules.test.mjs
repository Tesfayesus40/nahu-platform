import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function statusAfterFulfillmentAction(action, current) {
  switch (action) {
    case 'MARK_READY':
      return 'READY';
    case 'MARK_IN_TRANSIT':
      return 'IN_TRANSIT';
    case 'MARK_DELIVERED':
      return 'DELIVERED';
    case 'RAISE_EXCEPTION':
      return 'EXCEPTION';
    case 'CLOSE':
      return 'CLOSED';
    default:
      return current;
  }
}

function fulfillmentStatusForOrder(orderStatus) {
  switch (orderStatus) {
    case 'SHIPPED':
      return 'IN_TRANSIT';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'DELIVERED';
    case 'PAID_ESCROW':
    case 'CONFIRMED':
      return 'READY';
    case 'CANCELLED':
      return 'CLOSED';
    case 'DISPUTED':
      return 'EXCEPTION';
    default:
      return 'PENDING_HANDOFF';
  }
}

describe('fulfillment rules', () => {
  it('maps actions and order statuses', () => {
    assert.equal(statusAfterFulfillmentAction('MARK_IN_TRANSIT', 'READY'), 'IN_TRANSIT');
    assert.equal(fulfillmentStatusForOrder('PAID_ESCROW'), 'READY');
    assert.equal(fulfillmentStatusForOrder('SHIPPED'), 'IN_TRANSIT');
  });
});
