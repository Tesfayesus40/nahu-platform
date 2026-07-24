# Delivery Platform Architecture Report — RC1

**Status:** RC1 candidate  
**Date:** 2026-07-23  
**Scope:** D1–D12 delivery slice (`nahu-platform` + `nahu-buna-gebaya`)  
**Depends on:** D0 SAD · D1–D11 decision docs

---

## 1. Domain model

### Shipment aggregate
Canonical logistics unit. A **Shipment** has ordered **Stops** (pickup / dropoff), optional **Assignments**, append-only **ShipmentEvents**, **ShipmentPods**, and **ShipmentEarnings**.

- Order money / escrow remains on **Order** (marketplace).
- Legacy **FulfillmentCase** remains for A10 handoff ops; **Shipment `currentStatus` is the logistics source of truth** when a shipment exists.

### Proof of Delivery (POD)
`ProofOfDeliveryService` validates capture (OTP / photo / GPS / recipient) per ops flags. ARRIVED → DELIVERED is gated on successful POD. Signature columns are schema-ready only.

### Settlement
`SettlementService` accrues courier obligations on the immutable **ShipmentEarnings** ledger after COMPLETED (and only with POD present). Corrections are new rows (`ADJUSTMENT` / `REVERSAL`). Approve / Mark paid are zero-amount marker rows — **not payout rails**.

### Dispatch
`DispatchService` is the only writer of courier assignment (assign / reassign / release / accept / reject).

### Execution
`DeliveryExecutionService` owns post-accept courier actions through COMPLETED / FAILED / RETURNED.

---

## 2. Service responsibilities

| Service | Owns | Must not |
|---------|------|----------|
| `ShipmentAggregateService` | Status transitions, stops, assignments persistence, POD/earning inserts, domain events | Assignment policy, POD rules, pricing |
| `DispatchService` | Assignment lifecycle | Execution after accept |
| `DeliveryExecutionService` | Post-accept status path | Assignment, financial math |
| `ProofOfDeliveryService` | POD issue / validate / capture | Settlement |
| `SettlementService` | Accrual, adjust, reverse, approve/paid markers, earnings reads | Payout execution |
| `AdminOpsService` | Ops lists, metrics, cancel/retry orchestration | Parallel state machine |
| `DeliveryEventsPublisher` | Post-commit fan-out | Persistence |
| `DeliveryConfigService` | Feature flags / settings | Domain decisions |

Controllers and Admin/mobile UI stay thin.

---

## 3. State machine (shipment lifecycle)

```text
CREATED → AWAITING_ASSIGNMENT → ASSIGNED → ACCEPTED
  → PICKED_UP → IN_TRANSIT → ARRIVED → DELIVERED
  → [BUYER_CONFIRMED] → COMPLETED

Exceptions: CANCELLED | FAILED | RETURNED (FAILED may retry → AWAITING_ASSIGNMENT)
```

Normative transitions emit `delivery.shipment.*` events via the aggregate.

---

## 4. Financial lifecycle

```text
POD verified → DELIVERED → COMPLETED
  → SettlementService.accrueOnCompleted
  → DELIVERY_EARNING (ELIGIBLE)
  → Admin APPROVED (marker) → PAID marker (ops only)
  → Future: payout provider (out of RC1)

Corrections: ADJUSTMENT / REVERSAL rows (never UPDATE amount)
```

Statuses: `PENDING` → `ELIGIBLE` → `APPROVED` → `PAID`; `REVERSED` terminal.

---

## 5. Event architecture

**ShipmentEvent** is the canonical stream. Types include lifecycle, POD (`delivery.pod.*`), and earnings (`delivery.earning.accrued|adjusted|voided`).

`DeliveryEventsPublisher` fans out **after** DB commit. No competing event bus in RC1. Transactional outbox is a Phase-2 extension when push/analytics require stronger delivery guarantees.

---

## 6. RBAC model

| Surface | Auth |
|---------|------|
| Courier app | JWT + role `COURIER` · routes `/delivery/courier/*` |
| Farmer | JWT + `FARMER` · `/delivery/seller/*` |
| Buyer | JWT + `BUYER` · `/delivery/buyer/*` |
| Admin | Admin session + permissions |

Key permissions: `delivery.read`, `delivery.manage`, `delivery.earnings.read`, `delivery.earnings.manage`, `delivery.couriers.manage` (seeded; reserved for future verify/suspend — courier list currently uses `delivery.read`).

Privileged Admin mutations require **reauth** + **audit**.

Mobile **never** calls `/admin/*`.

---

## 7. Cross-application integration

| App | RC1 delivery role |
|-----|-------------------|
| Admin Portal | Ops dashboard, shipments, couriers, fulfillments, earnings review |
| Courier | Inbox, availability, POD capture, execution, earnings (read-only) |
| Farmer | Ready/handoff + tracking (no earnings UI) |
| Buyer | Tracking + handoff PIN / confirm policy (no earnings UI) |
| API | Nest delivery module; single ledger and aggregate |

Status labels: shared EN/AM (`shared/delivery/statusLabels.js`); Admin uses EN helpers. ARRIVED vs DELIVERED Amharic distinguished in D12.

---

## 8. Configuration (ops)

Notable flags/settings (via `DeliveryConfigService`): courier app enable, buyer confirm required, dispatch capacity, POD OTP/photo/GPS/recipient, SLA hours, flat earning ETB.

---

## 9. Extension points (explicitly out of RC1)

| Extension | Notes |
|-----------|--------|
| AI dispatch | Strategy interface already pluggable (`COURIER_SELECTION_STRATEGY`) |
| Route optimization / Maps / ETA | Not wired |
| Offline sync / push | Needs outbox + client queue |
| Signature capture | Columns ready; UI/validation deferred |
| Payment / payout providers | Consume ELIGIBLE→APPROVED→PAID; do not fork ledger |
| Accounting / tax / invoices | Post-RC1 |
| Unify fulfillment ↔ shipment | Documented dual-model; do not invent a third |

---

## 10. Known RC1 limitations (accepted)

1. **FulfillmentCase** and **Shipment** can both be advanced — ops must treat shipment as logistics truth when present.
2. **Buyer confirm → COMPLETED** path may not always call accrual if completion bypasses `DeliveryExecutionService`; monitor and hook when buyer-confirm workflow lands.
3. **Mark paid** may skip APPROVED (ops shortcut) — still ops marker only.
4. **Domain error codes** are not always exposed to mobile clients (message-based mapping).
5. **No transactional outbox** yet.
