# A3 — Farmer & Organization Verification

**Status:** Implemented — awaiting staging migrate + redeploy + acceptance  
**Date:** 2026-07-22  
**Depends on:** A0 architecture · A1 foundation · A2 users  
**Note:** A0 roadmap placed farmer verification under A2 leftovers and cooperatives under A3 catalog/marketplace. This slice delivers the verification workflow as **A3** per product request.

---

## 1. Decision

Ship Admin Portal verification queues for:

| Queue type | Subject source |
|------------|----------------|
| `FARMER` | `marketplace.farmer_profiles` |
| `BUYER` | `identity.users` with `BUYER` role |
| `MERCHANT` | `marketplace.cooperatives` |
| `ORGANIZATION` | `identity.organizations` |

Cases live in `marketplace.verification_cases` with append-only `verification_decisions` and document URL references. Farmer/cooperative `verified` booleans stay synced for mobile compatibility.

## 2. Permissions

| Code | SUPER_ADMIN / PLATFORM_ADMIN | MARKETPLACE_MODERATOR | AUDITOR |
|------|------------------------------|----------------------|---------|
| `verification.read` | yes | yes | yes |
| `farmers.verify` | yes | yes | no |
| `buyers.verify` | yes | no | no |
| `marketplace.merchants.verify` | yes | yes | no |
| `identity.organizations.verify` | yes | no | no |

Seeded in `identity/020_identity_verification_permissions.sql` (also creates `MARKETPLACE_MODERATOR`).

## 3. API

Base: `/api/v1/admin/verification`

- `GET /cases?queue=pending&subjectType=&status=&q=`
- `GET /cases/:id`
- `POST /cases/:id/decisions` — `APPROVE` \| `REJECT` \| `REQUEST_INFO` \| `SUSPEND` \| `START_REVIEW` + `reauthPassword`
- `POST /cases/:id/notes` — reviewer notes
- `POST /cases/:id/documents` — `{ label, fileUrl }`

Dashboard: `GET /admin/dashboard/summary` returns live `pendingVerifications` and `pendingVerificationsByType`.

Audit actions: `verification.{farmer|buyer|merchant|organization}.{decision|note|document.add}`.

## 4. Admin Web

- Nav **Verification** → `/verification`
- Detail `/verification/[id]`
- Dashboard pending count links to `/verification?queue=pending` (and per-type links)

## 5. Staging

1. Apply `marketplace/013` then `identity/020` via public `DATABASE_URL`.
2. Redeploy `nahu-api` and `nahu-admin-web`.
3. Confirm dashboard count and queue actions; check audit log.
