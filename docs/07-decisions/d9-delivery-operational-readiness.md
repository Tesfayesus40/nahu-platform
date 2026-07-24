# D9 — Delivery Platform Integration & Operational Readiness

**Status:** Implemented (dev) — pause for review before D10  
**Date:** 2026-07-23  
**Depends on:** D1–D8  
**Repos:** `nahu-platform` (API + Admin) · shared RN components remain in `nahu-buna-gebaya` (D7/D8)

---

## 1. Service interaction

```text
Admin Portal / Courier / Farmer / Buyer
              │
    ┌─────────┼─────────┬──────────────┐
    ▼         ▼         ▼              ▼
AdminOps   Dispatch  Execution    PartyDelivery
Service    Service   Service      Service (read)
    │         │         │
    └────┬────┴────┬────┘
         ▼         ▼
 ShipmentAggregateService   DeliveryEventsPublisher
         │                  (fan-out only; D9: Dispatch wired)
         ▼
   shipment_events (canonical)
```

Boundaries unchanged: aggregate owns state; Dispatch owns assignment; Execution owns courier actions; AdminOps orchestrates cancel/retry/metrics; publisher never persists.

---

## 2. Shipment lifecycle (ops view)

```text
CREATED → AWAITING_ASSIGNMENT → ASSIGNED → ACCEPTED
  → PICKED_UP → IN_TRANSIT → ARRIVED → DELIVERED
  → [BUYER_CONFIRMED] → COMPLETED

Branches: FAILED / RETURNED / CANCELLED
Retry: FAILED → AWAITING_ASSIGNMENT
```

Every status-changing write goes through `transitionStatus` → exactly one `ShipmentEvent`. Same-status reassignment uses `appendDomainEvent` + publisher.

---

## 3. API overview

| Surface | Prefix | Auth |
|---------|--------|------|
| Admin | `/admin/delivery/**` | Admin JWT + `delivery.read` / `delivery.manage` + reauth on mutations |
| Courier | `/delivery/courier/**` | JWT `COURIER` |
| Seller | `/delivery/seller/**` | JWT `FARMER` (read) |
| Buyer | `/delivery/buyer/**` | JWT `BUYER` (read) |

**D9 additions**

- `GET /admin/delivery/ops/metrics` — delayed SLA counts, alerts, open failed/returned, courier capacity
- `GET /admin/delivery/shipments?staleHours=` — age filter
- `POST /admin/delivery/shipments/bulk` — cancel|retry (max 20)
- Monitoring collectors: `delivery.in_transit`, `delivery.pod_pending`

Pagination convention: `page` (default 1), `limit` (default 20, max 100) on admin/party/courier lists.

---

## 4. Application interaction

| App | Role |
|-----|------|
| Admin web | Ops dashboard, alerts, enriched timeline/progress, filters, bulk, courier capacity |
| Courier | Execution only (D7) |
| Farmer / Buyer | Tracking only (D8); shared RN components |

Admin web delivery components live under `apps/admin-web/components/delivery/` (web). Mobile RN components stay under `shared/components/delivery/` — same concepts, different renderers.

---

## 5. Event consistency audit (resolved / deferred)

| Finding | Resolution |
|---------|------------|
| Dispatch never called `DeliveryEventsPublisher` | **Fixed in D9** — publish after assign/reassign/unassign/accept/reject/release |
| `completedToday` double-counted delivered+completed | **Fixed** — completed events only |
| `stopCount` capped by `take: 4` | **Fixed** — `_count.stops` |
| Alert thresholds not collected | **Fixed** — monitoring + ops alerts |
| No create / buyer-confirm writers | **Documented** — deferred (buyer confirm = later; create path when fulfillment spawn lands) |
| `BUYER_CONFIRMATION_PENDING` maps to `BUYER_CONFIRMED` | **Documented** — pending confirm appears as `DELIVERED` until confirm workflow ships |

Canonical timeline source remains `ShipmentEvent` for Admin, Courier, Farmer, Buyer.

---

## 6. Config

| Key | Purpose |
|-----|---------|
| `delivery.sla.in_transit_hours` | Age SLA (default 24) — migration `ops/008` |
| `delivery.sla.pod_pending_hours` | Age SLA (default 12) — migration `ops/008` |
| `ops.alert_thresholds` `delivery.in_transit` / `delivery.pod_pending` | Count thresholds (D1) |

---

## 7. Out of scope (later)

POD capture UI · buyer confirmation workflow · offline · push · Maps/ETA/AI · earnings/payout UI

---

## 8. Next

**Approved.** Next gate after D10 → **D11**.

**Completion report:** [`docs/08-guides/d9-delivery-operational-readiness-completion-report.md`](../08-guides/d9-delivery-operational-readiness-completion-report.md)
