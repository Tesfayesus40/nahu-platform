/**
 * AD-1 buyer confirmation rules (pure).
 * Commercial completion is Orders-owned; shipment advances
 * DELIVERED → BUYER_CONFIRMED → COMPLETED as distinct transitions.
 */

export const DELIVERY_CONFIRM_ORDER_STATUSES = [
  'PAID_ESCROW',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
] as const;

export type BuyerConfirmErrorCode =
  | 'ORDER_DISPUTED'
  | 'ALREADY_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'INVALID_ORDER_STATUS'
  | 'SHIPMENT_NOT_DELIVERED'
  | 'CONFIRM_NOT_AVAILABLE';

export class BuyerConfirmDomainError extends Error {
  readonly code: BuyerConfirmErrorCode;

  constructor(code: BuyerConfirmErrorCode, message: string) {
    super(message);
    this.name = 'BuyerConfirmDomainError';
    this.code = code;
  }
}

export type BuyerConfirmInput = {
  orderStatus: string;
  orderDisputed?: boolean;
  activeShipmentStatus?: string | null;
};

export type ShipmentConfirmStep = { from: string; to: string };

export type BuyerConfirmPlanOk = {
  ok: true;
  path: 'DELIVERED_SHIPMENT' | 'BUYER_CONFIRMED_SHIPMENT' | 'LEGACY_ESCROW';
  orderToStatus: 'COMPLETED' | null;
  shipmentTransitions: ShipmentConfirmStep[];
};

export type BuyerConfirmPlanFail = {
  ok: false;
  error: BuyerConfirmDomainError;
};

export type BuyerConfirmPlan = BuyerConfirmPlanOk | BuyerConfirmPlanFail;

export function planBuyerConfirm(input: BuyerConfirmInput): BuyerConfirmPlan {
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
    if (
      !(DELIVERY_CONFIRM_ORDER_STATUSES as readonly string[]).includes(
        orderStatus,
      )
    ) {
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
    if (
      !(DELIVERY_CONFIRM_ORDER_STATUSES as readonly string[]).includes(
        orderStatus,
      )
    ) {
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

export function canConfirmDelivery(input: BuyerConfirmInput): boolean {
  return planBuyerConfirm(input).ok === true;
}
