# Platform RC2 — Integration Validation Report

**Status:** Complete (validation + integration defect fixes; no new business features)  
**Date:** 2026-07-23  
**Environment:** Railway staging (`nahu-api`, `nahu-admin-web`)  
**API:** `https://nahu-api-staging.up.railway.app`  
**Admin Web:** `https://nahu-admin-web-staging.up.railway.app`  
**Platform fix commit:** `1fd01be` (deployed via `railway up` upload — see deploy note)

---

## 1. Executive verdict

RC2 exercised cross-app workflows against staging and found **real marketplace integration defects** between listing moderation and ordering. Those defects are **fixed and re-validated on staging**.

| Area | Result |
|------|--------|
| Mobile auth (Farmer / Buyer OTP) | **PASS** |
| Catalog / public browse (APPROVED only) | **PASS** |
| Listing create → pending moderation | **PASS** (after deploy) |
| Owner listing detail for PENDING | **PASS** (after fix) |
| Buyer cannot order PENDING listing | **PASS** (after fix; was **FAIL**) |
| Buyer order → escrow → dispute | **PASS** |
| Farmer dashboard / profile | **PASS** |
| Admin unauthenticated RBAC (401) | **PASS** |
| Admin authenticated A6–A14 workflows | **PASS** (MFA smoke 2026-07-23; see §6) |
| Farmer / Buyer mobile RC1 app builds | **PARTIAL** (code ready locally / PRs; not fully merged as store builds) |

**Production readiness:** Staging marketplace integrity is restored for moderation ↔ commerce, and Admin MFA API smoke is green. **Do not promote production** until mobile RC1 branches are merged + validated on device and staging deploy pipeline is reliable (`railway up` or GitHub auto-deploy).

---

## 2. Scope and method

### In scope
- Nest buyer/farmer APIs + admin route RBAC probes
- Listing lifecycle + moderation visibility vs `POST /orders`
- Order payment (simulated), dispute raise
- Auth role separation (`FARMER` / `BUYER`)
- Contract consistency (moderation fields, owner detail)

### Out of scope (by design)
- New business features (promotions at checkout, live pay, notifications inbox, delivery tracking)
- Production cutover
- Admin UI click-through without MFA session

### Method
1. OTP login as Farmer (`+251911000101`) and Buyer (`+251911000201`) with staging `dev_otp`
2. Create farmer profile if missing; create listing; inspect `/listings/mine` and public `/listings`
3. Attempt order against PENDING listing (defect reproduction)
4. Happy-path order on APPROVED listing → confirm-payment → dispute
5. Unauthenticated probes of `/admin/*`
6. Fix defects → `railway up` deploy → retest

---

## 3. Pass / fail matrix

| ID | Workflow | Before fix | After fix / notes |
|----|----------|------------|-------------------|
| A1 | Farmer OTP + `/auth/me` roles=FARMER | PASS | PASS |
| A2 | Buyer OTP + `/auth/me` roles=BUYER | PASS | PASS |
| A3 | Buyer cannot `GET /listings/mine` | PASS (403) | PASS |
| C1 | Categories + COFFEE products | PASS | PASS |
| L1 | `POST /listings` creates ACTIVE + PENDING moderation | PASS* | PASS (`moderationStatus` returned) |
| L2 | `/listings/mine` includes `moderationStatus` | **FAIL** (field missing on live) | **PASS** |
| L3 | Public listings exclude non-APPROVED | PASS | PASS |
| L4 | Anonymous/buyer `GET /listings/:pendingId` → 404 | PASS | PASS |
| L5 | Owner farmer `GET /listings/:pendingId` | **FAIL** (404) | **PASS** |
| O1 | `POST /orders` on PENDING listing | **FAIL** (201 created!) | **PASS** (400) |
| O2 | `POST /orders` on APPROVED + confirm-payment | PASS | PASS |
| O3 | `PATCH .../dispute` → DISPUTED | PASS | PASS |
| O4 | `GET /orders/my` role-scoped | PASS | PASS |
| F1 | Farmer profile + `/farms/dashboard` | PASS | PASS |
| P1 | `GET /payments/methods` | PASS | PASS |
| AD1 | `POST /admin/auth/login` exists (400 empty body) | PASS | PASS |
| AD2 | Unauth `GET /admin/{dashboard,users,listings/moderation,disputes,reports/catalog,notifications,audit/events,monitoring}` → 401 | PASS** | PASS |
| AD3 | Authenticated admin reporting / notifications / monitoring / audit UI | **BLOCKED** | Needs bootstrap MFA |
| M1 | Farmer/Buyer RC1 apps pointed at Nest staging | PARTIAL | See apps section |

\*Create succeeded earlier; response omitted moderation fields until correct image deployed.  
\*\*Initial probe used wrong path `/admin/monitoring/metrics` (404); correct path is `GET /admin/monitoring`.

---

## 4. Integration defects found and fixed

### DEF-1 — Buyers could purchase PENDING listings (Critical)
- **Evidence:** `POST /orders` with PENDING listing id returned **201** while public GET returned 404.
- **Cause:** `createOrder` checked `status === 'ACTIVE'` only, not `moderationStatus === 'APPROVED'`.
- **Fix:** `orders.service.ts` uses `isPubliclyVisibleModeration(...)`.
- **Retest:** 400 on PENDING; 201 on APPROVED.

### DEF-2 — Farmer clients missing moderation fields on staging (High)
- **Evidence:** `/listings/mine` JSON lacked `moderationStatus` despite commit `bfb3ed1` on `main`.
- **Cause:** `railway redeploy --from-source` reused prior image; did not upload new build context.
- **Fix:** Deploy with `railway up -s nahu-api` from repo root; confirmed fields present (`PENDING`).

### DEF-3 — Owners could not open their own PENDING listing by id (Medium)
- **Evidence:** Farmer `GET /listings/:id` → 404 for own PENDING row.
- **Cause:** Public detail required APPROVED for all callers.
- **Fix:** `OptionalJwtAuthGuard` + owner bypass in `getListingById`.
- **Retest:** Owner 200 with `moderationStatus=PENDING`; buyer still 404.

### Tests added
- `listing-moderation.rules.test.mjs` — createOrder gate mirror
- `listing-visibility.rules.test.mjs` — owner vs public visibility

---

## 5. Cross-app consistency notes

| Contract | Admin | Farmer app | Buyer app | Nest |
|----------|-------|------------|-----------|------|
| Listing moderation | Queue APPROVE/REJECT | Must show pending review (RC1) | Cannot purchase non-APPROVED | Enforced after DEF-1/2 |
| Escrow copy | Disputes admin | No fake “ship” (RC1) | Honest escrow copy (RC1) | Status `PAID_ESCROW` |
| Dispute | Admin A5 | `PATCH /orders/:id/dispute` | Same | Shared |
| OTP | N/A (password+MFA) | Fail-closed + `__DEV__` hint | Same pattern in RC1 work | `dev_otp` on staging |
| EAS production URL | N/A | Nest staging (RC1) | Nest staging (RC1 local) | — |

**Inconsistency remaining (process):** Farmer RC1 is on PR branch; Buyer RC1 changes are still local on `chore/farmer-rc1` working tree — not a Nest defect, but app/store readiness is incomplete until merged.

---

## 6. Admin Portal A6–A14 (MFA smoke — completed)

**Date:** 2026-07-23  
**Method:** Bootstrap staging `SUPER_ADMIN` via `bootstrap-admin.cjs` + TOTP enroll/login against Nest (not Admin Web UI click-through). List endpoints use `{ items, page, total }` (not `data`).

| Step | Result |
|------|--------|
| `GET /admin/auth/me` (SUPER_ADMIN) | PASS |
| `GET /admin/dashboard/summary` | PASS |
| `GET /admin/users?status=ACTIVE` | PASS |
| Approve PENDING listing → buyer `GET /listings/:id` APPROVED | PASS |
| Dispute note + `START_REVIEW` → UNDER_REVIEW | PASS |
| Reports catalog + export `listings.moderation` + download | PASS |
| Notifications publish (BROADCAST) + mark read | PASS |
| `GET /admin/monitoring` + `POST emit-notices` | PASS |
| `GET /admin/audit/events` + `GET /admin/system/health` | PASS |

**Note:** Staging bootstrap account `rc2.validation.admin@nahu.local` was created for this smoke. Rotate or disable after use; do not reuse the temp password outside staging.

---

## 7. Deploy note (important)

`railway redeploy --from-source` on this project **did not** ship `main` commit contents (moderation fields remained absent).  

**Working deploy path for RC2 fixes:**

```powershell
cd C:\NahuAI\nahu-platform
railway up -s nahu-api -d -y
```

Recommend wiring GitHub auto-deploy from `main` or documenting `railway up` as the staging deploy command to avoid silent stale images.

---

## 8. Remaining issues

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| P0 | Confirm GitHub→Railway auto-deploy or always `railway up` | Prevent stale staging |
| P1 | Merge Farmer RC1 PR + Buyer RC1 branch; staging APK smoke | Device checklist in app RC1 docs |
| P1 | Staging leftover orders from defect repro (PENDING ordered before fix) | Cancel unpaid / resolve remaining disputes in admin |
| P1 | Disable/rotate `rc2.validation.admin@nahu.local` after smoke | Staging hygiene |
| P2 | Invite-create UI, export reauth (RC1 debt) | Track from RC1 report |
| P2 | Live payments / notifications inbox / delivery tracking | Deferred product work |
| P3 | Brand string inconsistencies across Buyer screens | Non-blocking polish |
| P3 | Admin Web UI click-through (browser) not run | API MFA smoke passed; optional UI pass |

---

## 9. Production readiness recommendation

**Not ready for production promotion.**

**Ready for continued staging RC:** marketplace moderation/order integrity is validated after `1fd01be` + `railway up`.

**Go-live gate:**
1. Admin §6 MFA smoke green  
2. Farmer + Buyer RC1 merged and APK smoke green  
3. Staging deploy pipeline verified (no stale images)  
4. Explicit production promote decision (migrations + CORS + Nest prod URL)

---

## 10. What RC2 intentionally did not do

- No new A15+ modules or speculative mobile features  
- No production deployment  
- No Admin MFA bootstrap with new credentials in CI  
- No full UI redesign  
