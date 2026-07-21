# A5 — Dispute Management

**Status:** Implemented — development batch only (do not deploy)  
**Date:** 2026-07-22  
**Depends on:** A0 · A1 · A2 · A3 · A4  
**Constraint:** No payment-provider refunds; refund actions record intent only.

---

## 1. Decision

Order-level disputes are first-class cases in `orders.dispute_cases`, separate from
the commercial `orders.status = DISPUTED` flag.

Statuses: `OPEN` | `UNDER_REVIEW` | `RESOLVED` | `CLOSED` | `ESCALATED`

- Party `raiseDispute` creates/reopens a case and sets the order to `DISPUTED`.
- Admin resolve / reject / close marks the order `COMPLETED` (manual settlement
  recorded in case notes — no automatic money movement).
- `REFUND` sets `refund_status = RECORDED_PENDING_PROVIDER` with amount/notes only.

## 2. Permissions

| Code | SUPER_ADMIN / PLATFORM_ADMIN | SUPPORT_AGENT | AUDITOR |
|------|------------------------------|---------------|---------|
| `orders.disputes.read` | yes | yes | yes |
| `orders.disputes.manage` | yes | yes | no |

Seeded in `identity/022_identity_dispute_permissions.sql` (also creates
`SUPPORT_AGENT`).

## 3. API

- `GET /admin/disputes` — filters: `status`, `queue=open|all`, `assignedToUserId`, `q`
- `GET /admin/disputes/:id` — buyer/seller, order, evidence, timeline, notes
- `POST /admin/disputes/:id/actions` — START_REVIEW, REQUEST_INFO, REFUND, RESOLVE, REJECT, CLOSE, ESCALATE
- `POST /admin/disputes/:id/assign` / `POST /admin/disputes/assign/bulk`
- `POST /admin/disputes/:id/notes` / `…/evidence`

Dashboard: `openDisputes` + `disputesByStatus` with deep links to `/disputes`.

Audit: `orders.dispute.*` (including `.bulk_assign`).

## 4. Admin Web

- Nav **Disputes** → `/disputes`
- Detail `/disputes/[id]`
- Bulk assign from the queue
- Dashboard open / by-status links

## 5. Staging (when ready — not now)

Apply `orders/010` then `identity/022` with public `DATABASE_URL`, then redeploy
API + admin-web. Do not deploy production.
