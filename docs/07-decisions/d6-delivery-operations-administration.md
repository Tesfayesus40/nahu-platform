# D6 — Delivery Operations Administration

**Status:** Implemented (dev) — reviewed/approved; next gate D7→D8  
**Date:** 2026-07-23  
**Depends on:** D2 aggregate · D4 Dispatch · D5 Execution  
**Repos:** `nahu-platform` (API + Admin Portal)

---

## 1. Architecture

```text
Admin Portal (orchestrates only)
        │
        ▼
  AdminOpsService / DispatchService / AdminDeliveryService
        │
        ├── AdminOpsService     ★ list/detail/couriers/metrics/cancel/retry
        ├── DispatchService     ★ assign / reassign / unassign / release
        ├── DeliveryExecutionService  (courier only — not used by admin UI)
        │
        ▼
  ShipmentAggregateService      ★ sole status + ShipmentEvent writer
        │
        ▼
  AuditService + DeliveryEventsPublisher
```

| Concern | Owner |
|---------|--------|
| Assignment | `DispatchService` (unchanged) |
| Cancel / retry failed | `AdminOpsService` → aggregate |
| Courier execution | `DeliveryExecutionService` (not admin) |
| Status + events | `ShipmentAggregateService` |
| Domain event fan-out | `DeliveryEventsPublisher` (emit only) |
| Audit | Existing `AuditService` (`delivery.shipment.*`) |

Controllers and React pages remain thin: authz, DTO, reauth, then service call.

---

## 2. Admin APIs

### Shipments (`delivery.read` / `delivery.manage` + reauth on mutations)

| Method | Path | Owner |
|--------|------|--------|
| GET | `/admin/delivery/shipments` | AdminOpsService.listShipments |
| GET | `/admin/delivery/shipments/:id` | AdminOpsService.getShipmentDetail |
| GET | `/admin/delivery/shipments/:id/courier-candidates` | DispatchService |
| POST | `.../release\|assign\|reassign\|unassign` | DispatchService |
| POST | `.../cancel` | AdminOpsService.cancelShipment |
| POST | `.../retry` | AdminOpsService.retryFailedShipment |

### Ops / couriers

| Method | Path | Owner |
|--------|------|--------|
| GET | `/admin/delivery/ops/metrics` | AdminOpsService.getOpsMetrics |
| GET | `/admin/delivery/couriers` | AdminOpsService.listCouriers |
| GET | `/admin/delivery/couriers/:userId` | AdminOpsService.getCourierOps |

List supports pagination, `q`, `status`, `bucket`, `sort`, `order`.

Ops buckets: Awaiting Assignment, Assigned, In Transit, Arrived, Delivered, Buyer Confirmation Pending, Completed, Failed, Returned, Cancelled.

---

## 3. Admin Portal

| Route | Purpose |
|-------|---------|
| `/delivery` | Operational metrics dashboard |
| `/delivery/shipments` | Shipment ops queue (buckets/filters/sort) |
| `/delivery/shipments/[id]` | Detail + timeline + manual ops |
| `/delivery/couriers` | Courier availability / workload |
| `/delivery/couriers/[userId]` | Courier detail |
| `/delivery/fulfillments` | Legacy A10 fulfillment queue |

BFF under `app/api/delivery/**` proxies to Nest with CSRF on mutations.

---

## 4. Metrics (no AI)

From shipment `current_status` + **ShipmentEvent** (today tallies):

- awaiting assignment, active deliveries
- completed / failed / returned today
- average delivery duration
- courier online % and busy %

---

## 5. Audit

Every privileged mutation writes `AuditService.appendEvent`:

- `delivery.shipment.assign|reassign|unassign|release|cancel|retry`

Release now audited (gap closed from D4).

---

## 6. Tests

```sh
cd apps/api
npm run test:admin-ops-rules
npm run test:execution-rules
npm run test:dispatch-rules
```

Covers: cancel/retry rules, permissions matrix, audit action names, dashboard metric validation, memory integration.

---

## 7. Explicitly out of D6

AI dispatch, Maps/ETA, POD capture, earnings/payout dashboards, buyer confirmation UI, courier app flows (D7).

---

## 8. Next

**D7 Courier Delivery Experience** follows (approved separately). See `d7-courier-delivery-experience.md`.
