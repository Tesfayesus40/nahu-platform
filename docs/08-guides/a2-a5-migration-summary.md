# A2–A5 Migration Summary

**Purpose:** Explain each pending staging migration in the Admin Portal A2–A5 development batch.  
**Execution order:** See [`a2-a5-staging-deployment-checklist.md`](./a2-a5-staging-deployment-checklist.md).  
**Ledger:** `database/migrations/manifest.json`  
**Date:** 2026-07-22  

None of these migrations move money or call payment providers. Refund-related columns on disputes store **intent only**.

---

## Overview

| Order | File | Milestone | Kind |
|---|---|---|---|
| 1 | `identity/019_identity_user_management_permissions.sql` | A2 | Permissions seed |
| 2 | `marketplace/013_marketplace_verification_workflow.sql` | A3 | Schema + backfill |
| 3 | `identity/020_identity_verification_permissions.sql` | A3 | Role + permissions seed |
| 4 | `marketplace/014_marketplace_listing_moderation.sql` | A4 | Schema + backfill |
| 5 | `identity/021_identity_listing_moderation_permissions.sql` | A4 | Permissions seed |
| 6 | `orders/010_orders_dispute_cases.sql` | A5 | Schema + backfill |
| 7 | `identity/022_identity_dispute_permissions.sql` | A5 | Role + permissions seed |

---

## 1. `identity/019_identity_user_management_permissions.sql` (A2)

**What it does:** Inserts Admin Portal user-management permissions and grants them to `SUPER_ADMIN` / `PLATFORM_ADMIN`.

**Permissions added:**

- `identity.users.status.write`
- `identity.roles.assign`
- `identity.users.mfa.reset`
- `identity.users.password.reset`

**Why:** A2 UI/API privileged actions (status, roles, MFA reset, temp password) are gated on these codes. No tables created.

**Depends on:** A1 identity roles/permissions (`identity/018` and earlier).

---

## 2. `marketplace/013_marketplace_verification_workflow.sql` (A3)

**What it does:**

- Adds `verification_status` (and related notes where applicable) on farmer profiles and cooperatives; backfills from existing `verified` flags.
- Creates verification workflow tables: cases, documents, decisions (subject types FARMER, BUYER, MERCHANT, ORGANIZATION).
- Statuses: PENDING, IN_REVIEW, NEEDS_INFO, APPROVED, REJECTED, SUSPENDED (VARCHAR + CHECK).

**Why:** Durable queue and audit trail for participant verification beyond a single boolean.

**Depends on:** Marketplace farmer/cooperative tables; identity users (and orgs for ORGANIZATION subjects).

---

## 3. `identity/020_identity_verification_permissions.sql` (A3)

**What it does:**

- Creates role `MARKETPLACE_MODERATOR` if missing.
- Seeds `verification.read`, `farmers.verify`, `buyers.verify`, `marketplace.merchants.verify`, `identity.organizations.verify`.
- Grants full set to SUPER_ADMIN / PLATFORM_ADMIN; scoped grants to MARKETPLACE_MODERATOR; read to AUDITOR.

**Why:** RBAC for verification queues and subject-specific decide rights.

**Depends on:** Identity roles/permissions tables; should follow #2 so the product surface and authz land together.

---

## 4. `marketplace/014_marketplace_listing_moderation.sql` (A4)

**What it does:**

- Adds `moderation_status`, notes, moderated_at/by on `marketplace.listings`.
- Default / backfill: existing rows → `APPROVED` (keeps current live catalog visible).
- Creates `listing_moderation_decisions` (or equivalent history table) for approve/reject/suspend/flag/note.

**Why:** Separates **moderation** from commercial `listing_status` (ACTIVE / RESERVED / SOLD / CANCELLED). App code starts **new** listings as PENDING after deploy.

**Depends on:** `marketplace.listings`; identity users for moderator FK.

---

## 5. `identity/021_identity_listing_moderation_permissions.sql` (A4)

**What it does:** Seeds `marketplace.listings.read` and `marketplace.listings.moderate`; grants to SUPER_ADMIN / PLATFORM_ADMIN, MARKETPLACE_MODERATOR, and read to AUDITOR.

**Why:** Admin Listings nav and moderate/bulk actions.

**Depends on:** Identity roles; prefers `MARKETPLACE_MODERATOR` from #3 already present.

---

## 6. `orders/010_orders_dispute_cases.sql` (A5)

**What it does:**

- Creates `orders.dispute_cases`, `dispute_events`, `dispute_evidence`, `dispute_notes`.
- Case statuses: OPEN, UNDER_REVIEW, RESOLVED, CLOSED, ESCALATED.
- Refund fields: `refund_status` (NONE / REQUESTED / RECORDED_PENDING_PROVIDER / NOT_APPLICABLE), amount, notes — **no provider settlement**.
- Backfills an OPEN case (+ OPENED event) for every order already in `DISPUTED`.

**Why:** First-class support queue tied 1:1 to an order, with timeline and internal notes.

**Depends on:** `orders.orders`; `identity.users`.

---

## 7. `identity/022_identity_dispute_permissions.sql` (A5)

**What it does:**

- Creates role `SUPPORT_AGENT` if missing.
- Seeds `orders.disputes.read` and `orders.disputes.manage`.
- Grants manage to SUPER_ADMIN / PLATFORM_ADMIN / SUPPORT_AGENT; read to AUDITOR; dashboard read to SUPPORT_AGENT.

**Why:** Dispute queues and privileged actions (assign, resolve, refund intent, escalate).

**Depends on:** Identity roles/permissions; should follow #6.

---

## Idempotency & safety

- Seeds use `ON CONFLICT DO NOTHING` / equivalent grant inserts.
- Schema uses `IF NOT EXISTS` / additive columns where written that way.
- Re-running `node scripts/apply-migrations.mjs` skips already-ledgered files.
- **Not reversible** without a dedicated down migration — do not run against production.

---

## After apply

Redeploy `nahu-api` and `nahu-admin-web`, then execute [`a3-a5-staging-validation-plan.md`](./a3-a5-staging-validation-plan.md).
