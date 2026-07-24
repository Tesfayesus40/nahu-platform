# Delivery Platform RC1 — Architecture Verification

**Date:** 2026-07-24  
**Method:** Static code review of `apps/api/src/delivery/**` after D12 approval  
**Verdict:** Boundaries **PASS** with documented deviations (non-blocking for RC1)

---

## Ownership matrix (verified)

| Claim | Verification | Result |
|-------|--------------|--------|
| `ShipmentAggregateService` is the only component that persists shipment **status** transitions via `transitionStatus` | Call sites: Dispatch, Execution, POD (ARRIVED→DELIVERED), AdminOps (cancel/retry). Controllers do not call Prisma status updates. | **PASS** |
| `DispatchService` owns assignment only | Accept/reject/assign/reassign/release/unassign live in Dispatch; Aggregate blocks direct accept. | **PASS** |
| `DeliveryExecutionService` owns execution only | Post-accept actions; calls Aggregate + POD + Settlement; no assignment writes. | **PASS** |
| `ProofOfDeliveryService` owns POD only | Create/validate/capture; status change to DELIVERED via Aggregate. | **PASS** |
| `SettlementService` owns financial obligations only | All `appendEarning` from Settlement (via Aggregate helper); no controller math. | **PASS** |
| `AdminOpsService` orchestrates administration only | Lists, metrics, cancel/retry via Aggregate; no accrual/POD rules. | **PASS** |
| `ShipmentEvent` is the canonical event stream | Persist-then-publish via `DeliveryEventsPublisher`; types include lifecycle, POD, earnings. | **PASS** |

---

## Documented deviations (pre-production)

| ID | Severity | Description | RC1 disposition |
|----|----------|-------------|-----------------|
| DEV-1 | Low | `DispatchService` reassign-while-ASSIGNED updates `courierUserId` / timestamps via direct `tx.shipment.update` (status unchanged); event still via `appendDomainEvent`. | **Accepted** — denormalized courier field only; does not fork status machine. Prefer Aggregate helper in Phase 2 cleanup. |
| DEV-2 | Medium | Legacy `FulfillmentCase` remains independently writable (`AdminDeliveryService`). Parallel vocabulary to Shipment. | **Accepted / known limitation** — when Shipment exists, treat `currentStatus` as logistics truth. Do not expand fulfillment logistics in freeze. |
| DEV-3 | Medium | Accrual wired from `DeliveryExecutionService.completeDelivery`. Buyer-confirm paths that complete outside execution may skip accrual until hooked. | **Accepted** — ops monitor; Phase 2 wiring only if confirm→COMPLETED lands outside execution. |
| DEV-4 | Low | `delivery.couriers.manage` seeded but courier list gated by `delivery.read`. | **Accepted** — reserved for future verify/suspend; not a security hole (SUPPORT already has `delivery.read`). |
| DEV-5 | Low | In-process fan-out (no transactional outbox). | **Accepted** — outbox for push/analytics Phase 2. |
| DEV-6 | Low | Controllers may compose responses (e.g. POD requirements on courier get). No business rules relocated. | **Accepted** |

---

## Controllers / UI

- Nest delivery controllers are thin (auth + DTO + service call).
- Admin / Courier / Farmer / Buyer UIs do not compute earnings or invent statuses.
- Farmer/Buyer: read-only tracking APIs (`/delivery/seller/*`, `/delivery/buyer/*`).

---

## Event stream

Canonical persistence: `delivery.shipment_events` (INSERT-only trigger).  
Fan-out: `DeliveryEventsPublisher.publish` **after** transaction commit.

No competing delivery event table or bus found in RC1 code.

---

## Sign-off

Architecture verification complete for RC1 freeze. Deviations DEV-1…DEV-6 documented; none are Sev-1 blockers for staging validation.
