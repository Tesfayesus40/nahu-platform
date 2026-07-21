# A2–A5 Staging Deployment Checklist

**Batch:** Admin Portal A2 User Management · A3 Verification · A4 Listing Moderation · A5 Dispute Management  
**Environment:** Staging only  
**Production:** Frozen — do not deploy this batch to production  
**Date:** 2026-07-22  

Related docs:

- Migration summary → [`a2-a5-migration-summary.md`](./a2-a5-migration-summary.md)
- Staging validation plan → [`a3-a5-staging-validation-plan.md`](./a3-a5-staging-validation-plan.md)
- A1 runbook (migrate/deploy mechanics) → [`a1-staging-validation-handoff.md`](./a1-staging-validation-handoff.md)
- Manifest guide → [`migration-manifest.md`](./migration-manifest.md)

---

## 0. Preconditions

| Check | Notes |
|---|---|
| A1 applied on staging | Through `identity/018` + `audit/001`–`002` |
| Railway project | `nahu-platform-api` / environment `staging` |
| Services | `nahu-api`, `nahu-admin-web`, Postgres |
| Laptop migrate | Use **public** `DATABASE_PUBLIC_URL` only — never `railway.internal` |
| Secrets | No new required env vars for A2–A5 beyond A1 (`ADMIN_MFA_ENCRYPTION_KEY`, token TTLs, etc.) |

Confirm ledger before applying:

```powershell
cd C:\NahuAI\nahu-platform
$env:DATABASE_URL = "<DATABASE_PUBLIC_URL>"
# Optional: inspect applied files via your usual ledger query / apply script dry output
node scripts/apply-migrations.mjs
# Script is idempotent — already-applied files are skipped
Remove-Item Env:DATABASE_URL
```

---

## 1. Pending migrations (execution order)

Apply **exactly** in this order (matches `database/migrations/manifest.json`).  
Each identity permissions migration depends on the prior domain schema migration in the same milestone.

| # | Migration file | Milestone | Depends on |
|---|---|---|---|
| 1 | `identity/019_identity_user_management_permissions.sql` | A2 | A1 roles/permissions (`identity/018`); `identity.permissions` / `role_permissions` |
| 2 | `marketplace/013_marketplace_verification_workflow.sql` | A3 | `marketplace.farmer_profiles`, `marketplace.cooperatives`, `identity.users` / `organizations` |
| 3 | `identity/020_identity_verification_permissions.sql` | A3 | A1 roles; creates `MARKETPLACE_MODERATOR`; ideally after #2 |
| 4 | `marketplace/014_marketplace_listing_moderation.sql` | A4 | `marketplace.listings`; `identity.users` (moderator FK) |
| 5 | `identity/021_identity_listing_moderation_permissions.sql` | A4 | A1 roles + preferably `MARKETPLACE_MODERATOR` from #3 |
| 6 | `orders/010_orders_dispute_cases.sql` | A5 | `orders.orders`; `identity.users` |
| 7 | `identity/022_identity_dispute_permissions.sql` | A5 | A1 roles; creates `SUPPORT_AGENT` |

### Dependency notes

- **Do not reorder** domain SQL ahead of its matching permissions seed when both are pending — schema first, then grants.
- **A2** only seeds permissions; no new tables.
- **A3** alters farmer/cooperative columns and creates verification case tables; permissions seed can run alone but APIs expect both.
- **A4** backfills existing listings to `moderation_status = APPROVED`; new creates become `PENDING` in app code after deploy.
- **A5** backfills `dispute_cases` for orders already `DISPUTED`; refund columns are intent-only (no payment provider).

If staging is missing earlier A1 files, stop and finish A1 first — do not jump to A2–A5.

---

## 2. Deploy sequence (staging)

### Step A — Migrations

```powershell
cd C:\NahuAI\nahu-platform
$env:DATABASE_URL = "<DATABASE_PUBLIC_URL>"
$env:APPLIED_BY = "staging-a2-a5-laptop"
node scripts/apply-migrations.mjs
Remove-Item Env:DATABASE_URL
Remove-Item Env:APPLIED_BY
```

Confirm these seven files are applied (or reported already applied).

### Step B — API

```powershell
railway up --service nahu-api
curl https://nahu-api-staging.up.railway.app/health
```

Smoke: authenticated admin routes under `/api/v1/admin/...` (users, verification, listings, disputes, dashboard summary).

### Step C — Admin Web

```powershell
railway up --service nahu-admin-web
```

Open Admin Web → login → confirm nav: Users, Verification, Listings, Disputes, Audit, System.

### Step D — Validate

Execute [`a3-a5-staging-validation-plan.md`](./a3-a5-staging-validation-plan.md) (plus A2 smoke from the A1 handoff A2 section if not already accepted).

---

## 3. Rollback / stop conditions

| Situation | Action |
|---|---|
| Migration fails mid-batch | Fix SQL / data; re-run apply script (idempotent). Do not deploy API until all seven succeed. |
| API deploy fails after migrate | Keep DB; fix and redeploy API. Schema is forward-compatible with older admin UI until web is updated. |
| Critical bug in A3/A4/A5 | Prefer feature disable via role grants / stop using nav; do not reverse migrations on staging without a written plan. |
| Any production attempt | **Abort** — production remains frozen. |

---

## 4. Sign-off

| Item | Owner | Done |
|---|---|---|
| Migrations 1–7 applied | | [ ] |
| `nahu-api` staging redeployed | | [ ] |
| `nahu-admin-web` staging redeployed | | [ ] |
| A3 validation plan passed | | [ ] |
| A4 validation plan passed | | [ ] |
| A5 validation plan passed | | [ ] |
| A2 user-mgmt smoke still OK | | [ ] |
| Production untouched | | [ ] |
