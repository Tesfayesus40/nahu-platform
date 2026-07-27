/**
 * D5 — Delivery execution rules (pure).
 * Controllers must not reimplement; DeliveryExecutionService owns post-accept flow.
 */

import {
  ShipmentStatus,
  canTransitionShipmentStatus,
  isShipmentStatus,
  isTerminalShipmentStatus,
} from './shipment.domain.rules';

export type ExecutionErrorCode =
  | 'SHIPMENT_NOT_FOUND'
  | 'NOT_ASSIGNED_COURIER'
  | 'NO_ACTIVE_ASSIGNMENT'
  | 'INVALID_STATUS'
  | 'TERMINAL_SHIPMENT'
  | 'BUYER_CONFIRM_REQUIRED'
  | 'ILLEGAL_TRANSITION';

export class ExecutionDomainError extends Error {
  constructor(
    public readonly code: ExecutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ExecutionDomainError';
  }
}

export type ExecutionAction =
  | 'startPickup'
  | 'confirmPickup'
  | 'startTransit'
  | 'arriveAtDestination'
  | 'markDelivered'
  | 'completeDelivery'
  | 'markFailed'
  | 'markReturned';

/** Status after a successful (non-idempotent) action. null = event-only. */
export const EXECUTION_TARGET: Record<
  ExecutionAction,
  ShipmentStatus | null
> = {
  startPickup: null, // event-only while ACCEPTED
  confirmPickup: 'PICKED_UP',
  startTransit: 'IN_TRANSIT',
  arriveAtDestination: 'ARRIVED',
  markDelivered: 'DELIVERED',
  completeDelivery: 'COMPLETED',
  markFailed: 'FAILED',
  markReturned: 'RETURNED',
};

export const EXECUTION_REQUIRED_STATUS: Record<
  ExecutionAction,
  readonly ShipmentStatus[]
> = {
  startPickup: ['ACCEPTED'],
  confirmPickup: ['ACCEPTED'],
  startTransit: ['PICKED_UP'],
  arriveAtDestination: ['IN_TRANSIT'],
  markDelivered: ['ARRIVED'],
  completeDelivery: ['DELIVERED', 'BUYER_CONFIRMED'],
  markFailed: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'],
  markReturned: ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'],
};

export function assertCourierMayExecute(input: {
  shipmentStatus: string;
  courierUserId: string;
  assignmentCourierId: string | null;
  denormCourierUserId: string | null;
}): void {
  if (!isShipmentStatus(input.shipmentStatus)) {
    throw new ExecutionDomainError(
      'INVALID_STATUS',
      `Invalid shipment status ${input.shipmentStatus}`,
    );
  }
  if (isTerminalShipmentStatus(input.shipmentStatus as ShipmentStatus)) {
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

export function planExecutionAction(input: {
  action: ExecutionAction;
  currentStatus: string;
  buyerConfirmRequired?: boolean;
  /** When true, startPickup is treated as already recorded (idempotent). */
  hasPickupStarted?: boolean;
}):
  | {
      ok: true;
      idempotent: boolean;
      nextStatus: ShipmentStatus | null;
      eventType: string;
    }
  | { ok: false; error: ExecutionDomainError } {
  if (!isShipmentStatus(input.currentStatus)) {
    return {
      ok: false,
      error: new ExecutionDomainError(
        'INVALID_STATUS',
        `Invalid shipment status ${input.currentStatus}`,
      ),
    };
  }
  const current = input.currentStatus as ShipmentStatus;
  const target = EXECUTION_TARGET[input.action];
  const required = EXECUTION_REQUIRED_STATUS[input.action];

  // Idempotent: already at target
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
    // AD-1: block only while still awaiting buyer acknowledgement at DELIVERED.
    // BUYER_CONFIRMED may be completed by courier/system as a safety net.
    if (current === 'DELIVERED') {
      return {
        ok: false,
        error: new ExecutionDomainError(
          'BUYER_CONFIRM_REQUIRED',
          'Buyer confirmation is required before completion',
        ),
      };
    }
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
