# A12 — Reporting & Business Intelligence

**Status:** Implemented (Batch 4)  
**Date:** 2026-07-22  
**Depends on:** A0–A11 · ops schema · audit  

## Decision

Ship an Admin Portal **Reports** module with a TypeScript **report type registry** and `ops.report_jobs` ledger. Exports run synchronously for small/medium extracts (row cap) and store CSV artifacts on the job row. No warehouse in this slice.

Domains (Farms, Delivery, AI) extend by adding report types + exporters without schema churn.

## Permissions

| Code | Purpose |
|------|---------|
| `reports.read` | Catalog + job history + download |
| `reports.export` | Run exports (audited) |

## API

- `GET /admin/reports/catalog`
- `GET /admin/reports/jobs`
- `GET /admin/reports/jobs/:id`
- `GET /admin/reports/jobs/:id/download`
- `POST /admin/reports/export`

## Admin Web

Nav **Reports** → `/reports`

## Feature flag

`admin.reports.enabled` (seeded; UI always gated by RBAC).
