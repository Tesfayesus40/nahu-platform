# A9 — Order & Payment Administration

**Status:** Implemented — Batch 3 (dev; deploy with A10/A11)  
**Date:** 2026-07-22  
**Depends on:** A5 disputes · existing `orders.orders`  

---

## Decision

Admin order queues and guarded transitions over live order rows. Payments remain **read + simulation confirm only** — no provider settlement.

## Permissions

`orders.read` · `orders.transition` · `payments.read`

## API

- `GET /admin/orders` — status / queue (`pending_payment`, `stalled_escrow`) / search  
- `GET /admin/orders/:id` — parties, payment panel, dispute link, fulfillment link, notes  
- `GET /admin/orders/payment-methods`  
- `POST /admin/orders/:id/actions` — CONFIRM_PAYMENT_SIMULATION, CANCEL_UNPAID, START_FULFILLMENT, MARK_SHIPPED, MARK_DELIVERED, COMPLETE_ORDER  
- `POST /admin/orders/:id/notes`

SQL: `orders/011_orders_admin_notes.sql`

## Future

Real payment providers attach under Payments module; Admin continues to read provider status and never invents money movement.
