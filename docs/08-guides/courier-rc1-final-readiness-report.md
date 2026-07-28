# Courier App RC1 — Final Production Readiness Report

**Date:** 2026-07-27  
**Verdict:** **NOT declared Production Ready** — staging deploy + API/DB/build/APK artifacts are green; full device UAT and end-to-end delivery workflow remain incomplete.

---

## Phase 1 — Deployment

| Service | Status | URL | Deployment ID | Time (EAT) |
|---------|--------|-----|---------------|------------|
| `nahu-api` | SUCCESS / Online | https://nahu-api-staging.up.railway.app | `85ce500b-a9c7-4b6a-aa87-effe4ecd05a8` | 2026-07-27 03:40 |
| `nahu-admin-web` | SUCCESS / Online | https://nahu-admin-web-staging.up.railway.app | `dfea0f87-d957-4a1d-a378-1f9b8043779e` | 2026-07-27 03:40 |

**Source commit (local `main` pushed before deploy):** `c26a38f` — `feat(delivery): ship courier CRM for RC1 UAT`

Railway deployment metadata for these CLI deploys does not expose a git SHA field (Docker image digest only: `sha256:a9995800…`). Version match is confirmed by **post-deploy route behavior**: all new CRM routes return **401** (not 404), and authenticated smoke against staging succeeds for CRM CRUD.

Admin KYC page `/delivery/verifications` is reachable (redirects to `/login` when unauthenticated — expected).

---

## Phase 2 — API Verification (staging)

### Unauthenticated reachability

| Method | Endpoint | HTTP | Notes |
|--------|----------|------|-------|
| GET | `/api/v1/delivery/courier/me` | **401** | Profile lives here |
| GET | `/api/v1/delivery/courier/profile` | **404** | **Not implemented** — use `/me` |
| GET | `/api/v1/delivery/courier/vehicles` | **401** | OK |
| GET | `/api/v1/delivery/courier/notifications` | **401** | OK |
| GET | `/api/v1/delivery/courier/verification` | **401** | OK |
| GET | `/api/v1/delivery/courier/payout-accounts` | **401** | OK |
| POST | `/api/v1/uploads/courier-media` | **401** | OK |
| GET | `/api/v1/admin/delivery/courier-verifications` | **401** | OK |
| POST | `/api/v1/admin/delivery/courier-verifications/:id/approve` | **401** | OK |
| POST | `/api/v1/admin/delivery/courier-verifications/:id/reject` | **401** | OK |
| GET | Admin `/login` | **200** | OK |
| GET | Admin `/delivery/verifications` | **200** / redirect `/login` | Auth-gated |

**Required-API 404 rule:** all implemented CRM endpoints pass (no 404). `/profile` 404 is expected and documented.

### Authenticated courier smoke (OTP courier `+251911000301`)

**13/13 PASS** against staging:

- GET/PATCH `/me` → 200  
- GET vehicles / payouts / notifications / verification → 200  
- Invalid plate → 400  
- POST/activate/DELETE vehicle → 201/201/200  
- POST/DELETE payout → 201/200  
- POST notifications/read-all → 201  

Script: `apps/api/scripts/rc1-courier-auth-smoke.cjs`

---

## Phase 3 — Build Verification

| Check | Result |
|-------|--------|
| Nest `nest build` | PASS (exit 0) |
| API `tsc -p tsconfig.build.json --noEmit` | PASS |
| Admin Web `tsc --noEmit` | PASS |
| Admin ESLint | PASS with **1 warning** (`@next/next/no-img-element` on enroll-mfa; allowed with `--max-warnings 1`) |
| Courier Metro Android export | PASS (1111 modules) |

No TypeScript errors. No lint **errors**. One pre-existing admin warning (Low).

---

## Phase 4 — Courier APK

| Item | Result |
|------|--------|
| EAS build | **FINISHED** |
| Build ID | `328a153f-0253-4611-8454-b70afac950fc` |
| versionCode | **7** |
| APK | https://expo.dev/artifacts/eas/UqbR_nBOf8FXcsEq8vjtwBApZ21AZain3udcF4ZC0eo.apk |
| Page | https://expo.dev/accounts/tesfayesus/projects/nahu-buna-courier/builds/328a153f-0253-4611-8454-b70afac950fc |

### Device verification (this session)

| Check | Status |
|-------|--------|
| Installation succeeds | **Not run here** (needs physical device) |
| Login | **Not run on APK** (API OTP smoke only) |
| Camera / gallery permissions | **Not run** |
| Image upload | **Not run on device** |
| Navigation / no crashes | **Not run** |

---

## Database verification (staging)

From `rc1-acceptance-probe.cjs` against Railway Postgres:

| Check | Result |
|-------|--------|
| Migration `delivery/008_delivery_courier_crm.sql` | Recorded |
| `delivery.courier_profiles` (+ CRM columns) | Present |
| `delivery.courier_vehicles` | Present |
| `delivery.courier_payout_accounts` | Present |
| `delivery.courier_verification_cases` + documents | Present |
| `delivery.courier_notifications` | Present |
| Plate unique index `courier_vehicles_plate_active_uq` | Present |
| PKs / FKs / CRM indexes | Present |

Note: checklist name `courier_identity_verifications` is **not** used; real table is `courier_verification_cases`.

---

## Phase 5 — Full RC1 UAT

| Area | Status |
|------|--------|
| Courier CRM API smoke (profile/vehicles/payouts/notifications/verification) | **PASS** (API) |
| Courier UI: login, edit profile, photo, KYC submit, vehicles, payouts, settings, POD camera | **PENDING** device + Admin Portal |
| Admin: review / approve / reject KYC, assign courier, notifications | **PENDING** manual (page live, auth-gated) |
| E2E: buyer order → payment → farmer → shipment → assign → accept → pickup → transit → delivered → POD → buyer confirm → review → admin reports | **NOT EXECUTED** this session |

Automated API coverage proves CRM persistence on staging. It does **not** replace the full multi-app delivery workflow UAT.

---

## Phase 6 — Remaining issues

| ID | Severity | Issue |
|----|----------|-------|
| R1 | **High** | Full device UAT on APK v7 not completed (install, camera, gallery, upload, navigation, crash check). |
| R2 | **High** | Full end-to-end delivery workflow UAT not executed on staging. |
| R3 | **Medium** | Admin KYC approve/reject verified only as auth-gated (401); not exercised with admin session end-to-end. |
| R4 | **Low** | Checklist path `/delivery/courier/profile` does not exist — clients must use `/me`. |
| R5 | **Low** | Admin ESLint `@next/next/no-img-element` warning on enroll-mfa (pre-existing). |
| R6 | **Low** | Railway CLI deploy metadata lacks git SHA; rely on behavioral probes + local `c26a38f`. |

**Critical defects found in deployed CRM surface:** none.

---

## Production-ready gate (user criteria)

| Criterion | Met? |
|-----------|------|
| All deployments live | **Yes** (staging) |
| No required API returns 404 | **Yes** (except intentional `/profile`) |
| Core delivery workflow passes | **No** — not fully UAT’d |
| No critical defects remain | **Yes** (known gaps are High/Medium process gaps, not Critical bugs) |
| All implemented features fully functional in deployed environment | **Partial** — API/DB yes; device + Admin + E2E pending |

### Final declaration

**Courier App RC1 is NOT Production Ready** until High items R1–R2 (and preferably R3) are completed on the deployed staging stack with APK v7.

**What is ready now:** CRM code is live on Railway staging; migration 008 is applied; required endpoints respond correctly; builds/tsc pass; fresh APK is available for human UAT.

---

## Next actions (ordered)

1. Install APK v7 on Android device; run Phase 4 + courier checklist in completion report.  
2. Admin Portal: submit KYC from app → approve/reject with reason.  
3. Run full buyer→admin→farmer→courier→POD→review E2E once.  
4. Re-issue this report; declare Production Ready only when R1–R3 are closed.
