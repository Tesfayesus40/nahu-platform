# D5 — Delivery Execution Engine

**Status:** Implemented (dev) — reviewed/approved; next gate D6→D7  
**Date:** 2026-07-23  
**Depends on:** D2 Shipment aggregate · D3 courier foundation · D4 Dispatch  
**Repos:** `nahu-platform` (+ shared status labels in `nahu-buna-gebaya`)

---

## 1. Architecture

```text
CourierExecutionController (thin)
        │
        ▼
  DeliveryExecutionService   ★ sole owner of post-accept execution
        │
        ├── execution.rules.ts (authorize + plan transitions)
        ├── DeliveryConfigService (buyer_confirm_required gate)
        ├── DeliveryEventsPublisher (emit only — no delivery yet)
        │
        ▼
  ShipmentAggregateService   ★ sole writer of status + ShipmentEvent
        │
        ▼
  delivery.shipments / shipment_events
```

| Concern | Owner |
|---------|--------|
| Assign / reassign / accept / reject | `DispatchService` (unchanged) |
| Pickup → transit → arrive → deliver → complete / fail / return | `DeliveryExecutionService` |
| Status + event persistence | `ShipmentAggregateService` only |

Shipment remains the aggregate root. Controllers contain no execution business logic.

---

## 2. State machine (D5)

```text
… → ACCEPTED
      ├─(startPickup: event only)─► ACCEPTED + pickup_started
      └─ confirmPickup ─► PICKED_UP
            └─ startTransit ─► IN_TRANSIT
                  └─ arriveAtDestination ─► ARRIVED
                        └─ markDelivered ─► DELIVERED
                              └─ completeDelivery ─► COMPLETED*
Failure / exception paths: CANCELLED | FAILED | RETURNED
```

\* `completeDelivery` from `DELIVERED` only when `delivery.buyer_confirm_required` is **false**. When true, completion waits for buyer confirm (D8).

Strict rules (no skips):

- `ACCEPTED` ↛ `IN_TRANSIT`
- `IN_TRANSIT` ↛ `DELIVERED` (must pass `ARRIVED`)

Invalid transitions → domain error (`INVALID_STATUS` / `ILLEGAL_TRANSITION`).

---

## 3. Authorization

Every execution action requires:

1. Authenticated JWT role `COURIER`
2. Active assignment on the shipment
3. Assignment `courierUserId` === authenticated user
4. Shipment not terminal (`COMPLETED` / `CANCELLED` / `RETURNED` / `FAILED`)
5. Status matches the action’s required preconditions

---

## 4. Events & notifications

- Every **status** change → exactly one immutable `shipment_events` row via `transitionStatus`.
- `startPickup` → event-only (`delivery.shipment.pickup_started`) via `appendDomainEvent` (status unchanged).
- After persist, `DeliveryEventsPublisher.publish(...)` emits the lifecycle publication for future notification/analytics/ETA/AI consumers.
- **No notification delivery** in D5 — publish stub only.
- Canonical stream remains `shipment_events`.

Idempotent re-posts (already at target status) do **not** append a second event and do **not** re-publish.

---

## 5. Courier APIs

All under `POST /delivery/courier/shipments/:id/…` with JWT `COURIER` + courier app flag.

| Path | Service method | Effect |
|------|----------------|--------|
| `pickup/start` | `startPickup` | Event only |
| `pickup` | `confirmPickup` | → `PICKED_UP` |
| `transit` | `startTransit` | → `IN_TRANSIT` |
| `arrived` | `arriveAtDestination` | → `ARRIVED` |
| `delivered` | `markDelivered` | → `DELIVERED` |
| `complete` | `completeDelivery` | → `COMPLETED` (if allowed) |
| `fail` | `markFailed` | → `FAILED` |
| `return` | `markReturned` | → `RETURNED` |

---

## 6. Migration / schema

- `delivery/005_delivery_execution_arrived_status.sql` — `ARRIVED` status + `arrived_at`; active-outbound index includes `ARRIVED`
- Prisma `Shipment.arrivedAt`
- Workload statuses (`DISPATCH_ACTIVE_STATUSES`) include execution through `BUYER_CONFIRMED`

---

## 7. Tests

```sh
cd apps/api
npm run test:execution-rules
npm run test:shipment-domain-rules
npm run test:dispatch-rules
```

Coverage: happy path, invalid transitions, unauthorized courier, duplicate/idempotent requests, cancelled / returned / completed, fail/return paths, event generation, status consistency.

---

## 8. Explicitly out of D5

POD (OTP/photo/signature), route optimization, Maps, ETA prediction, AI dispatch, earnings UI, buyer confirmation UI, Admin execution polish (D6/D9).

---

## 9. Next

**D6 Delivery Operations Administration** follows (approved separately). See `d6-delivery-operations-administration.md`.
