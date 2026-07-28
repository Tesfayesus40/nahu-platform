# 34 — G8 Fulfilment & Delivery Orchestration

**Status:** Implemented (backend orchestration layer)  
**Depends on:** RC1 Delivery (dispatch / execution / settlement), OrderStatus dual-write

---

## What shipped

| Area | Change |
|------|--------|
| Migration | `delivery/009_delivery_fulfillment_orchestration.sql` — `orchestration_status`, confirmation + milestone timestamps, assignment `offer_expires_at` |
| Rules | `orchestration.rules.ts` — end-to-end FSM + settlement / confirmation helpers |
| Service | `FulfillmentOrchestrationService` — single owner of orchestration transitions |
| Dispatch | Offer expiry on assign; `timeoutAssignment`; admin `timeout-reassign` with optional auto-reassign |
| APIs | Additive `/fulfillment/*` + `/admin/fulfillment/*` (RC1 routes unchanged) |
| Dual-write | Orchestration ↔ RC1 `OrderStatus` + coarse `FulfillmentCase.status` |
| Payment hook | `OrdersService.confirmPayment` syncs `PLACED → PAID` |

Out of scope (unchanged): AI dispatch, routing, multi-stop, batch, dynamic pricing, external couriers.

---

## Orchestration status machine

```
PLACED → PAID → SELLER_ACCEPTED → PREPARING → READY_FOR_PICKUP
  → COURIER_ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED → SETTLED
```

Also: `CANCELLED`, `EXCEPTION`.  
RC1 `OrderStatus` (`PENDING_PAYMENT` … `COMPLETED`) is **not** renamed.

---

## Assignment engine (basic)

1. List available couriers (`rankCourierCandidates`)
2. Assign with `offer_expires_at` (default 15 min)
3. Courier accept / reject (existing `/delivery/courier/shipments/:id/accept|reject`)
4. Timeout → unassign to `AWAITING_ASSIGNMENT`
5. Reassign (manual or `POST /admin/fulfillment/timeout-reassign`)

---

## Confirmations & settlement

| Gate | Requires |
|------|----------|
| Pickup → `PICKED_UP` | Seller **and** courier pickup confirmation |
| Delivery → settle | Buyer **and** courier delivery confirmation + status `DELIVERED` |
| `SETTLED` | Dual delivery confirm; mirrors order `COMPLETED`; accrues courier settlement when shipment already `COMPLETED` |

---

## Additive APIs

**App (JWT roles):**

- `GET /fulfillment/orders/:orderId`
- `POST /fulfillment/orders/:orderId/seller-accept` — FARMER
- `POST /fulfillment/orders/:orderId/preparing` — FARMER
- `POST /fulfillment/orders/:orderId/ready-for-pickup` — FARMER
- `POST /fulfillment/orders/:orderId/confirm-pickup` — body `{ party: SELLER\|COURIER }`
- `POST /fulfillment/orders/:orderId/confirm-delivery` — body `{ party: BUYER\|COURIER }`
- `POST /fulfillment/orders/:orderId/in-transit` — COURIER

**Admin (`delivery.read` / `delivery.manage`):**

- `GET /admin/fulfillment/orders/:orderId`
- `GET /admin/fulfillment/orders/:orderId/available-couriers`
- `POST /admin/fulfillment/orders/:orderId/assign`
- `POST /admin/fulfillment/orders/:orderId/settle`
- `POST /admin/fulfillment/timeout-reassign`

---

## Tests

```bash
cd apps/api
node --test src/delivery/orchestration.rules.test.mjs
npx tsc --noEmit
```

---

## Compat

- Existing `/orders/*`, `/delivery/*`, admin dispatch & settlement unchanged.
- Readers may ignore `orchestrationStatus` and confirmation timestamps.
- Apply migration `delivery/009` via normal migrate path before using new columns.
