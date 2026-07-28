/**
 * G8 — Fulfilment orchestration state machine (pure).
 * Additive to RC1 OrderStatus / FulfillmentCase.status / Shipment.currentStatus.
 */

export const ORCHESTRATION_STATUSES = [
  'PLACED',
  'PAID',
  'SELLER_ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COURIER_ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'SETTLED',
  'CANCELLED',
  'EXCEPTION',
] as const;

export type OrchestrationStatus = (typeof ORCHESTRATION_STATUSES)[number];

export const ORCHESTRATION_ACTIONS = [
  'MARK_PAID',
  'SELLER_ACCEPT',
  'START_PREPARING',
  'MARK_READY_FOR_PICKUP',
  'ASSIGN_COURIER',
  'MARK_PICKED_UP',
  'MARK_IN_TRANSIT',
  'MARK_DELIVERED',
  'SETTLE',
  'CANCEL',
  'RAISE_EXCEPTION',
] as const;

export type OrchestrationAction = (typeof ORCHESTRATION_ACTIONS)[number];

/** Default courier offer timeout (minutes). */
export const DEFAULT_ASSIGNMENT_TIMEOUT_MINUTES = 15;

const TRANSITIONS: Record<
  OrchestrationAction,
  { from: OrchestrationStatus[]; to: OrchestrationStatus }
> = {
  MARK_PAID: { from: ['PLACED'], to: 'PAID' },
  SELLER_ACCEPT: { from: ['PAID'], to: 'SELLER_ACCEPTED' },
  START_PREPARING: { from: ['SELLER_ACCEPTED'], to: 'PREPARING' },
  MARK_READY_FOR_PICKUP: {
    from: ['SELLER_ACCEPTED', 'PREPARING'],
    to: 'READY_FOR_PICKUP',
  },
  ASSIGN_COURIER: {
    from: ['READY_FOR_PICKUP', 'COURIER_ASSIGNED'],
    to: 'COURIER_ASSIGNED',
  },
  MARK_PICKED_UP: {
    from: ['COURIER_ASSIGNED'],
    to: 'PICKED_UP',
  },
  MARK_IN_TRANSIT: {
    from: ['PICKED_UP', 'COURIER_ASSIGNED'],
    to: 'IN_TRANSIT',
  },
  MARK_DELIVERED: {
    from: ['IN_TRANSIT', 'PICKED_UP'],
    to: 'DELIVERED',
  },
  SETTLE: { from: ['DELIVERED'], to: 'SETTLED' },
  CANCEL: {
    from: [
      'PLACED',
      'PAID',
      'SELLER_ACCEPTED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'COURIER_ASSIGNED',
    ],
    to: 'CANCELLED',
  },
  RAISE_EXCEPTION: {
    from: [
      'PAID',
      'SELLER_ACCEPTED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'COURIER_ASSIGNED',
      'PICKED_UP',
      'IN_TRANSIT',
      'DELIVERED',
    ],
    to: 'EXCEPTION',
  },
};

export class OrchestrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrchestrationError';
  }
}

export function isOrchestrationStatus(value: string): value is OrchestrationStatus {
  return (ORCHESTRATION_STATUSES as readonly string[]).includes(value);
}

export function nextOrchestrationStatus(
  action: OrchestrationAction,
  current: string,
): OrchestrationStatus {
  const rule = TRANSITIONS[action];
  if (!rule) {
    throw new OrchestrationError(`Unknown orchestration action: ${action}`);
  }
  if (!rule.from.includes(current as OrchestrationStatus)) {
    throw new OrchestrationError(
      `Cannot ${action} from orchestration status ${current}`,
    );
  }
  return rule.to;
}

/** Map RC1 order status → initial orchestration status. */
export function orchestrationFromOrderStatus(orderStatus: string): OrchestrationStatus {
  switch (orderStatus) {
    case 'PENDING_PAYMENT':
      return 'PLACED';
    case 'PAID_ESCROW':
      return 'PAID';
    case 'CONFIRMED':
      return 'SELLER_ACCEPTED';
    case 'SHIPPED':
      return 'IN_TRANSIT';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'COMPLETED':
      return 'SETTLED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'DISPUTED':
      return 'EXCEPTION';
    default:
      return 'PLACED';
  }
}

/** RC1 order status mirror for orchestration milestones (additive dual-write). */
export function orderStatusForOrchestration(
  orchestration: OrchestrationStatus,
): string | null {
  switch (orchestration) {
    case 'PLACED':
      return 'PENDING_PAYMENT';
    case 'PAID':
      return 'PAID_ESCROW';
    case 'SELLER_ACCEPTED':
    case 'PREPARING':
    case 'READY_FOR_PICKUP':
    case 'COURIER_ASSIGNED':
      return 'CONFIRMED';
    case 'PICKED_UP':
    case 'IN_TRANSIT':
      return 'SHIPPED';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'SETTLED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'EXCEPTION':
      return null;
    default:
      return null;
  }
}

export function timestampFieldForStatus(
  status: OrchestrationStatus,
): string | null {
  switch (status) {
    case 'SELLER_ACCEPTED':
      return 'sellerAcceptedAt';
    case 'PREPARING':
      return 'preparingAt';
    case 'READY_FOR_PICKUP':
      return 'readyForPickupAt';
    case 'COURIER_ASSIGNED':
      return 'courierAssignedAt';
    case 'PICKED_UP':
      return 'pickedUpAt';
    case 'IN_TRANSIT':
      return 'inTransitAt';
    case 'DELIVERED':
      return 'deliveredAt';
    case 'SETTLED':
      return 'settledAt';
    default:
      return null;
  }
}

export function pickupFullyConfirmed(input: {
  sellerPickupConfirmedAt?: Date | null;
  courierPickupConfirmedAt?: Date | null;
}): boolean {
  return Boolean(input.sellerPickupConfirmedAt && input.courierPickupConfirmedAt);
}

export function deliveryFullyConfirmed(input: {
  buyerDeliveryConfirmedAt?: Date | null;
  courierDeliveryConfirmedAt?: Date | null;
}): boolean {
  return Boolean(input.buyerDeliveryConfirmedAt && input.courierDeliveryConfirmedAt);
}

export function canSettle(input: {
  orchestrationStatus: string;
  deliveryFullyConfirmed: boolean;
}): boolean {
  return input.orchestrationStatus === 'DELIVERED' && input.deliveryFullyConfirmed;
}

export function assignmentOfferExpired(
  offerExpiresAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!offerExpiresAt) return false;
  return offerExpiresAt.getTime() <= now.getTime();
}
