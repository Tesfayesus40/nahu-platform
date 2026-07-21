# A4 — Listing Moderation

**Status:** Implemented — awaiting staging migrate + redeploy + acceptance  
**Date:** 2026-07-22  
**Depends on:** A0 · A1 · A2 · A3 verification  
**Constraint:** Development batch only — do not deploy to production.

---

## 1. Decision

Marketplace commercial `listing_status` (`ACTIVE` / `RESERVED` / `SOLD` / `CANCELLED`) stays unchanged. Moderation is a separate dimension:

`PENDING` | `APPROVED` | `REJECTED` | `SUSPENDED` | `FLAGGED`

- Existing live listings backfill to `APPROVED`.
- New farmer-created listings start as `PENDING` and are hidden from public browse until approved.
- Reject / suspend also sets commercial status to `CANCELLED`; clear-flag/approve can restore `ACTIVE` when previously cancelled by moderation.

## 2. Permissions

| Code | SUPER_ADMIN / PLATFORM_ADMIN | MARKETPLACE_MODERATOR | AUDITOR |
|------|------------------------------|----------------------|---------|
| `marketplace.listings.read` | yes | yes | yes |
| `marketplace.listings.moderate` | yes | yes | no |

Seeded in `identity/021_identity_listing_moderation_permissions.sql`.

## 3. API

- `GET /admin/listings` — queue filters (`queue=pending`, `moderationStatus`, search)
- `GET /admin/listings/:id`
- `POST /admin/listings/:id/moderation-decisions`
- `POST /admin/listings/:id/moderation-notes`
- `POST /admin/listings/moderation/bulk` — up to 50 IDs

Dashboard adds `pendingListingModeration` and `listingsByModeration`.

Audit: `marketplace.listing.moderation.decision` / `.note` / `.bulk`.

## 4. Admin Web

- Nav **Listings** → `/listings`
- Detail `/listings/[id]`
- Bulk approve/reject/suspend/flag from the queue
- Dashboard links to actionable / flagged / rejected / suspended queues

## 5. Staging (when ready)

Apply `marketplace/014` then `identity/021` with public `DATABASE_URL`, then redeploy API + admin-web. Do not deploy production.
