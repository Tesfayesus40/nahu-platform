import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allocateRefund,
  buildOrderMoneySnapshot,
  computeDeliveryCommission,
  computeDeliveryFee,
  computeMarketplaceFees,
} from './pricing.rules.ts';

describe('pricing.rules', () => {
  it('computes buyer and farmer platform fees independently', () => {
    const r = computeMarketplaceFees(1000, { buyerFeePct: 2, farmerFeePct: 2 });
    assert.equal(r.buyerFeeEtb, 20);
    assert.equal(r.farmerFeeEtb, 20);
    assert.equal(r.farmerPayoutEtb, 980);
    assert.equal(r.buyerChargeGoodsEtb, 1020);
  });

  it('computes delivery fee with distance and weight', () => {
    const fee = computeDeliveryFee(
      {
        baseFareEtb: 60,
        perKmEtb: 8,
        perKgEtb: 1,
        perM3Etb: 0,
        minFareEtb: 60,
        maxFareEtb: 1500,
      },
      { distanceKm: 10, weightKg: 20, volumeM3: 0 },
    );
    assert.equal(fee, 160);
  });

  it('splits delivery commission percent', () => {
    const split = computeDeliveryCommission(200, {
      commissionType: 'PERCENT',
      commissionValue: 15,
    });
    assert.equal(split.deliveryCommissionEtb, 30);
    assert.equal(split.courierPayoutEtb, 170);
  });

  it('builds full order money snapshot', () => {
    const snap = buildOrderMoneySnapshot({
      goodsSubtotalEtb: 1000,
      rates: { buyerFeePct: 2, farmerFeePct: 2 },
      deliveryFeeEtb: 200,
      deliveryCommissionEtb: 30,
      courierPayoutEtb: 170,
    });
    assert.equal(snap.buyerChargeEtb, 1220);
    assert.equal(snap.totalEtb, 1000);
    assert.equal(snap.commissionEtb, 20);
  });

  it('allocates refund waterfall goods → buyer fee → delivery', () => {
    const a = allocateRefund({
      goodsSubtotalEtb: 1000,
      buyerFeeEtb: 20,
      deliveryFeeEtb: 200,
      refundAmountEtb: 1050,
    });
    assert.equal(a.refundGoodsEtb, 1000);
    assert.equal(a.refundBuyerFeeEtb, 20);
    assert.equal(a.refundDeliveryEtb, 30);
    assert.equal(a.refundAmountEtb, 1050);
  });
});
