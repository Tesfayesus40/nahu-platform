# A10 — Delivery & Logistics Administration

**Status:** Implemented — Batch 3 (dev)  
**Date:** 2026-07-22  
**Depends on:** A9 order transitions  

---

## Decision

Introduce a thin **`delivery` schema** with 1:1 `fulfillment_cases` on orders. This is an Admin handoff surface, **not** a TMS.

Extension columns reserved for Nahu Delivery:

- `carrier_code`, `tracking_ref`
- exception codes/notes
- event timeline

Future Delivery module can own routing, POD, multi-stop plans without rewriting Admin contracts — it plugs into the same case/events tables and permissions (`delivery.read` / `delivery.manage`).

## API

- `GET /admin/delivery/fulfillments`
- `GET /admin/delivery/fulfillments/:id`
- `POST /admin/delivery/fulfillments/:id/actions`

SQL: `delivery/001`, `delivery/002`
