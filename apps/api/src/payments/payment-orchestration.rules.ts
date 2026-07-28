/**
 * G9 — Payment orchestration state machine (pure).
 * Independent from fulfilment; dual-writes RC1 OrderStatus where needed.
 */

export const PAYMENT_STATUSES = [
  'CREATED',
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'ESCROWED',
  'PARTIALLY_SETTLED',
  'SETTLED',
  'REFUNDED',
  'FAILED',
  'CANCELLED',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ESCROW_STATUSES = [
  'NONE',
  'HELD',
  'PARTIALLY_RELEASED',
  'RELEASED',
  'REFUNDED',
] as const;

export type EscrowStatus = (typeof ESCROW_STATUSES)[number];

export const SETTLEMENT_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'PARTIAL',
  'COMPLETED',
] as const;

export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const REFUND_STATUSES = [
  'NONE',
  'REQUESTED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const PAYMENT_ACTIONS = [
  'INITIATE',
  'AUTHORIZE',
  'CAPTURE',
  'ESCROW',
  /** Stub / RC1 confirm-payment: PENDING → ESCROWED in one business step. */
  'CAPTURE_TO_ESCROW',
  'PARTIAL_SETTLE',
  'SETTLE',
  'REFUND',
  'FAIL',
  'CANCEL',
] as const;

export type PaymentAction = (typeof PAYMENT_ACTIONS)[number];

export const REFUND_REASONS = [
  'SELLER_REJECTION',
  'BUYER_CANCELLATION',
  'DELIVERY_FAILURE',
  'ADMIN_CANCELLATION',
] as const;

export type RefundReason = (typeof REFUND_REASONS)[number];

export const SETTLEMENT_PARTIES = ['FARMER', 'COURIER', 'PLATFORM'] as const;
export type SettlementParty = (typeof SETTLEMENT_PARTIES)[number];

const TRANSITIONS: Record<
  PaymentAction,
  { from: PaymentStatus[]; to: PaymentStatus }
> = {
  INITIATE: { from: ['CREATED'], to: 'PENDING' },
  AUTHORIZE: { from: ['PENDING'], to: 'AUTHORIZED' },
  CAPTURE: { from: ['AUTHORIZED'], to: 'CAPTURED' },
  ESCROW: { from: ['CAPTURED'], to: 'ESCROWED' },
  CAPTURE_TO_ESCROW: { from: ['PENDING', 'AUTHORIZED', 'CAPTURED'], to: 'ESCROWED' },
  PARTIAL_SETTLE: { from: ['ESCROWED', 'PARTIALLY_SETTLED'], to: 'PARTIALLY_SETTLED' },
  SETTLE: { from: ['ESCROWED', 'PARTIALLY_SETTLED'], to: 'SETTLED' },
  REFUND: {
    from: [
      'PENDING',
      'AUTHORIZED',
      'CAPTURED',
      'ESCROWED',
      'PARTIALLY_SETTLED',
    ],
    to: 'REFUNDED',
  },
  FAIL: { from: ['PENDING', 'AUTHORIZED'], to: 'FAILED' },
  CANCEL: { from: ['CREATED', 'PENDING'], to: 'CANCELLED' },
};

export class PaymentOrchestrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentOrchestrationError';
  }
}

export function nextPaymentStatus(
  action: PaymentAction,
  current: string,
): PaymentStatus {
  const rule = TRANSITIONS[action];
  if (!rule) {
    throw new PaymentOrchestrationError(`Unknown payment action: ${action}`);
  }
  if (!rule.from.includes(current as PaymentStatus)) {
    throw new PaymentOrchestrationError(
      `Cannot ${action} from payment status ${current}`,
    );
  }
  return rule.to;
}

export function paymentStatusFromOrder(orderStatus: string): PaymentStatus {
  switch (orderStatus) {
    case 'PENDING_PAYMENT':
      return 'PENDING';
    case 'PAID_ESCROW':
    case 'CONFIRMED':
    case 'SHIPPED':
    case 'DELIVERED':
    case 'DISPUTED':
      return 'ESCROWED';
    case 'COMPLETED':
      return 'SETTLED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'CREATED';
  }
}

export function escrowStatusAfter(action: PaymentAction): EscrowStatus | null {
  switch (action) {
    case 'ESCROW':
    case 'CAPTURE_TO_ESCROW':
      return 'HELD';
    case 'PARTIAL_SETTLE':
      return 'PARTIALLY_RELEASED';
    case 'SETTLE':
      return 'RELEASED';
    case 'REFUND':
      return 'REFUNDED';
    default:
      return null;
  }
}

export function timestampFieldForPayment(status: PaymentStatus): string | null {
  switch (status) {
    case 'PENDING':
      return 'pendingAt';
    case 'AUTHORIZED':
      return 'authorizedAt';
    case 'CAPTURED':
      return 'capturedAt';
    case 'ESCROWED':
      return 'escrowedAt';
    case 'SETTLED':
      return 'settledAt';
    case 'REFUNDED':
      return 'refundedAt';
    case 'FAILED':
      return 'failedAt';
    case 'CANCELLED':
      return 'cancelledAt';
    default:
      return null;
  }
}

export function isRefundReason(value: string): value is RefundReason {
  return (REFUND_REASONS as readonly string[]).includes(value);
}

export function canRefundPayment(status: string): boolean {
  return TRANSITIONS.REFUND.from.includes(status as PaymentStatus);
}

export function canSettlePayment(status: string): boolean {
  return TRANSITIONS.SETTLE.from.includes(status as PaymentStatus);
}

/** Platform take from Revenue Engine snapshot fields. */
export function computePlatformRevenue(input: {
  buyerFeeEtb: number;
  farmerFeeEtb: number;
  deliveryCommissionEtb: number;
}): number {
  return round2(
    (Number(input.buyerFeeEtb) || 0) +
      (Number(input.farmerFeeEtb) || 0) +
      (Number(input.deliveryCommissionEtb) || 0),
  );
}

export type SettlementPlanLine = {
  partyCode: SettlementParty;
  amountEtb: number;
};

/** Build settlement lines from order / payment case Revenue Engine snapshot. */
export function planSettlementFromSnapshot(input: {
  farmerPayoutEtb: number;
  courierPayoutEtb: number;
  buyerFeeEtb: number;
  farmerFeeEtb: number;
  deliveryCommissionEtb: number;
}): SettlementPlanLine[] {
  const platform = computePlatformRevenue(input);
  const lines: SettlementPlanLine[] = [
    { partyCode: 'FARMER', amountEtb: round2(Math.max(0, input.farmerPayoutEtb)) },
    { partyCode: 'COURIER', amountEtb: round2(Math.max(0, input.courierPayoutEtb)) },
    { partyCode: 'PLATFORM', amountEtb: platform },
  ];
  return lines.filter((l) => l.amountEtb > 0);
}

export function settlementCompleteness(lines: Array<{ status: string; amountEtb: number }>): {
  allReleased: boolean;
  anyReleased: boolean;
  settlementStatus: SettlementStatus;
} {
  const actionable = lines.filter((l) => l.amountEtb > 0);
  if (actionable.length === 0) {
    return {
      allReleased: true,
      anyReleased: false,
      settlementStatus: 'COMPLETED',
    };
  }
  const released = actionable.filter((l) => l.status === 'RELEASED');
  const allReleased = released.length === actionable.length;
  const anyReleased = released.length > 0;
  return {
    allReleased,
    anyReleased,
    settlementStatus: allReleased
      ? 'COMPLETED'
      : anyReleased
        ? 'PARTIAL'
        : 'IN_PROGRESS',
  };
}

export function availableEscrowRelease(
  held: number,
  released: number,
  refunded: number,
): number {
  return round2(Math.max(0, held - released - refunded));
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
