# Staging Deployment — Nahu Platform API

Deploy the NestJS API (`nahu-platform`) to Railway **staging** before pointing mobile apps at it.

---

## Architecture

```
Railway project: nahu-platform-api
└── environment: staging
    ├── Postgres          # dedicated staging database
    └── nahu-api          # NestJS container (this repo, Dockerfile)
```

**Staging API URL:** `https://nahu-api-staging.up.railway.app`  
Mobile apps use: `https://nahu-api-staging.up.railway.app/api/v1`

---

## One-time setup

### 1. Prerequisites

- [Railway CLI](https://docs.railway.app/develop/cli) logged in (`railway whoami`)
- Repo linked: `railway link --project nahu-platform-api`
- `psql` locally (for migrations)

### 2. Create staging environment

```bash
railway environment new staging
railway environment link staging
```

### 3. Add Postgres (staging)

```bash
railway add --database postgres
```

Note the service name (usually `Postgres`).

### 4. Add API service

```bash
railway add --service nahu-api
railway service link nahu-api
```

Connect GitHub (recommended) or deploy from CLI:

```bash
# From repo root — deploy current branch
railway up
```

### 5. Configure environment variables

In Railway dashboard → **staging** → **nahu-api** → Variables, set:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Reference → `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | Strong random string (see below) |
| `JWT_EXPIRES_IN` | `7d` |
| `OTP_EXPIRES_MINUTES` | `10` |
| `OTP_DEV_BYPASS` | `true` (staging only — enables test code `123456` when SMS is not configured) |
| `PUBLIC_API_URL` | `https://nahu-api-staging.up.railway.app` (no trailing slash; required for listing photo URLs) |

Generate JWT secret:

```bash
openssl rand -base64 48
```

See `apps/api/.env.staging.example` for optional SMS and Anthropic keys.

### 6. Apply database migrations

Migrations are applied from a **manifest** with a checksum ledger. See
`docs/08-guides/migration-manifest.md`.

**Fresh or existing staging database:**

```bash
export DATABASE_URL="postgresql://..."
# If the DB already has pre-A1 schema applied outside the ledger:
# export MARK_EXISTING=1
node scripts/apply-migrations.mjs
# or: ./scripts/apply-migrations.sh
```

Do **not** rely on recursive filename sort. Prefer the manifest runners above
over legacy `apply-pending-migrations.sh`.

### 6b. Admin Portal staging service (A1)

Add a separate Railway service for Admin Web (do **not** create a production
Admin service in A1):

1. Service name suggestion: `nahu-admin-web`
2. **Config-as-code path:** `/apps/admin-web/railway.toml`  
   (Do **not** use the repo-root `railway.toml` — that builds the Nest API.)
3. Root directory / build context: monorepo root (`/`)
4. Variables:
   - `API_BASE_URL=https://nahu-api-staging.up.railway.app/api/v1`
   - `ADMIN_WEB_ORIGIN=https://<admin-staging-host>`
   - `NODE_ENV=production`
   - `PORT=3001` (Railway may also inject `PORT`)
5. On `nahu-api`, set:
   - `ADMIN_MFA_ENCRYPTION_KEY` (`openssl rand -hex 32`)
   - `CORS_ORIGINS` to include the Admin Web origin
6. Bootstrap the first admins using `docs/08-guides/a1-admin-bootstrap.md`
7. Hand the staging URL and acceptance checklist to the user:
   `docs/08-guides/a1-staging-validation-handoff.md`

Stop for **user validation** before Commit → PR → Merge → Tag.
Production remains frozen.
### 7. Verify

```bash
curl https://<your-staging-host>/health
curl -X POST https://<your-staging-host>/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251911223344","role":"FARMER"}'
```

On staging, `OTP_DEV_BYPASS=true` enables test code `123456` even when `NODE_ENV=production`. Without that flag (or without Africa's Talking configured), OTP verification requires a real SMS code.

---

## Point mobile apps at staging

In `nahu-buna-gebaya` each app, set `.env`:

```
EXPO_PUBLIC_API_URL=https://<your-staging-host>/api/v1
```

Or update `eas.json` **preview** profile `EXPO_PUBLIC_API_URL`.

Restart Expo: `npx expo start --clear`

---

## Redeploy

After pushing to `main`:

- GitHub-connected service redeploys automatically, or
- `railway up` from repo root (linked to `nahu-api` + `staging`)

---

## Production cutover (later)

1. Regression-test both apps on staging
2. Create `production` environment service for `nahu-api` (separate from legacy `thorough-heart` Express)
3. Migrate data from gebaya → platform Postgres
4. Switch mobile `EXPO_PUBLIC_API_URL` to production platform URL
5. Decommission legacy Express service

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on Prisma | Ensure `pnpm-lock.yaml` is committed; Dockerfile runs `prisma generate` |
| `/health` 502 | Check logs: `railway logs --service nahu-api` |
| OTP always fails | Staging: set `OTP_DEV_BYPASS=true` or configure `AT_API_KEY` / `AT_USERNAME`. Local dev: leave SMS unset and use OTP `123456` (`NODE_ENV` not `production`) |
| Migrations error | Run `./scripts/apply-migrations.sh` against empty DB; use `docker compose down -v` locally to reset |
