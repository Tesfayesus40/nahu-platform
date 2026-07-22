# A14 — Platform Monitoring

**Status:** Implemented (Batch 4)  
**Date:** 2026-07-22  
**Depends on:** A6 dashboard · A8 system · A13 notices  

## Decision

Live **monitoring snapshot**: API health + metric collectors + `ops.alert_thresholds` evaluation (`OK` / `WARN` / `CRITICAL`). Optional `emitNotices=true` writes deduped operational notifications via A13.

Metric keys are a registry; Farms / Delivery / AI add collectors without DDL.

## Permissions

| Code | Purpose |
|------|---------|
| `monitoring.read` | View snapshot |

## Seeded thresholds

- `audit.denied.7d` → `audit.denied_7d`
- `orders.stalled_escrow` → `orders.stalled_escrow`
- `delivery.exceptions` → `delivery.exceptions`
- `verification.pending` → `verification.pending`

## API

- `GET /admin/monitoring?emitNotices=`

## Admin Web

Nav **Monitoring** → `/monitoring`

Dashboard KPI/queue: `alertBreaches`.
