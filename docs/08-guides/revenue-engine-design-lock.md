# Revenue Engine — Phase 0 Design Lock

**Status:** Approved for implementation (plan `revenue_engine_architecture_ea93abf6`)  
**Date:** 2026-07-27  
**Scope:** Business model & revenue accounting. Real payment-provider rails are Phase 5 scaffolding only.

## Locked incidence model

| Party | Pays / receives |
|-------|-----------------|
| **Buyer** | `goods_subtotal + buyer_platform_fee + delivery_fee` |
| **Farmer** | `goods_subtotal − farmer_platform_fee` |
| **Courier** | `delivery_fee − delivery_commission` (platform-quoted; no negotiation) |
| **Platform revenue** | Buyer fee + Farmer fee + Delivery commission (independent streams) |

Percentages and tariffs are **never hardcoded** in app clients. Source of truth: versioned `pricing.*` schedules. Orders **snapshot** amounts + `fee_schedule_id` at create time.

## Refund / failed-delivery policies (Phase 4)

| Scenario | Goods | Buyer fee | Delivery fee | Courier earning |
|----------|-------|-----------|--------------|-----------------|
| Cancel before pay | N/A | N/A | N/A | None |
| Cancel after pay, before pickup | Full refund | Full refund | Full refund | None / reverse if accrued |
| Failed delivery (courier fault) | Per dispute | Usually refund | Full refund to buyer | Reverse or zero |
| Failed delivery (buyer unavailable) | Per dispute | Usually keep | Partial courier pay allowed via ADJUSTMENT | Partial via ledger |
| Return after delivery | Partial/full goods | Admin allocates | Usually no re-quote | Keep unless reversed |
| Partial refund | Explicit allocation on dispute: `refund_goods_etb`, `refund_buyer_fee_etb`, `refund_delivery_etb` | Never recompute from live rates |

Refund actions remain **intent records** until Phase 5 provider settlement.

## Storage decision

- **DB** `pricing` schema with versioned fee schedules (Admin-editable).
- `ops.system_settings` / feature flags for rollout gates only (`pricing.v1.enabled`, `delivery.dynamic_fee.enabled`).
- Order snapshots are immutable for audit/disputes.

## Phased delivery

1. Marketplace fees (buyer + farmer) + Admin UI  
2. Delivery quote + buyer-paid delivery  
3. Courier payout from delivery fee − commission  
4. Multi-stream refund allocation on disputes  
5. Payment/disbursement rail interfaces (stub providers; no live Telebirr payout yet)

## Implementation status (2026-07-27)

Architecture **approved** with production gates. Full TDD: [revenue-engine-tdd.md](./revenue-engine-tdd.md). Follow-ups: [revenue-engine-roadmap.md](./revenue-engine-roadmap.md).

Shipped in platform + apps:

- `pricing.*` migrations + Nest `PricingModule` (schedules, quotes, admin CRUD)
- Order fee snapshots (`buyer_fee_etb`, `delivery_fee_etb`, `buyer_charge_etb`, …)
- Admin **Pricing** page; order detail fee lines; dispute stream refunds
- Buyer checkout uses `/pricing/active` (marketplace fees); delivery quotes gated by flag
- Settlement accrues `courier_payout_etb` from order snapshot when present
- `pricing.payment_intents` stubs only (no live provider)

### Production gates

1. **`delivery.dynamic_fee.enabled` stays FALSE** until routing + vehicle selection + real distance (roadmap).
2. Pricing rates/tariffs editable **only** via Admin Portal (`pricing.*`).
3. Payment rails remain **accounting stubs** until provider integrations.

Apply migrations (including `ops/011_ops_disable_dynamic_delivery_fee.sql`) before staging review.
