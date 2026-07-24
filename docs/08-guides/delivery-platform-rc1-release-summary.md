# Delivery Platform RC1 — Official Release Summary

**Document type:** Official RC1 reference  
**Date:** 2026-07-24  
**Status:** Architecturally approved · Feature freeze ACTIVE · Production gated on live staging sign-off  
**Repos:** `nahu-platform` · `nahu-buna-gebaya`

---

## 1. Purpose

This is the authoritative Release Candidate 1 summary for the Nahu Delivery Platform. It supersedes informal milestone notes for release decisions. Phase 2 work must not start under this freeze.

---

## 2. Completed milestones (D1–D12)

| ID | Title | Outcome |
|----|-------|---------|
| **D1** | Identity, RBAC, config | `COURIER` role, delivery permissions, ops flags/settings |
| **D2** | Schema & Prisma | Shipment aggregate, stops, POD, assignments, immutable earnings, events |
| **D3** | Courier app foundation | Expo courier shell, OTP, availability |
| **D4** | Dispatch engine | `DispatchService`, assignment rules, events |
| **D5** | Execution engine | Post-accept lifecycle via `DeliveryExecutionService` |
| **D6** | Admin operations | Ops lists, cancel/retry, courier ops surfaces |
| **D7** | Courier RC1 flows | Accept → execute → POD UX |
| **D8** | Farmer/Buyer delivery UX | Tracking, handoff; no financial UI |
| **D9** | Operational readiness | Metrics, SLA thresholds, Admin polish |
| **D10** | Proof of Delivery | `ProofOfDeliveryService`; ARRIVED→DELIVERED gated |
| **D11** | Earnings & settlement | `SettlementService` on append-only ledger |
| **D12** | RC1 freeze & hardening | Idempotency, indexes, docs, regression |

---

## 3. Implemented architecture (summary)

### Aggregate & services

- **Shipment** = stops + assignments + pods + earnings + events  
- **ShipmentAggregateService** — persists status transitions and related rows  
- **DispatchService** — assignment only  
- **DeliveryExecutionService** — execution only  
- **ProofOfDeliveryService** — POD only  
- **SettlementService** — financial obligations only  
- **AdminOpsService** — admin orchestration  
- **DeliveryEventsPublisher** — post-commit fan-out  

### Lifecycle

```text
CREATED → AWAITING_ASSIGNMENT → ASSIGNED → ACCEPTED
→ PICKED_UP → IN_TRANSIT → ARRIVED → DELIVERED
→ [BUYER_CONFIRMED] → COMPLETED
(+ CANCELLED | FAILED | RETURNED)
```

### Financial path

```text
POD verified → DELIVERED → COMPLETED → ELIGIBLE earning
→ Admin APPROVED → PAID marker (ops only; no payout rail)
Corrections: ADJUSTMENT / REVERSAL (append-only)
```

### Events

`delivery.shipment_events` is the single canonical stream (lifecycle, POD, earnings).

### Clients

| Client | RC1 capability |
|--------|----------------|
| Admin Portal | Ops, shipments, couriers, fulfillments, earnings review |
| Courier | Inbox, availability, execution, POD, earnings (read-only) |
| Farmer / Buyer | Tracking / handoff only |

Full detail: `docs/07-decisions/d12-delivery-platform-rc1-architecture.md`  
Verification: `docs/08-guides/delivery-rc1-architecture-verification.md`

---

## 4. Known limitations (RC1)

1. **Dual model:** `FulfillmentCase` (legacy A10) vs **Shipment** — shipment status is logistics truth when both exist.  
2. **Accrual hook:** Primary path is execution `completeDelivery`; other COMPLETED entry points need monitoring.  
3. **Mark paid** is an ops marker — **no** bank/Stripe/mobile-money payout.  
4. **No transactional outbox** — fan-out is in-process after commit.  
5. **`delivery.couriers.manage`** reserved; list uses `delivery.read`.  
6. **Signature capture** schema-ready only.  
7. Live staging E2E sign-off may still be pending at document time — see staging validation report.

---

## 5. Deferred Phase 2 features (do not implement in freeze)

Recorded for roadmap only:

- AI courier selection  
- Route optimization  
- ETA prediction  
- Google Maps integration  
- Offline synchronization  
- Push notifications  
- Signature capture (UI/validation)  
- Payment gateway integration  
- Payout execution  
- Accounting integration  
- Dynamic / surge pricing  
- Batch optimization  

---

## 6. Production prerequisites

- [ ] Feature freeze acknowledged by engineering  
- [ ] Migrations through `delivery/007` applied on target env  
- [ ] Feature flags / flat earning / POD / buyer-confirm reviewed  
- [ ] Roles & permissions verified (Admin + Courier OTP)  
- [ ] Automated delivery regression green  
- [ ] **Live staging checklist signed** (`d12-delivery-staging-validation-checklist.md`)  
- [ ] Rollback plan understood (flags first; reversals not UPDATEs)  
- [ ] Architecture deviations accepted (`delivery-rc1-architecture-verification.md`)

---

## 7. Deployment sequence

1. DB backup / snapshot  
2. Apply SQL migrations (manifest order → `delivery/007`)  
3. Deploy API  
4. Deploy Admin web  
5. Ship / point mobile apps  
6. Smoke happy path + earnings approve + Farmer/Buyer tracking  
7. Monitor ops metrics / audit  
8. Production only after staging sign-off  

Detail: `docs/08-guides/d12-delivery-deployment-checklist.md`  
Readiness review: `docs/08-guides/delivery-rc1-production-readiness-review.md`

---

## 8. Rollback strategy

| Priority | Action |
|----------|--------|
| 1 | Disable `delivery.courier_app.enabled` (and/or tighten POD flags) |
| 2 | Redeploy prior API/Admin artifacts (keep additive migrations) |
| 3 | Correct earnings with **REVERSAL** / **ADJUSTMENT** rows |
| 4 | Avoid dropping RC1 unique indexes under load |

---

## 9. Freeze & quality evidence

| Artifact | Path |
|----------|------|
| Feature freeze | `docs/08-guides/delivery-rc1-feature-freeze.md` |
| Architecture verification | `docs/08-guides/delivery-rc1-architecture-verification.md` |
| Staging validation report | `docs/08-guides/d12-delivery-staging-validation-report.md` |
| Staging checklist | `docs/08-guides/d12-delivery-staging-validation-checklist.md` |
| D12 completion | `docs/08-guides/d12-rc1-completion-report.md` |

**Automated regression (2026-07-24 re-run):** settlement, execution, POD, dispatch, admin-ops, domain, tracking, courier-queue — all green.

---

## 10. Decision

| Question | Answer |
|----------|--------|
| Architecturally approved? | **Yes** |
| Feature freeze? | **Active** |
| Phase 2 started? | **No** |
| Production authorized? | **Only after live staging sign-off** |

---

*End of official Delivery Platform RC1 Release Summary.*
