/**
 * G10 — Operations rules (pure): stuck-work classification and summary keys.
 */

export const OPS_STUCK_ORDER_HOURS_DEFAULT = 72;
export const OPS_EXPIRED_OFFER_LOOKBACK_HOURS = 168; // 7d

export const SELLER_PARTY_STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'] as const;
export type SellerPartyStatus = (typeof SELLER_PARTY_STATUSES)[number];

export const SELLER_VERIFICATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const;
export type SellerVerificationStatus =
  (typeof SELLER_VERIFICATION_STATUSES)[number];

export const SELLER_ADMIN_ACTIONS = [
  'VERIFY',
  'REJECT',
  'SUSPEND',
  'ACTIVATE',
] as const;
export type SellerAdminAction = (typeof SELLER_ADMIN_ACTIONS)[number];

export class OpsDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpsDomainError';
  }
}

export function isSellerPartyStatus(v: string): v is SellerPartyStatus {
  return (SELLER_PARTY_STATUSES as readonly string[]).includes(v);
}

export function planSellerAdminAction(
  action: SellerAdminAction,
  current: { status: string; verificationStatus: string },
): {
  status: SellerPartyStatus;
  verified: boolean;
  verificationStatus: SellerVerificationStatus;
} {
  switch (action) {
    case 'VERIFY':
      if (current.status === 'SUSPENDED') {
        throw new OpsDomainError('Cannot verify a suspended seller — activate first');
      }
      return {
        status: current.status === 'INACTIVE' ? 'ACTIVE' : (current.status as SellerPartyStatus),
        verified: true,
        verificationStatus: 'APPROVED',
      };
    case 'REJECT':
      return {
        status: current.status as SellerPartyStatus,
        verified: false,
        verificationStatus: 'REJECTED',
      };
    case 'SUSPEND':
      return {
        status: 'SUSPENDED',
        verified: false,
        verificationStatus: 'SUSPENDED',
      };
    case 'ACTIVATE':
      return {
        status: 'ACTIVE',
        verified: current.verificationStatus === 'APPROVED',
        verificationStatus:
          current.verificationStatus === 'SUSPENDED'
            ? 'APPROVED'
            : (current.verificationStatus as SellerVerificationStatus),
      };
    default:
      throw new OpsDomainError(`Unknown seller admin action: ${action}`);
  }
}

/** Order is "awaiting seller" when paid but not yet seller-accepted / confirmed. */
export function isAwaitingSellerAction(input: {
  orderStatus: string;
  orchestrationStatus?: string | null;
}): boolean {
  if (input.orchestrationStatus === 'PAID') return true;
  return input.orderStatus === 'PAID_ESCROW';
}

export function isAwaitingCourierAssignment(input: {
  shipmentStatus?: string | null;
  orchestrationStatus?: string | null;
}): boolean {
  if (input.shipmentStatus === 'AWAITING_ASSIGNMENT') return true;
  if (input.orchestrationStatus === 'READY_FOR_PICKUP') return true;
  return false;
}

export function isDeliveryInTransit(input: {
  shipmentStatus?: string | null;
  orchestrationStatus?: string | null;
}): boolean {
  const s = input.shipmentStatus;
  if (s === 'PICKED_UP' || s === 'IN_TRANSIT' || s === 'ARRIVED') return true;
  return input.orchestrationStatus === 'IN_TRANSIT' || input.orchestrationStatus === 'PICKED_UP';
}

export function isPaymentPending(paymentStatus?: string | null): boolean {
  return (
    paymentStatus === 'CREATED' ||
    paymentStatus === 'PENDING' ||
    paymentStatus === 'AUTHORIZED' ||
    paymentStatus === 'CAPTURED'
  );
}

export function isSettlementPending(input: {
  paymentStatus?: string | null;
  settlementStatus?: string | null;
}): boolean {
  if (input.settlementStatus === 'IN_PROGRESS' || input.settlementStatus === 'PARTIAL') {
    return true;
  }
  return (
    input.paymentStatus === 'ESCROWED' ||
    input.paymentStatus === 'PARTIALLY_SETTLED'
  );
}

export function isRefundPending(refundStatus?: string | null): boolean {
  return refundStatus === 'REQUESTED' || refundStatus === 'PROCESSING';
}

export function isStuckOrder(input: {
  orderStatus: string;
  updatedAt: Date;
  now?: Date;
  stuckHours?: number;
}): boolean {
  const hours = input.stuckHours ?? OPS_STUCK_ORDER_HOURS_DEFAULT;
  const now = input.now ?? new Date();
  const ageMs = now.getTime() - input.updatedAt.getTime();
  if (ageMs < hours * 60 * 60 * 1000) return false;
  // Terminal states are not stuck
  if (
    input.orderStatus === 'COMPLETED' ||
    input.orderStatus === 'CANCELLED' ||
    input.orderStatus === 'DISPUTED'
  ) {
    return false;
  }
  return true;
}

export function isExpiredCourierOffer(input: {
  offerExpiresAt: Date | null | undefined;
  acceptedAt: Date | null | undefined;
  rejectedAt: Date | null | undefined;
  isActive: boolean;
  now?: Date;
}): boolean {
  if (!input.isActive || input.acceptedAt || input.rejectedAt) return false;
  if (!input.offerExpiresAt) return false;
  const now = input.now ?? new Date();
  return input.offerExpiresAt.getTime() <= now.getTime();
}

/** Domains for audit search presets. */
export const AUDIT_DOMAIN_PREFIXES: Record<string, string[]> = {
  orders: ['orders.'],
  fulfilment: ['delivery.', 'ORCH_', 'fulfillment'],
  payments: ['payment', 'orders.dispute'],
  sellers: ['seller.', 'marketplace.seller', 'verification.'],
};

export function auditActionPrefixesForDomain(domain: string): string[] {
  return AUDIT_DOMAIN_PREFIXES[domain] ?? [];
}
