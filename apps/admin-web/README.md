# Nahu Admin Portal (`@nahu-platform/admin-web`)

A1 security shell for the Nahu platform admin portal. Next.js 15 (App Router)
with a cookie-based BFF that proxies to the Nest API — no Prisma, no direct
database access, and no tokens exposed to client JavaScript.

## What's in A1

- **Auth**: login → TOTP/recovery MFA → session; invitation acceptance with
  password setup, TOTP enrollment, and one-time recovery codes.
- **Portal**: permission-gated navigation (Dashboard, Audit, System, Account),
  dashboard skeleton, read-only paginated audit log, system health panel,
  account profile with logout / logout-everywhere.
- **Not in A1**: People/Catalog/Marketplace pages, operational queues (A2+).

## Architecture

```
Browser ── readable CSRF cookie only ──▶ Next.js BFF (app/api/**) ──▶ Nest API (API_BASE_URL)
                HttpOnly cookies: nahu_admin_access / nahu_admin_refresh
```

- `nahu_admin_access` / `nahu_admin_refresh` — HttpOnly, SameSite=Lax cookies
  holding the Nest tokens. Never readable by client JS. `Secure` in production.
- `nahu_admin_csrf` — readable cookie for double-submit CSRF; every mutating
  BFF route requires a matching `x-csrf-token` header.
- Short-lived HttpOnly cookies carry the MFA challenge token
  (`nahu_admin_mfa`) and invite enrollment token (`nahu_admin_enroll`) between
  steps, so those tokens also never reach client JS.
- On a Nest 401, the BFF tries the refresh token once, rotates cookies, and
  retries the original request.
- `middleware.ts` redirects unauthenticated users off portal pages to
  `/login`, and authenticated users off auth pages to `/`.

## Run locally

Prereqs: Node 20+, pnpm 9, and the Nest API running on port 3000
(`pnpm --filter @nahu-platform/api dev` from the repo root).

```bash
# from the monorepo root
pnpm install

cd apps/admin-web
cp .env.example .env   # defaults point at http://localhost:3000/api/v1

pnpm dev               # http://localhost:3001
```

Or via turbo from the root: `pnpm dev` / `pnpm build`.

Ports: Nest API on **3000**, admin portal on **3001**.

### Environment

| Variable           | Default                        | Purpose                        |
| ------------------ | ------------------------------ | ------------------------------ |
| `API_BASE_URL`     | `http://localhost:3000/api/v1` | Nest API base (server-side)    |
| `ADMIN_WEB_ORIGIN` | `http://localhost:3001`        | Public origin of this app      |
| `NODE_ENV`         | `development`                  | `production` enables Secure cookies |

Never commit `.env` — only `.env.example` is tracked.

### First admin sign-in flow

1. An invitation is created against the Nest API (returns a one-time invite token).
2. Open `http://localhost:3001/accept-invite?token=<inviteToken>`.
3. Set a password, add the TOTP secret to an authenticator app, confirm a
   code, and save the recovery codes (shown once).
4. Sign in at `/login` with email + password, then the TOTP code.

## Deployment (Railway staging)

### CLI-only (recommended for A1)

`railway up` always reads the **repo-root** `railway.toml`, which belongs to the
API. Use the swap script so the upload temporarily points at the Admin Web
Dockerfile:

```powershell
# from monorepo root, project linked to staging
powershell -File scripts\deploy-admin-web-staging.ps1
```

Build logs must show `@nahu-platform/admin-web`, not `@nahu-platform/api`.

### Local Docker image

```bash
docker build -f apps/admin-web/Dockerfile -t nahu-admin-web .
docker run -p 3001:3001 -e API_BASE_URL=https://<api-host>/api/v1 nahu-admin-web
```

Or push the image and use Railway → Source → **Connect Image**.

### GitHub-connected service (later)

If you later connect the repo, set Config-as-code path to
`/apps/admin-web/railway.toml` and keep build context at the monorepo root.
Until then, do not rely on `RAILWAY_DOCKERFILE_PATH` alone while root
`railway.toml` is the API config — the CLI will keep building Nest.
