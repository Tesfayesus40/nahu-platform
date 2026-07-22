export const FULFILLMENT_STATUSES = [
  'PENDING_HANDOFF',
  'READY',
  'IN_TRANSIT',
  'DELIVERED',
  'EXCEPTION',
  'CLOSED',
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const FULFILLMENT_ACTIONS = [
  'MARK_READY',
  'MARK_IN_TRANSIT',
  'MARK_DELIVERED',
  'RAISE_EXCEPTION',
  'CLOSE',
  'ASSIGN',
  'UPDATE_LOGISTICS',
] as const;

export type FulfillmentAction = (typeof FULFILLMENT_ACTIONS)[number];

export function statusAfterFulfillmentAction(
  action: FulfillmentAction,
  current: FulfillmentStatus,
): FulfillmentStatus {
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
    case 'ASSIGN':
    case 'UPDATE_LOGISTICS':
      return current;
    default:
      return current;
  }
}

export function fulfillmentStatusForOrder(orderStatus: string): FulfillmentStatus {
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

export function requiresFulfillmentReason(action: FulfillmentAction): boolean {
  return action === 'RAISE_EXCEPTION' || action === 'CLOSE';
}
