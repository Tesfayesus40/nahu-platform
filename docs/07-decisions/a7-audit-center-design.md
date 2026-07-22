# A7 — Audit Center

**Status:** Implemented — Batch 2  
**Date:** 2026-07-22  
**Depends on:** A1 `audit.events`, A6 dashboard security strip  

---

## 1. Decision

Enhance the read-only audit viewer into an operational Audit Center:

- Rich filters (action/prefix, outcome, actor, target, date range, request id)
- Event detail with before/after JSON
- 7-day outcome summary + top actions
- CSV export (max 1000 rows) gated by `audit.export`, which itself appends `audit.events.export`

## 2. Permissions

| Code | Roles |
|---|---|
| `audit.read` | SUPER_ADMIN, PLATFORM_ADMIN, AUDITOR (existing) |
| `audit.export` | SUPER_ADMIN, PLATFORM_ADMIN, AUDITOR (identity/023) |

## 3. API

- `GET /admin/audit/events` — expanded query
- `GET /admin/audit/events/:id`
- `GET /admin/audit/summary?days=7`
- `GET /admin/audit/events/export` — JSON `{ filename, body, contentType }`

Indexes: `audit/003_audit_events_filter_indexes.sql`
