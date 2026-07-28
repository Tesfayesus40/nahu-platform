/**
 * D11 — Settlement / earnings rules (pure).
 * Controllers must not reimplement; SettlementService owns ledger writes.
 */

import {
  EarningLedgerStatus,
  EarningType,
  buildEarningCorrection,
  sumEarningLedger,
} from './shipment.domain.rules';

export type SettlementErrorCode =
  | 'SHIPMENT_NOT_FOUND'
  | 'EARNING_NOT_FOUND'
  | 'POD_REQUIRED'
  | 'NOT_COMPLETED'
  | 'ALREADY_ACCRUED'
  | 'NOT_ELIGIBLE'
  | 'ALREADY_REVERSED'
  | 'INVALID_AMOUNT'
  | 'FORBIDDEN';

export class SettlementDomainError extends Error {
  constructor(
    public readonly code: SettlementErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SettlementDomainError';
  }
}

export const SETTLEMENT_STATUSES = [
  'PENDING',
  'ELIGIBLE',
  'APPROVED',
  'PAID',
  'REVERSED',
] as const;

export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export type LedgerRow = {
  id: string;
  earningType: string;
  amount: number | string;
  ledgerStatus: string;
  replacesEarningId?: string | null;
  createdAt?: Date | string;
};

/** Primary delivery earning types that start a settlement chain. */
export function isPrimaryDeliveryEarning(type: string): boolean {
  return type === 'DELIVERY_EARNING' || type === 'DROPOFF_FLAT';
}

/**
 * Resolve current settlement status from an append-only chain for one shipment.
 * Later status-marker rows win (PAID > APPROVED > ELIGIBLE); REVERSED/VOID terminal.
 */
export function resolveSettlementStatus(
  rows: ReadonlyArray<LedgerRow>,
): SettlementStatus {
  if (!rows.length) return 'PENDING';
  const statuses = rows.map((r) => r.ledgerStatus);
  if (statuses.some((s) => s === 'REVERSED' || s === 'VOID')) return 'REVERSED';
  if (statuses.some((s) => s === 'PAID')) return 'PAID';
  if (statuses.some((s) => s === 'APPROVED')) return 'APPROVED';
  if (statuses.some((s) => s === 'ELIGIBLE' || s === 'ACCRUED' || s === 'ADJUSTED')) {
    return 'ELIGIBLE';
  }
  if (statuses.some((s) => s === 'PENDING')) return 'PENDING';
  return 'PENDING';
}

export function assertCanAccrue(input: {
  shipmentStatus: string;
  hasVerifiedPod: boolean;
  alreadyAccrued: boolean;
}): void {
  if (input.alreadyAccrued) {
    throw new SettlementDomainError(
      'ALREADY_ACCRUED',
      'Delivery earning already accrued for this shipment',
    );
  }
  if (!input.hasVerifiedPod) {
    throw new SettlementDomainError(
      'POD_REQUIRED',
      'POD must be verified before earnings',
    );
  }
  if (input.shipmentStatus !== 'COMPLETED') {
    throw new SettlementDomainError(
      'NOT_COMPLETED',
      'Shipment must be COMPLETED before earnings accrue',
    );
  }
}

export function planDeliveryAccrual(input: {
  shipmentId: string;
  stopId: string | null;
  courierUserId: string;
  flatEtb: number;
  /** When set (from order snapshot), overrides flatEtb. */
  courierPayoutEtb?: number | null;
  policyCode?: string;
}): {
  earningType: EarningType;
  amount: number;
  ledgerStatus: EarningLedgerStatus;
  policyCode: string;
  currency: string;
} {
  const fromOrder =
    input.courierPayoutEtb != null && Number.isFinite(Number(input.courierPayoutEtb))
      ? Number(input.courierPayoutEtb)
      : null;
  const amount = fromOrder != null
    ? fromOrder
    : Number.isFinite(input.flatEtb)
      ? input.flatEtb
      : 0;
  return {
    earningType: 'DELIVERY_EARNING',
    amount,
    ledgerStatus: 'ELIGIBLE',
    policyCode:
      input.policyCode ||
      (fromOrder != null
        ? 'pricing.delivery.courier_payout'
        : 'delivery.earning.flat_etb'),
    currency: 'ETB',
  };
}

export function planAdjustment(input: {
  originalId: string;
  originalAmount: number;
  correctionAmount: number;
  reference?: string;
}) {
  if (!Number.isFinite(input.correctionAmount)) {
    throw new SettlementDomainError('INVALID_AMOUNT', 'Invalid adjustment amount');
  }
  return buildEarningCorrection({
    originalId: input.originalId,
    originalAmount: input.originalAmount,
    correctionAmount: input.correctionAmount,
    earningType: 'ADJUSTMENT',
    reference: input.reference,
  });
}

export function planReversal(input: {
  originalId: string;
  originalAmount: number;
  reference?: string;
}) {
  return buildEarningCorrection({
    originalId: input.originalId,
    originalAmount: input.originalAmount,
    correctionAmount: 0,
    earningType: 'REVERSAL',
    reference: input.reference,
  });
}

export function planApproveMarker(originalId: string) {
  return {
    earningType: 'OTHER' as EarningType,
    amount: 0,
    ledgerStatus: 'APPROVED' as EarningLedgerStatus,
    replacesEarningId: originalId,
    reference: `approve:${originalId}`,
    policyCode: 'settlement.approve',
  };
}

export function planPaidMarker(originalId: string) {
  return {
    earningType: 'OTHER' as EarningType,
    amount: 0,
    ledgerStatus: 'PAID' as EarningLedgerStatus,
    replacesEarningId: originalId,
    reference: `paid:${originalId}`,
    policyCode: 'settlement.paid',
  };
}

export function assertCanApprove(status: SettlementStatus): void {
  if (status === 'REVERSED') {
    throw new SettlementDomainError(
      'ALREADY_REVERSED',
      'Cannot approve a reversed earning',
    );
  }
  if (status !== 'ELIGIBLE' && status !== 'PENDING') {
    throw new SettlementDomainError(
      'NOT_ELIGIBLE',
      `Cannot approve from status ${status}`,
    );
  }
}

export function assertCanMarkPaid(status: SettlementStatus): void {
  if (status === 'REVERSED') {
    throw new SettlementDomainError(
      'ALREADY_REVERSED',
      'Cannot mark paid a reversed earning',
    );
  }
  if (status !== 'APPROVED' && status !== 'ELIGIBLE') {
    throw new SettlementDomainError(
      'NOT_ELIGIBLE',
      `Cannot mark paid from status ${status}`,
    );
  }
}

export function assertCanReverse(status: SettlementStatus): void {
  if (status === 'REVERSED') {
    throw new SettlementDomainError(
      'ALREADY_REVERSED',
      'Earning already reversed',
    );
  }
  if (status === 'PAID') {
    throw new SettlementDomainError(
      'NOT_ELIGIBLE',
      'Paid earnings require a finance reversal workflow (not in D11)',
    );
  }
}

export function periodBounds(
  period: 'today' | 'week' | 'month',
  now = new Date(),
): { from: Date; to: Date } {
  const to = now;
  const from = new Date(now);
  if (period === 'today') {
    from.setUTCHours(0, 0, 0, 0);
  } else if (period === 'week') {
    from.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    from.setUTCDate(1);
    from.setUTCHours(0, 0, 0, 0);
  }
  return { from, to };
}

export { sumEarningLedger };
