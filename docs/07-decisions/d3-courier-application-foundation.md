# D3 — Courier application foundation

**Status:** Implemented (dev) — pause for review before D4  
**Date:** 2026-07-23  
**Repos:** `nahu-platform` (courier Nest APIs + aggregate service) · `nahu-buna-gebaya` (`nahu-buna-courier/`)

## D2 refinements included

| Item | Done |
|------|------|
| Aggregate write gateway | `ShipmentAggregateService` |
| Immutable events/earnings | triggers in `delivery/004_…` |
| One active assignment | unique index + CHECK |
| Status ↔ exactly one event | `planStatusTransition` + `transitionStatus` |
| Analytics TODO on events | SQL `COMMENT ON TABLE shipment_events` |

## D3 shipped

- Courier Expo scaffold (OTP, tabs: Inbox / Availability / Settings, shipment detail)
- Nest `/delivery/courier/*` wired to Shipment aggregate
- Availability ONLINE/OFFLINE/BUSY/BREAK
- Accept / reject workflows

## Not in D3

DispatchService automation, routing, POD capture, earnings screens, Admin assign UI.

## Next

**Pause.** On approval → **D4** (state machine enforcement, DispatchService, sync, event publisher).
