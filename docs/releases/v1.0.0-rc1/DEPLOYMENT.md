# Deployment notes — v1.0.0-rc1

**Canonical ops:** [staging-deploy.md](../../08-guides/staging-deploy.md) · [nest-only-ops.md](../../08-guides/nest-only-ops.md) · [migration-manifest.md](../../08-guides/migration-manifest.md)

## 1. Database

Apply migrations from the **manifest** (not ad-hoc filename sort):

```bash
export DATABASE_URL="postgresql://..."
# MARK_EXISTING=1 if DB was seeded outside the ledger
node scripts/apply-migrations.mjs
```

**RC1 must include through:**

| Gate | File |
|------|------|
| G8 | `delivery/009_delivery_fulfillment_orchestration.sql` |
| G9 | `payments/001_payment_orchestration.sql` |
| G9 perms | `identity/029_identity_payment_orchestration_permissions.sql` |
| Ops indexes | `ops/013_ops_query_indexes.sql` |

Pinned list: [migration-manifest.frozen.json](./migration-manifest.frozen.json).

**Flags:** keep `delivery.dynamic_fee.enabled` **OFF** unless explicitly approved.

## 2. Docker / API image

- Build context: `nahu-platform` root (`Dockerfile`)
- Expose `3000`
- **HEALTHCHECK:** `GET /health/ready` (fails if DB down)
- Liveness (optional orchestrator): `GET /health/live`
- Legacy `GET /health` returns 503 when DB down (same readiness semantics)

## 3. Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Staging/prod Postgres |
| `JWT_SECRET` | Yes | Strong; reject weak defaults in prod |
| `ADMIN_MFA_ENCRYPTION_KEY` | Yes if `NODE_ENV=production` | `openssl rand -hex 32` |
| `CORS_ORIGINS` | Yes (prod) | Admin Web origin(s) |
| `PUBLIC_API_URL` | Yes | No trailing slash; photo URLs |
| `OTP_DEV_BYPASS` | Staging only | Enables OTP `123456` when SMS unset |
| `AT_API_KEY` / `AT_USERNAME` | Prod SMS | Or rely on bypass on staging only |

See `apps/api/.env.example`.

## 4. Admin Web

- Build: `pnpm --filter @nahu-platform/admin-web build`
- BFF must proxy to Nest `/api/v1` (same staging host)
- Pricing mutations require reauth password

## 5. Mobile (Buyer / Farmer / Courier)

- Expo ~54; EAS `preview` / `apk` → Nest staging URL
- `EXPO_PUBLIC_API_URL=https://<host>/api/v1`
- Do **not** point at gebaya Express

## 6. CI

**nahu-platform** (`.github/workflows/ci.yml`):

- Lint API · `test:rules` · build API + Admin Web  
- Optional `workflow_dispatch` staging smoke job  

**nahu-buna-gebaya:**

- `npm test` (shared package tests)

## 7. Staging smoke

```bash
PILOT_SMOKE=1 \
API_BASE_URL=https://nahu-api-staging.up.railway.app \
BUYER_TOKEN=... FARMER_TOKEN=... COURIER_TOKEN=... ADMIN_TOKEN=... \
SMOKE_LISTING_ID=... \
node apps/api/scripts/pilot-e2e-smoke.cjs
```

Exits 0 (skip) if secrets unset — does not fail every PR.

## 8. Rollback procedure

1. **App / image:** Redeploy previous known-good Railway deployment / Docker image tag. Do not leave a half-migrated DB paired with a new binary.
2. **Migrations:** Manifest migrations are **additive forward**. Do not reverse G8/G9/G10 SQL in pilot without an explicit DBA plan. Prefer feature flags / disabling traffic.
3. **Mobile:** Ship previous EAS build; keep API on compatible Nest image.
4. **Fees / flags:** Revert Admin Pricing only with reauth; keep dynamic delivery OFF.
5. **Confirm:** `GET /health/ready` + smoke create→confirm-payment on staging.

## 9. Courier earnings (ops)

Set `delivery.earning.flat_etb` to a non-zero ETB value for paid courier pilot, **or** document acceptance of zero payouts for unpaid internal pilot.
