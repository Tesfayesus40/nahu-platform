# D11 — Courier Earnings & Settlement Engine

**Status:** Implemented (dev) — paused for architectural review before D12  
**Date:** 2026-07-23  
**Repos:** `nahu-platform` · `nahu-buna-gebaya` (courier)

---

## Purpose

Accrue and administer courier earnings using the **existing append-only** `delivery.shipment_earnings` / Prisma `ShipmentEarning` ledger introduced in D2. No parallel financial models. No payout rails.

## Ownership boundaries (unchanged)

| Concern | Owner |
|---------|--------|
| Shipment state transitions | `ShipmentAggregateService` |
| POD validation | `ProofOfDeliveryService` |
| Execution (post-accept) | `DeliveryExecutionService` |
| Assignment | `DispatchService` |
| Admin ops (cancel/retry/metrics) | `AdminOpsService` |
| **Earnings calculation, settlement, ledger writes** | **`SettlementService`** |
| Event fan-out | `DeliveryEventsPublisher` (existing bus only) |

Controllers and UI are thin: they call SettlementService; they do not compute amounts or mutate ledger rows.

## Accrual path

```text
POD verified (ProofOfDeliveryService)
        ↓
Shipment DELIVERED
        ↓
Shipment COMPLETED (DeliveryExecutionService.completeDelivery)
        ↓
SettlementService.accrueOnCompleted (same TX)
        ↓
append DELIVERY_EARNING row (ledgerStatus = ELIGIBLE)
        ↓
ShipmentEvent delivery.earning.accrued (+ fan-out after commit)
```

Guards: shipment must be `COMPLETED`, at least one POD row present, courier assigned, primary earning not already accrued (idempotent).

Amount source: `DeliveryConfigService.earningFlatEtb()` (`delivery.earning.flat_etb`).

**Note:** When `delivery.buyer_confirm_required` is on, courier `completeDelivery` is blocked until policy allows COMPLETED. Accrual runs only when COMPLETED is reached via execution. Future buyer-confirm → COMPLETED paths should call `SettlementService.accrueOnCompleted` the same way.

## Ledger rules

- **Insert-only** (DB trigger from delivery/004). Never UPDATE amount/status in place.
- Corrections: new rows with `replacesEarningId`.
- Types: `DELIVERY_EARNING`, `DROPOFF_FLAT` (legacy alias), `BONUS`, `ADJUSTMENT`, `REVERSAL`, `PENALTY` (future), `OTHER` (status markers), `VOID`.
- Settlement status derived from chain: `PENDING` → `ELIGIBLE` → `APPROVED` → `PAID`; `REVERSED`/`VOID` terminal.
- Approve / Mark paid: zero-amount `OTHER` marker rows (`APPROVED` / `PAID`). Mark paid is an **ops marker only** — no bank/Stripe/mobile money.
- Reverse: negative `REVERSAL` with `REVERSED`. Blocked if already `PAID` (finance workflow deferred).

## APIs

| Method | Path | Auth |
|--------|------|------|
| GET | `/delivery/courier/earnings` | COURIER |
| GET | `/admin/delivery/earnings` | `delivery.earnings.read` |
| GET | `/admin/delivery/earnings/:id` | `delivery.earnings.read` |
| POST | `/admin/delivery/earnings/:id/approve` | `delivery.earnings.manage` + reauth |
| POST | `/admin/delivery/earnings/:id/mark-paid` | manage + reauth |
| POST | `/admin/delivery/earnings/:id/adjust` | manage + reauth |
| POST | `/admin/delivery/earnings/:id/reverse` | manage + reauth |

## Surfaces

- **Courier:** Earnings tab — today/week/month, completed count, pending settlements, recent rows. No payout CTA.
- **Admin:** `/delivery/earnings` list + detail — review, adjust, reverse, ops mark-paid.
- **Farmer/Buyer:** unchanged (delivery status only).

## Migration

`delivery/006_delivery_earnings_settlement_types.sql` — extends CHECK constraints for types/statuses. Manifest entry present.

## Explicitly out of D11

Payouts · bank · Stripe · mobile money · tax · invoices · surge/AI pricing · accounting exports.
