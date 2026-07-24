# D8 Completion Report — Farmer & Buyer Delivery Experience

**Date:** 2026-07-23  
**Status:** Complete (dev) — **paused for architectural review before D9**  
**Repos:** `nahu-platform` · `nahu-buna-gebaya`

---

## Summary

D8 delivers read-only delivery tracking for farmers and buyers on the existing delivery platform. Apps consume party APIs only; no local business rules and no courier/admin mutations.

---

## Delivered

### API (`nahu-platform`)

| Item | Location |
|------|----------|
| Progress rules (status-only) | `apps/api/src/delivery/tracking.rules.ts` |
| Party read service | `apps/api/src/delivery/party-delivery.service.ts` |
| Seller routes (`FARMER`) | `GET /delivery/seller/shipments`, `.../:id`, `.../orders/:orderId/tracking` |
| Buyer routes (`BUYER`) | `GET /delivery/buyer/shipments`, `.../:id`, `.../orders/:orderId/tracking` |
| Module wiring | `delivery.module.ts` |

Ownership: farmer via `order.farmer.userId`; buyer via `order.buyerId`. Timeline from `ShipmentEvent` (filtered). No SQL migration.

### Shared UI (`nahu-buna-gebaya/shared`)

- `ShipmentStatusBadge`, `DeliveryProgress`, `DeliveryTimeline`, `CourierSummaryCard`, `DeliveryTrackingPanel`
- `shared/delivery/trackingProgress.js` (mirrors API step map)

### Farmer app

- `DeliveryListScreen`, `DeliveryDetailScreen`
- Order detail tracking panel + nav to deliveries
- API: `listSellerShipments`, `getSellerShipment`, `getSellerOrderTracking`

### Buyer app

- `DeliveryHistoryScreen`, `DeliveryDetailScreen`
- Order detail tracking panel + delivery history
- API: `listBuyerShipments`, `getBuyerShipment`, `getBuyerOrderTracking`
- Existing confirm-delivery left unchanged (no new confirmation UX)

### Docs / tests

- Architecture: `docs/07-decisions/d8-farmer-buyer-delivery-experience.md`
- Roadmap v1.8; migration-manifest D8 note (no SQL)
- Tests: `tracking.rules.test.mjs`, `trackingProgress.test.mjs`

---

## Boundaries preserved

| Owner | Responsibility |
|-------|----------------|
| ShipmentAggregateService | State transitions |
| DispatchService | Assignment |
| DeliveryExecutionService | Courier execution |
| AdminOpsService | Admin ops |
| DeliveryEventsPublisher | Emit only |
| PartyDeliveryService | Read-only party views |

---

## Explicitly not in D8

POD capture · buyer confirmation workflow · offline sync · Maps · ETA · AI dispatch · earnings UI · push delivery

---

## How to verify

```sh
# API unit tests
cd apps/api && npm run test:tracking-rules

# Shared progress tests
cd nahu-buna-courier && npm run test:delivery-shared

# Manual smoke
# 1. Farmer: Orders → Deliveries → detail (badge, progress, timeline, courier when assigned)
# 2. Buyer: Orders → Delivery history → detail; order detail tracking panel
# 3. Authz: farmer token cannot hit /delivery/buyer/*; buyer cannot hit /delivery/seller/*
# 4. Exceptions: cancelled/failed/returned show exception progress + friendly errors
```

---

## Gate

**Pause here.** Do not start **D9** (Admin Portal UI polish) until this slice is reviewed and approved.
