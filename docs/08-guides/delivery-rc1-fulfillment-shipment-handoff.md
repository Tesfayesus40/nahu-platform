# RC1 — Fulfillment READY → Shipment handoff

**Status:** Implemented  
**Date:** 2026-07-24  
**Freeze:** Feature freeze remains; this is the missing Marketplace → Dispatch integration only.

## Problem

A10 `FulfillmentCase` reached `READY`, but RC1 courier dispatch operates on `Shipment`. No code created a shipment, so Admin Release/Assign and the Courier Work Queue had nothing to work on.

## Integration (no Dispatch bypass)

```text
Order START_FULFILLMENT / MARK_READY
        ↓
FulfillmentCase.status = READY
        ↓
ShipmentAggregateService.createOutboundFromFulfillment  ★ NEW
        · shipment_type = OUTBOUND
        · current_status = CREATED   (not ASSIGNED)
        · stops: PICKUP + DROPOFF from farmer geo + order.deliveryAddress
        ↓
Admin UI: Release  → AWAITING_ASSIGNMENT   (DispatchService)
Admin UI: Assign   → ASSIGNED              (DispatchService)
Courier Available queue ← status ASSIGNED
```

**Not changed:** DispatchService, execution, POD, settlement, courier accept/reject.

## Call sites

| Path | When |
|------|------|
| `AdminOrdersService.upsertFulfillmentTx` | Fulfillment synced to `READY` (e.g. `START_FULFILLMENT`) |
| `AdminDeliveryService.applyAction` | Any action that lands on `READY` (e.g. `MARK_READY`) |

Both are **idempotent**: one active outbound shipment per fulfillment (`uq_shipments_one_active_outbound`).

## Migrations

None required — uses existing `delivery/003`+ schema.

## Ops notes

- Existing staging `READY` fulfillments without shipments: re-apply **Mark Ready** on the fulfillment (idempotent create), or run Start Fulfillment on a new paid order.
- Carrier/Tracking on the fulfillment case remain A10 logistics fields; courier assignment lives on the Shipment.
