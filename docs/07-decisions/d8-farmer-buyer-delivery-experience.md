# D8 — Farmer & Buyer Delivery Experience

**Status:** Implemented (dev) — pause for review before D9  
**Date:** 2026-07-23  
**Depends on:** D2 aggregate · D4–D7 delivery platform  
**Repos:** `nahu-platform` (read APIs) · `nahu-buna-gebaya` (farmer/buyer + shared UI)

---

## 1. Architecture

```text
Farmer / Buyer apps (read-only UI)
        │
        ▼
  SellerDeliveryController  (@Roles FARMER)
  BuyerDeliveryController   (@Roles BUYER)
        │
        ▼
  PartyDeliveryService      ★ ownership via order → fulfillment → shipment
        │
        ▼
  Prisma reads only (no Dispatch / Execution / AdminOps mutations)
```

ShipmentEvent remains the timeline source. Progress is **status-based only** (no ETA).

---

## 2. APIs

| Method | Path | Role |
|--------|------|------|
| GET | `/delivery/seller/shipments` | FARMER |
| GET | `/delivery/seller/shipments/:id` | FARMER |
| GET | `/delivery/seller/orders/:orderId/tracking` | FARMER |
| GET | `/delivery/buyer/shipments` | BUYER |
| GET | `/delivery/buyer/shipments/:id` | BUYER |
| GET | `/delivery/buyer/orders/:orderId/tracking` | BUYER |

Query: `page`, `limit`, `history` (active vs terminal).

Authz: farmer via `order.farmer.userId`; buyer via `order.buyerId`.

---

## 3. Shared UI

`shared/components/delivery/`:

- `ShipmentStatusBadge`
- `DeliveryProgress`
- `DeliveryTimeline`
- `CourierSummaryCard`
- `DeliveryTrackingPanel`

`shared/delivery/trackingProgress.js` — step mapping.

---

## 4. Apps

**Farmer:** Delivery list/detail; OrderDetail tracking panel.  
**Buyer:** Delivery history/detail; OrderDetail tracking panel.  

No courier actions. No new buyer-confirmation workflow in D8.

---

## 5. Tests

```sh
cd apps/api && npm run test:tracking-rules
cd nahu-buna-courier && npm run test:delivery-shared
```

---

## 6. Out of scope

POD, buyer confirmation workflow, offline, Maps/ETA/AI, earnings, push delivery.

---

## 7. Next

**Approved.** Next gate after D9 → **D10**.

**Completion report:** [`docs/08-guides/d8-farmer-buyer-delivery-completion-report.md`](../08-guides/d8-farmer-buyer-delivery-completion-report.md)
