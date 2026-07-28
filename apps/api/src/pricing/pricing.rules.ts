/**
 * Pricing / revenue engine — pure calculation rules.
 * Amounts are rounded to 2 decimal places (ETB).
 */

export function roundEtb(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type PlatformFeeRates = {
  buyerFeePct: number;
  farmerFeePct: number;
};

export type MarketplaceFeeBreakdown = {
  goodsSubtotalEtb: number;
  buyerFeeEtb: number;
  farmerFeeEtb: number;
  farmerPayoutEtb: number;
  buyerChargeGoodsEtb: number;
};

/** Marketplace fees on goods only (delivery added separately). */
export function computeMarketplaceFees(
  goodsSubtotalEtb: number,
  rates: PlatformFeeRates,
): MarketplaceFeeBreakdown {
  const goods = roundEtb(Math.max(0, goodsSubtotalEtb));
  const buyerFeeEtb = roundEtb(goods * (Math.max(0, rates.buyerFeePct) / 100));
  const farmerFeeEtb = roundEtb(goods * (Math.max(0, rates.farmerFeePct) / 100));
  const farmerPayoutEtb = roundEtb(goods - farmerFeeEtb);
  return {
    goodsSubtotalEtb: goods,
    buyerFeeEtb,
    farmerFeeEtb,
    farmerPayoutEtb,
    buyerChargeGoodsEtb: roundEtb(goods + buyerFeeEtb),
  };
}

export type DeliveryTariffInput = {
  baseFareEtb: number;
  perKmEtb: number;
  perKgEtb: number;
  perM3Etb: number;
  minFareEtb: number;
  maxFareEtb: number | null;
};

export type DeliveryQuoteInput = {
  distanceKm: number;
  weightKg: number;
  volumeM3: number;
};

export function computeDeliveryFee(
  tariff: DeliveryTariffInput,
  quote: DeliveryQuoteInput,
): number {
  const raw =
    Number(tariff.baseFareEtb) +
    Number(tariff.perKmEtb) * Math.max(0, Number(quote.distanceKm)) +
    Number(tariff.perKgEtb) * Math.max(0, Number(quote.weightKg)) +
    Number(tariff.perM3Etb) * Math.max(0, Number(quote.volumeM3));
  let fee = roundEtb(raw);
  const min = Number(tariff.minFareEtb) || 0;
  if (fee < min) fee = roundEtb(min);
  if (tariff.maxFareEtb != null && Number.isFinite(Number(tariff.maxFareEtb))) {
    const max = Number(tariff.maxFareEtb);
    if (fee > max) fee = roundEtb(max);
  }
  return fee;
}

export type DeliveryCommissionInput = {
  commissionType: 'PERCENT' | 'FIXED' | string;
  commissionValue: number;
};

export function computeDeliveryCommission(
  deliveryFeeEtb: number,
  commission: DeliveryCommissionInput,
): { deliveryCommissionEtb: number; courierPayoutEtb: number } {
  const fee = roundEtb(Math.max(0, deliveryFeeEtb));
  let commissionEtb = 0;
  if (commission.commissionType === 'FIXED') {
    commissionEtb = roundEtb(Math.min(fee, Math.max(0, Number(commission.commissionValue))));
  } else {
    commissionEtb = roundEtb(fee * (Math.max(0, Number(commission.commissionValue)) / 100));
  }
  if (commissionEtb > fee) commissionEtb = fee;
  return {
    deliveryCommissionEtb: commissionEtb,
    courierPayoutEtb: roundEtb(fee - commissionEtb),
  };
}

export type OrderMoneySnapshot = MarketplaceFeeBreakdown & {
  deliveryFeeEtb: number;
  deliveryCommissionEtb: number;
  courierPayoutEtb: number;
  buyerChargeEtb: number;
  /** Legacy: goods subtotal (unchanged meaning of total_etb for listing math). */
  totalEtb: number;
  /** Legacy alias of farmerFeeEtb. */
  commissionEtb: number;
};

export function buildOrderMoneySnapshot(input: {
  goodsSubtotalEtb: number;
  rates: PlatformFeeRates;
  deliveryFeeEtb?: number;
  deliveryCommissionEtb?: number;
  courierPayoutEtb?: number;
}): OrderMoneySnapshot {
  const market = computeMarketplaceFees(input.goodsSubtotalEtb, input.rates);
  const deliveryFeeEtb = roundEtb(Math.max(0, input.deliveryFeeEtb ?? 0));
  const deliveryCommissionEtb = roundEtb(Math.max(0, input.deliveryCommissionEtb ?? 0));
  const courierPayoutEtb = roundEtb(
    input.courierPayoutEtb != null
      ? Math.max(0, input.courierPayoutEtb)
      : Math.max(0, deliveryFeeEtb - deliveryCommissionEtb),
  );
  return {
    ...market,
    deliveryFeeEtb,
    deliveryCommissionEtb,
    courierPayoutEtb,
    buyerChargeEtb: roundEtb(market.buyerChargeGoodsEtb + deliveryFeeEtb),
    totalEtb: market.goodsSubtotalEtb,
    commissionEtb: market.farmerFeeEtb,
  };
}

export type RefundAllocationInput = {
  goodsSubtotalEtb: number;
  buyerFeeEtb: number;
  deliveryFeeEtb: number;
  refundGoodsEtb?: number;
  refundBuyerFeeEtb?: number;
  refundDeliveryEtb?: number;
  /** If only total provided, allocate goods → buyer fee → delivery. */
  refundAmountEtb?: number;
  policyCode?: string;
};

export type RefundAllocation = {
  refundGoodsEtb: number;
  refundBuyerFeeEtb: number;
  refundDeliveryEtb: number;
  refundAmountEtb: number;
  refundPolicyCode: string;
};

export function allocateRefund(input: RefundAllocationInput): RefundAllocation {
  const policy = input.policyCode || 'manual';
  if (
    input.refundGoodsEtb != null ||
    input.refundBuyerFeeEtb != null ||
    input.refundDeliveryEtb != null
  ) {
    const refundGoodsEtb = roundEtb(
      Math.min(Number(input.goodsSubtotalEtb) || 0, Math.max(0, Number(input.refundGoodsEtb) || 0)),
    );
    const refundBuyerFeeEtb = roundEtb(
      Math.min(Number(input.buyerFeeEtb) || 0, Math.max(0, Number(input.refundBuyerFeeEtb) || 0)),
    );
    const refundDeliveryEtb = roundEtb(
      Math.min(Number(input.deliveryFeeEtb) || 0, Math.max(0, Number(input.refundDeliveryEtb) || 0)),
    );
    return {
      refundGoodsEtb,
      refundBuyerFeeEtb,
      refundDeliveryEtb,
      refundAmountEtb: roundEtb(refundGoodsEtb + refundBuyerFeeEtb + refundDeliveryEtb),
      refundPolicyCode: policy,
    };
  }

  let remaining = roundEtb(Math.max(0, Number(input.refundAmountEtb) || 0));
  const goodsCap = roundEtb(Math.max(0, Number(input.goodsSubtotalEtb) || 0));
  const buyerCap = roundEtb(Math.max(0, Number(input.buyerFeeEtb) || 0));
  const deliveryCap = roundEtb(Math.max(0, Number(input.deliveryFeeEtb) || 0));

  const refundGoodsEtb = roundEtb(Math.min(goodsCap, remaining));
  remaining = roundEtb(remaining - refundGoodsEtb);
  const refundBuyerFeeEtb = roundEtb(Math.min(buyerCap, remaining));
  remaining = roundEtb(remaining - refundBuyerFeeEtb);
  const refundDeliveryEtb = roundEtb(Math.min(deliveryCap, remaining));

  return {
    refundGoodsEtb,
    refundBuyerFeeEtb,
    refundDeliveryEtb,
    refundAmountEtb: roundEtb(refundGoodsEtb + refundBuyerFeeEtb + refundDeliveryEtb),
    refundPolicyCode: policy || 'waterfall_goods_fee_delivery',
  };
}
