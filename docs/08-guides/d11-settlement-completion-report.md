# D11 Completion Report — Courier Earnings & Settlement Engine

**Date:** 2026-07-23  
**Status:** Complete (dev) — **paused for architectural review before D12**  
**Repos:** `nahu-platform` · `nahu-buna-gebaya`

---

## Summary

D11 adds `SettlementService` on the immutable `ShipmentEarnings` ledger. Accrual runs only after POD + shipment `COMPLETED`. Admin can review/adjust/reverse; courier sees read-only earnings. No payout rails.

---

## Delivered

| Area | Item |
|------|------|
| Service | `settlement.service.ts`, `settlement.rules.ts` |
| Aggregate | `ShipmentAggregateService.appendEarning` |
| Execution | `completeDelivery` → accrue in same TX; publish after commit |
| Migration | `delivery/006_delivery_earnings_settlement_types.sql` |
| API | Courier `GET …/earnings`; Admin earnings CRUD-style actions |
| Admin | `/delivery/earnings` + detail + BFF |
| Courier | `EarningsScreen` tab |
| Farmer/Buyer | No financial UI |
| Events | `delivery.earning.accrued\|adjusted\|voided` |
| Tests | `npm run test:settlement-rules` |
| Docs | `d11-courier-earnings-settlement.md`; roadmap v2.1 |

---

## Explicitly not in D11

Actual payouts · bank/Stripe/mobile money · tax · invoices · surge/AI pricing · accounting exports · staging E2E matrix (moved toward D12)

---

## Verify

```sh
# Apply delivery/006 on staging
cd apps/api && npm run test:settlement-rules
```

Manual: POD → DELIVERED → COMPLETED → ELIGIBLE earning; Admin approve/adjust/reverse; Courier Earnings tab shows summaries.

---

## Gate

**Pause here.** Do not start **D12** until D11 is architecturally reviewed and approved.
