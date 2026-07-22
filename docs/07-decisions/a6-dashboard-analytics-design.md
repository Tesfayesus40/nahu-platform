# A6 — Dashboard Analytics

**Status:** Implemented — Batch 2 (with A7/A8)  
**Date:** 2026-07-22  
**Depends on:** A1–A5 live domain tables  
**Constraint:** Live aggregation only — no second ledger / analytics warehouse.

---

## 1. Decision

`GET /admin/dashboard/summary` returns role-aware live analytics:

- Priority queues + KPI strip
- Sections: users, verification, listings, disputes, marketplace activity, security (7d), health
- 14-day trend series (orders, users, disputes, verifications) when permitted
- Backward-compatible `placeholders` for older clients

Unauthorized sections are omitted (`null`), not zeroed.

## 2. Permissions

Uses existing `admin.dashboard.read`. Nested sections further gated by domain read permissions (`identity.users.read`, `verification.read`, etc.).

## 3. Definitions

| Metric | Definition |
|---|---|
| Active approved listings | `status=ACTIVE` AND `moderationStatus=APPROVED` |
| Open disputes | OPEN + UNDER_REVIEW + ESCALATED |
| Dispute pressure | OPEN + UNDER_REVIEW + 2×ESCALATED |
| Locked users | credentials with `lockedUntil > now()` |

## 4. Admin Web

Dashboard redesigned with KPI cards, bar charts, sparklines, and deep links.

## 5. Tests

`apps/api/src/admin/dashboard.rules.test.mjs`
