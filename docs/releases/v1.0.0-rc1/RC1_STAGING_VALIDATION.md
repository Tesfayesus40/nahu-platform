# RC1 Staging Validation Report

**Date:** 2026-07-29  
**Release:** `v1.0.0-rc1`  
**Stage:** Stage 2 – Staging Deployment & Pilot Smoke  
**Status:** **PASS with warnings** — recommend proceed to broader UAT; do not start Telebirr / Honey / notifications / AI.

---

## 1. Deployment status

| Component | URL | Result |
|-----------|-----|--------|
| Nest API | https://nahu-api-staging.up.railway.app | **PASS** — deployed & healthy |
| Admin Web | https://nahu-admin-web-staging.up.railway.app | **PASS** — redeployed after Next.js slug fix |
| Postgres | Railway `Postgres-9wYI` (staging) | **PASS** — reachable |

### Deployed revisions

| Repo | Tag / tip used | Notes |
|------|----------------|-------|
| `nahu-platform` | Tag `v1.0.0-rc1` → `65f5583` | Product freeze |
| `nahu-platform` staging tip | `0881017` (+ hotfixes `744c510`, `a133a3e`) | CI recovery + staging unblockers (lint/types, migration SQL, admin route slug, smoke harness) |
| `nahu-buna-gebaya` | Tag `v1.0.0-rc1` → `bd69f15` on `chore/farmer-rc1` | Mobile APK source |

### Health / readiness

| Probe | Result |
|-------|--------|
| `GET /health/live` | **200** `{ status: ok, probe: liveness }` |
| `GET /health/ready` | **200** `{ status: ok, probe: readiness, database: up }` |
| `GET /health` | **200** `{ status: ok, database: up }` |
| Admin `/login` | **200** |

### Environment variables (API staging)

| Variable | Status |
|----------|--------|
| `NODE_ENV` | SET |
| `DATABASE_URL` | SET |
| `JWT_SECRET` | SET |
| `ADMIN_MFA_ENCRYPTION_KEY` | SET |
| `CORS_ORIGINS` | SET |
| `PUBLIC_API_URL` | SET |
| `JWT_EXPIRES_IN` | SET |
| `OTP_DEV_BYPASS` | SET (enabled for staging OTP `123456`) |

---

## 2. Migrations applied

Manifest runner: `node scripts/apply-migrations.mjs` against staging **public** Postgres URL.

| Gate | File | Applied |
|------|------|---------|
| Catalog G4 unblocker | `catalog/021_catalog_attribute_presentation_g4.sql` | **Yes** (2026-07-29) |
| G8 | `delivery/009_delivery_fulfillment_orchestration.sql` | **Yes** |
| G9 | `payments/001_payment_orchestration.sql` | **Yes** |
| G9 perms | `identity/029_identity_payment_orchestration_permissions.sql` | **Yes** |
| Ops | `ops/013_ops_query_indexes.sql` | **Yes** |

Ledger: **132** rows in `public.schema_migrations`. Manifest reports **All manifest migrations are current.**

**Defect fixed during apply:** `catalog/021` used an illegal `UPDATE … FROM … JOIN … ON` reference to the target alias (`ad`) under Postgres. Fixed to filter in `WHERE` (`744c510`). Without this fix, staging could not advance to G8/G9/`ops/013`.

---

## 3. Mobile RC1 builds (EAS APK)

Source: gebaya tag `v1.0.0-rc1` (`bd69f15`). Profile: `apk` → `EXPO_PUBLIC_API_URL=https://nahu-api-staging.up.railway.app/api/v1`.

| App | Version | Build # | Status | APK |
|-----|---------|---------|--------|-----|
| Buyer | `1.0.0-rc1` | **8** | FINISHED | https://expo.dev/artifacts/eas/7swdFb_VoWLSYW0HFvAMxlEzPioC7lz5YOaRJdAwU4I.apk |
| Farmer | `1.0.0-rc1` | **8** | FINISHED | https://expo.dev/artifacts/eas/lV49Vj4bRwdV0FyNkmWlKNkoKyXLdSDPTvnFW5-1A9Y.apk |
| Courier | `1.0.0-rc1` | **11** | FINISHED | https://expo.dev/artifacts/eas/m0O-RyKRKIM7AJ0kATmjpORPkU34110nJTTucQ9bWlw.apk |

Build pages:

- Buyer: https://expo.dev/accounts/tesfayesus/projects/nahu-buna-buyer/builds/5b8cc5ec-ee2c-4002-af45-9e82df25913b  
- Farmer: https://expo.dev/accounts/tesfayesus/projects/nahu-buna-farmer/builds/bc8b41b3-e963-439f-a907-cda9c98904d6  
- Courier: https://expo.dev/accounts/tesfayesus/projects/nahu-buna-courier/builds/754eae6b-d189-47ec-ad14-e943c0ce64e4  

---

## 4. Pilot smoke results

Workflow exercised on staging Nest API (OTP `123456` / listing owner farmer `+251911200005`, buyer `+251911000201`, courier `+251911000301`).

Canonical settled order: **`5d10dd81-b75c-467d-bace-dbf1015fde87`**  
Listing: `83272020-d690-4f68-aac7-a358f04a28f3` (APPROVED / ACTIVE).

| Stage | Result | Evidence |
|-------|--------|----------|
| Buyer browse | **PASS** | `GET /listings` returned approved coffee listing |
| Checkout | **PASS** | `POST /orders` 201 with fee snapshot (`buyerChargeEtb` 285.6) |
| Payment (stub Telebirr) | **PASS** | `confirm-payment` → `PAID_ESCROW` |
| Seller accept | **PASS** | `seller-accept` 201 |
| Prepare | **PASS** | `preparing` → `ready-for-pickup` |
| Courier ONLINE | **PASS** | `PATCH /delivery/courier/me/availability` → ONLINE/AVAILABLE |
| Courier assignment | **PASS** | `POST /admin/fulfillment/orders/:id/assign` → `COURIER_ASSIGNED` |
| Pickup (dual confirm) | **PASS** | seller + courier confirm-pickup |
| In transit | **PASS** | `in-transit` |
| Delivery (dual confirm) | **PASS** | courier + buyer confirm-delivery |
| Settlement | **PASS** | Auto-settled to `orchestrationStatus=SETTLED` / order `COMPLETED` on dual delivery confirm |
| Admin inspection | **PASS** | ops dashboard + health + order detail |
| Refund | **PASS** | `POST /admin/payments/orders/:id/refund` reason `ADMIN_CANCELLATION` → `paymentStatus=REFUNDED`, escrow refunded 10 ETB |

Harness note: `apps/api/scripts/pilot-e2e-smoke.cjs` was aligned to RC1 contracts (`TELEBIRR`, nested `order.id`, `NAHU_COURIER`) in commit `a133a3e`.

---

## 5. Operations validation

| Check | Result | Notes |
|-------|--------|-------|
| Dashboard metrics | **PASS** | `GET /admin/ops/dashboard` 200 (`asOf`, `summaries`) |
| Ops health | **PASS** | `GET /admin/ops/health` 200 |
| Order inspection | **PASS** | Admin order detail includes fees, payment, intents, fulfillmentCase |
| Payment timeline | **PASS** | Order embeds `payment` + `paymentIntents`; refund events on payment case |
| Audit search | **PASS (list)** | `GET /admin/audit/events` returns events; free-text `q` filter not supported |
| Seller administration | **PASS** | `GET /admin/sellers` 200 |
| Courier reassignment | **PASS** | `POST /admin/delivery/shipments/:id/reassign` with `reauthPassword` — prior assignment cancelled, new active assignment created |

---

## 6. Defects

| ID | Severity | Summary | Disposition |
|----|----------|---------|-------------|
| STG-01 | **High** (blocking migrate) | `catalog/021` Postgres UPDATE/JOIN bug blocked migration apply | **Fixed** in `744c510`; applied on staging |
| STG-02 | **High** (blocking Admin deploy) | Admin Web Next.js conflict `[code]` vs `[productCode]` under `/api/catalog/products` | **Fixed** in `744c510`; Admin redeploy **SUCCESS** |
| STG-03 | Medium | Pilot smoke harness used lowercase `telebirr` and top-level `id` | **Fixed** in `a133a3e` |
| STG-04 | Low | Explicit `POST …/settle` can 400 when dual-confirm already auto-settled | Document as expected; treat SETTLED as success |
| STG-05 | Low | Fulfillment assign response `id` is fulfillment case id, not shipment id — courier `/shipments/:id/accept` 404 if misused | Ops should use shipment list/dispatch ids |
| STG-06 | Low | Demo farmer `+251911000101` has no farmer profile; listing owner is `+251911200005` | Use listing-owner tokens for seller steps |
| STG-07 | Info | Staging was behind RC1 migrations until this run (many APPLY after SKIP) | Now current through `ops/013` |

---

## 7. Warnings

1. Staging tip is **RC1 tag + CI/staging hotfixes** — not byte-identical to annotated tag alone. Hotfixes are lint/types/SQL/route/smoke-only.
2. Admin Web first RC1 redeploy **failed**; second deploy after slug fix succeeded.
3. EAS billing already in overage for this account (builds still completed).
4. Live Telebirr / SMS are **not** in scope; payment remains stub / ledger.
5. Temporary staging admin password was set for `rc2.validation.admin@nahu.local` to complete MFA-backed ops checks — **rotate / restore MFA policy** before broader UAT handoff.
6. Dynamic delivery fee flag must remain **OFF** for RC1 (not changed in this run).

---

## 8. Release recommendation

**Recommendation: CONDITIONAL GO for broader staging UAT / pilot users.**

- API + Admin deployed and healthy  
- Migrations through **`ops/013`** applied  
- Full buyer→settlement→refund money path verified on Nest staging  
- Ops surfaces (dashboard, order, payment timeline, audit list, sellers, reassignment) verified  
- Buyer / Farmer / Courier **`1.0.0-rc1` APKs** built and downloadable  

**Do not** begin Telebirr live rails, Honey Marketplace, notifications, or AI features until pilot UAT sign-off.

**Next (when instructed):** rotate temporary admin smoke credentials, optional retag or release notes noting hotfix commits, then pilot-user APK distribution.

---

## 9. Stop

Staging validation complete. No Telebirr / Honey / notifications / AI work started.
