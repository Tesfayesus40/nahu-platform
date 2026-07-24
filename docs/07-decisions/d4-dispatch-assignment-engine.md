# D4 — Dispatch service & assignment engine

**Status:** Implemented (dev) — reviewed/approved; superseded next gate is D5→D6  
**Date:** 2026-07-23  
**Depends on:** D2 Shipment aggregate · D3 courier foundation  
**Repos:** `nahu-platform`

---

## 1. Architecture

```text
Admin / Courier controllers
        │
        ▼
  DispatchService          ★ sole owner of assign / reassign / unassign / accept / reject / select
        │
        ├── CourierSelectionStrategy (rule_based_v1)  → swappable for AI later
        │
        ▼
  ShipmentAggregateService ★ sole writer of status + events + assignment rows
        │
        ▼
  delivery.shipments / shipment_assignments / shipment_events
```

Business rules live in `dispatch.rules.ts` (pure). Controllers only authz + DTO + reauth.

### Selection strategy

`RuleBasedCourierSelectionStrategy` scores ONLINE (`AVAILABLE`) couriers by:

1. Delivery zone match (`service_regions` vs `shipment.deliveryZone`; empty regions = wildcard)
2. Spare workload capacity (`max_active_shipments − active count`)

Bound via `COURIER_SELECTION_STRATEGY` token — replace provider for AI without API changes.

---

## 2. APIs

### Admin (`delivery.manage` / `delivery.read`, MFA session + reauth on mutations)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/delivery/shipments/:id/courier-candidates` | Ranked candidates |
| POST | `/admin/delivery/shipments/:id/release` | CREATED → AWAITING_ASSIGNMENT |
| POST | `/admin/delivery/shipments/:id/assign` | Assign (optional `courierUserId` or auto-select) |
| POST | `/admin/delivery/shipments/:id/reassign` | Preserve history; new active assignment |
| POST | `/admin/delivery/shipments/:id/unassign` | Back to AWAITING_ASSIGNMENT |

### Courier (JWT `COURIER`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/delivery/courier/shipments/:id/accept` | → `DispatchService.acceptAssignment` |
| POST | `/delivery/courier/shipments/:id/reject` | → `DispatchService.rejectAssignment` |

---

## 3. Validation rules

- Assign only from `AWAITING_ASSIGNMENT`; no duplicate active assignment
- Courier must exist, active, ONLINE (`AVAILABLE`), under workload cap
- Reassign/unassign from `ASSIGNED` or `ACCEPTED`; history rows retained
- Every status change → exactly one `shipment_events` row via aggregate
- Reassign while `ASSIGNED` appends `delivery.shipment.reassigned` (status unchanged)
- Reject emits `delivery.shipment.rejected` and returns to `AWAITING_ASSIGNMENT`

---

## 4. Config / migration

- `ops/007_ops_delivery_dispatch_config.sql` → `delivery.dispatch.max_active_shipments` (default `3`)

---

## 5. Tests

```sh
cd apps/api
npm run test:dispatch-rules
npm run test:shipment-domain-rules
```

Covers: successful assign, reassign history, reject, duplicate active assignment, offline courier, workload limit, zone selection, event generation.

---

## 6. Explicitly out of D4

AI dispatch, routing, ETA, Maps, batch optimization, POD capture, earnings UI (D5+).

---

## 7. Next

**D5 Delivery Execution Engine** follows (approved separately). See `d5-delivery-execution-engine.md`.
