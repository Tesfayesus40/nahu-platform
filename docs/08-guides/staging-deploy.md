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

**Fresh database** — run all migrations:

```bash
export DATABASE_URL="postgresql://..."
./scripts/apply-migrations.sh
```

**Existing staging/production DB** (already on migrations 001–005) — run only Pack 2–4 pending files:

```bash
export DATABASE_URL="postgresql://..."
./scripts/apply-pending-migrations.sh
```

On Windows (Git Bash):

```bash
DATABASE_URL="postgresql://..." bash scripts/apply-pending-migrations.sh
```

### 7. Verify

```bash
curl https://<your-staging-host>/health
curl -X POST https://<your-staging-host>/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251911223344","role":"FARMER"}'
```

In staging/production, real SMS is required unless you configure Africa's Talking — OTP `123456` dev bypass is **disabled** when `NODE_ENV=production`.

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
| OTP always fails | Set `AT_API_KEY` / `AT_USERNAME` or use `NODE_ENV=development` only locally |
| Migrations error | Run `./scripts/apply-migrations.sh` against empty DB; use `docker compose down -v` locally to reset |
