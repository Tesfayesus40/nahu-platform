# D7 — Courier Delivery Experience

**Status:** Implemented (dev) — pause for review before D8  
**Date:** 2026-07-23  
**Depends on:** D3 courier foundation · D4 Dispatch · D5 Execution · D6 Admin ops  
**Repos:** `nahu-buna-gebaya` (courier app + shared) · light list filters in `nahu-platform`

---

## 1. Architecture

```text
Courier App (UI only)
        │  HTTP JWT COURIER
        ▼
  Nest courier routes
        │
        ├── DispatchService           accept / reject
        ├── DeliveryExecutionService  pickup → complete / fail / return
        ├── ShipmentAggregateService  reads + availability writes
        └── DeliveryEventsPublisher   (server-side on transitions)
```

The mobile app **does not** own transition rules. Shared helpers only suggest which buttons to show; Nest rejects invalid/unauthorized/duplicate/terminal cases.

---

## 2. Work queue

Sections (API `?section=` + client chips):

| Section | Statuses |
|---------|----------|
| available | ASSIGNED |
| accepted | ACCEPTED |
| active | PICKED_UP, IN_TRANSIT, ARRIVED, DELIVERED, BUYER_CONFIRMED |
| completed_today | COMPLETED (completedAt ≥ UTC day start) |
| failed | FAILED |
| returned | RETURNED |

Supports refresh, pagination (`page`/`limit`), and section filter.

---

## 3. Detail + workflow

- Pickup / delivery info, stop navigator, customer phone when present on stops  
- Timeline from `ShipmentEvent` (`timeline` / `recentEvents`)  
- Actions call existing execution/dispatch endpoints only  

---

## 4. Availability

ONLINE / OFFLINE / BUSY / BREAK — PATCH sync with server; pull-to-refresh.

---

## 5. Error handling

`shared/utils/apiErrors.js` maps invalid transition, expired assignment, cancelled, buyer-confirm gate, and network failures. Offline queue **not** implemented (prepared for later).

---

## 6. Tests

```sh
# shared (gebaya)
node --test shared/delivery/queueSections.test.mjs

# platform
cd apps/api && npm run test:courier-queue-rules
```

---

## 7. Explicitly out of D7

POD capture, offline sync, Maps/ETA/AI, earnings UI, buyer confirmation UI (later milestones).

---

## 8. Next

**Approved.** Next gate after D8 → **D9** (Admin Portal UI polish).
