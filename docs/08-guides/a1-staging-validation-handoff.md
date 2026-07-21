# A1 Admin Portal — Staging Validation Handoff

**Milestone:** A1 — Admin Portal Foundation  
**Status:** Awaiting hosted staging deployment by you (Option A), then your acceptance testing  
**Production:** Frozen — do not create or change production Admin Web / A1 auth  

For the **A2–A5** staging batch (users, verification, listings, disputes), use:

- [`a2-a5-staging-deployment-checklist.md`](./a2-a5-staging-deployment-checklist.md)
- [`a2-a5-migration-summary.md`](./a2-a5-migration-summary.md)
- [`a3-a5-staging-validation-plan.md`](./a3-a5-staging-validation-plan.md)

This handoff remains the A1 runbook and acceptance baseline. Complete hosted staging
deployment, then the acceptance checklist, before merge / tag for production paths.

---

## 1. Access URLs (fill after your deploy)

| Surface | URL |
|---|---|
| Admin Web | `https://<admin-web-host>` ← from `railway domain --service nahu-admin-web` |
| API | `https://nahu-api-staging.up.railway.app/api/v1` |
| Public health | `https://nahu-api-staging.up.railway.app/health` |
| Admin health (authenticated) | Admin Web → **System** |

Local (`localhost:3001` / `:3000`) remains a development fallback only. Milestone
acceptance is based on hosted staging.

---

## 2. Hosted staging deployment runbook (Option A)

Run in **your** PowerShell / terminal from `C:\NahuAI\nahu-platform`.  
You should already be logged in and linked to `nahu-platform-api` / `staging`.

`railway run` injects service variables locally — `DATABASE_URL` never needs to be
printed or pasted. Requires local `node`, `pnpm`, and `psql` for migrations/bootstrap.

### 0. Confirm context

```powershell
cd C:\NahuAI\nahu-platform
railway status
# expect: project nahu-platform-api, environment staging, service nahu-api
```

### 1. Required API env vars (A1)

Generate a 32-byte key (do not commit it):

```powershell
# PowerShell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
# or: openssl rand -hex 32
```

```powershell
railway variables --service nahu-api --set "ADMIN_MFA_ENCRYPTION_KEY=<paste-hex32>"
railway variables --service nahu-api --set "ADMIN_ACCESS_TOKEN_TTL=15m"
railway variables --service nahu-api --set "ADMIN_REFRESH_ABSOLUTE_HOURS=12"
railway variables --service nahu-api --set "ADMIN_REFRESH_IDLE_MINUTES=30"
railway variables --service nahu-api --set "ADMIN_INVITATION_TTL_HOURS=72"
```

Keep existing `JWT_SECRET` and `OTP_DEV_BYPASS=true` (mobile staging). Workforce
admins remain blocked from OTP even with bypass enabled.

### 2. Apply migrations to staging Postgres

**Do not use** `railway run … node scripts/apply-migrations.mjs` from your laptop.
That injects the private hostname `*.railway.internal`, which only resolves inside
Railway. Local `psql` then fails with “could not translate host name”.

**Use the public Postgres URL instead** (runtime API keeps the private URL):

1. Railway → **staging** → **Postgres** → Variables / Connect.
2. Copy `DATABASE_PUBLIC_URL` (host like `*.proxy.rlwy.net`). Enable TCP proxy /
   public networking temporarily if that variable is missing.
3. From the repo root:

```powershell
cd C:\NahuAI\nahu-platform

# Public URL only in this shell — do not commit, do not set it on nahu-api.
$env:DATABASE_URL = "<DATABASE_PUBLIC_URL>"
$env:APPLIED_BY = "staging-a1-laptop"

# First run on existing staging (pre-A1 schema, empty ledger):
$env:MARK_EXISTING = "1"
node scripts/apply-migrations.mjs
Remove-Item Env:MARK_EXISTING

# Apply A1 migrations:
node scripts/apply-migrations.mjs

Remove-Item Env:DATABASE_URL
```

Confirm the second run applies (or reports already applied):

- `identity/013_identity_admin_user_columns.sql` … `identity/018_…`
- `audit/001_audit_schema.sql`, `audit/002_audit_events.sql`

Full explanation: `docs/08-guides/migration-manifest.md`.

Then continue with **§3 Deploy the API** as before.

### 3. Deploy the API

```powershell
railway up --service nahu-api
```

Verify:

```powershell
curl https://nahu-api-staging.up.railway.app/health
# POST with empty body should be 400 (route exists), not 404:
curl -Method POST https://nahu-api-staging.up.railway.app/api/v1/admin/auth/login `
  -ContentType "application/json" -Body "{}"
```

### 4. Create and deploy Admin Web (CLI-only)

#### Why the earlier attempt built the API

`railway up` uploads the monorepo and Railway reads **`/railway.toml` at the
archive root**. That file belongs to `nahu-api` and sets
`dockerfilePath = "Dockerfile"` (Nest). The CLI has **no flag** to choose a
different config file. Setting `RAILWAY_DOCKERFILE_PATH` does not override a
root `railway.toml`. Dashboard “Config-as-code path” only applies reliably for
GitHub-connected services; with **Connect Repo** unused, use the CLI swap below.

#### One-time service setup

```powershell
railway add --service nahu-admin-web

railway variables --service nahu-admin-web --set "API_BASE_URL=https://nahu-api-staging.up.railway.app/api/v1"
railway variables --service nahu-admin-web --set "NODE_ENV=production"
railway variables --service nahu-admin-web --set "PORT=3001"

# Remove if still present from the earlier attempt
railway variables --service nahu-admin-web --unset "RAILWAY_DOCKERFILE_PATH"
```

Keep the service **without** a GitHub source (CLI deploys are fine). Do not set
Root Directory to `apps/admin-web` — the Dockerfile needs the monorepo root as
build context.

#### Deploy with the swap script (required for CLI)

From the repo root:

```powershell
cd C:\NahuAI\nahu-platform
powershell -File scripts\deploy-admin-web-staging.ps1
```

What the script does:

1. Backs up root `railway.toml` → `railway.api.toml.bak`
2. Writes a temporary root `railway.toml` with `dockerfilePath = "apps/admin-web/Dockerfile"`
3. Runs `railway up --service nahu-admin-web`
4. Restores the API `railway.toml` in a `finally` block (even if deploy fails)

**Success check in build logs:** `pnpm --filter @nahu-platform/admin-web build` and
Next standalone — **not** `@nahu-platform/api` or `apps/api/dist/main.js`.

Then:

```powershell
railway domain --service nahu-admin-web
# Note https://<admin-web-host>
```

Wire origin + CORS and restart the API:

```powershell
railway variables --service nahu-admin-web --set "ADMIN_WEB_ORIGIN=https://<admin-web-host>"
railway variables --service nahu-api --set "CORS_ORIGINS=https://<admin-web-host>"
railway up --service nahu-api
```

Open `https://<admin-web-host>` — Nahu Admin login page.

#### Optional: local image instead of `railway up`

If you prefer not to swap config files:

```powershell
docker build -f apps/admin-web/Dockerfile -t nahu-admin-web:a1 .
# Push to a registry you control, then Railway → nahu-admin-web → Source → Connect Image
```

#### Manual swap (same as the script)

```powershell
cd C:\NahuAI\nahu-platform
Copy-Item railway.toml railway.api.toml.bak -Force
@'
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/admin-web/Dockerfile"

[deploy]
healthcheckPath = "/login"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
'@ | Set-Content railway.toml

railway up --service nahu-admin-web
Move-Item railway.api.toml.bak railway.toml -Force
```

Always restore `railway.toml` before deploying `nahu-api` again.

### 5. Bootstrap the first SUPER_ADMIN

Bootstrap also needs a DB connection from your laptop, so use the **same public
Postgres URL** as migrations — not `railway run` (that injects `.railway.internal`).

Bootstrap no longer signs JWTs. It prints an enroll URL with a **raw invitation
token**; Nest issues the enrollment JWT via
`POST /admin/auth/invitations/enrollment-session` using the live `JwtService`.

```powershell
cd C:\NahuAI\nahu-platform\apps\api
pnpm install   # if argon2 / prisma client not already present

$env:DATABASE_URL = "<DATABASE_PUBLIC_URL>"
# JWT_SECRET is not required for bootstrap.
# Only if the script refuses because NODE_ENV=production is set in your shell:
# $env:ALLOW_ADMIN_BOOTSTRAP = "true"

node scripts/bootstrap-admin.cjs `
  --email a1.staging.admin@nahu.local `
  --phone +251911000001 `
  --password "<STRONG_TEMP_PASSWORD>" `
  --role SUPER_ADMIN `
  --adminOrigin https://<admin-web-host>

Remove-Item Env:DATABASE_URL
# Remove-Item Env:ALLOW_ADMIN_BOOTSTRAP -ErrorAction SilentlyContinue
```

Choose a strong temporary password. Keep password, enroll URL, and recovery codes
**out-of-band** (password manager / secure note). Do not paste them into chat or commit them.

**Then:**

1. Redeploy **nahu-api** and **nahu-admin-web** so the enrollment-session endpoint and BFF changes are live.
2. Open the printed `enrollUrl` (`/enroll-mfa?token=...` — invitation token, not a JWT).
3. Complete TOTP enrollment; save recovery codes once.
4. Sign in at `https://<admin-web-host>/login` with the email + password + TOTP.
5. Optionally invite a `PLATFORM_ADMIN` and an `AUDITOR` for capability checks
   (`docs/08-guides/a1-admin-bootstrap.md`).

---

## 3. Test roles and expected capabilities

| Role | Expected nav | Can invite | Users write actions |
|---|---|---|---|
| `SUPER_ADMIN` | Dashboard, Users, Audit, System, Account | Yes | Status, roles, MFA/password reset, revoke sessions |
| `PLATFORM_ADMIN` | Dashboard, Users, Audit, System, Account | Yes | Status, roles, MFA/password reset, revoke sessions |
| `AUDITOR` | Dashboard, Users, Audit, System, Account | No | Read-only users (no status/roles/MFA/password/sessions) |

Unauthorized sections must be **omitted** from nav; direct API calls return 401/403.

---

## 4. Acceptance checklist

1. [ ] Invite-only administrator onboarding
2. [ ] Invitation acceptance and password setup
3. [ ] Login and clear invalid / locked-account states
4. [ ] TOTP enrollment, verification, and recovery-code behavior
5. [ ] Logout, logout-all, refresh, idle expiry, and expired-session handling
6. [ ] Capability-derived navigation differs correctly by role
7. [ ] Dashboard shell shows only real A1 information and explicit deferred states
8. [ ] Health page is understandable and permission-protected
9. [ ] Audit viewer is read-only, paginated, and redacted
10. [ ] Unauthorized routes/actions fail safely (UI omission plus API 401/403)
11. [ ] UI/UX, responsive behavior, accessibility, and Nahu branding are acceptable
12. [ ] Farmer and Buyer staging behavior remains unaffected

### A2 Users slice (after `identity/019` + redeploy)

13. [ ] Users nav appears for roles with `identity.users.read`
14. [ ] List supports search, status/role filters, sort, pagination
15. [ ] User detail shows profile, credential summary, MFA summary (no secrets)
16. [ ] Status change works with reauth; audit row `identity.user.status.change`
17. [ ] Role assign preserves SUPER_ADMIN / FARMER/BUYER; cannot self-edit
18. [ ] MFA reset returns one-time enroll token; enroll flow works
19. [ ] Password reset returns one-time temp password; sessions revoked
20. [ ] AUDITOR can read users but not mutate
21. [ ] Last active SUPER_ADMIN cannot be locked/deactivated

### A3 Verification (after `marketplace/013` + `identity/020` + redeploy)

22. [ ] Verification nav appears for `verification.read`
23. [ ] Dashboard “Pending verifications” shows a live count and links to `/verification?queue=pending`
24. [ ] Per-type counts link to farmer/buyer/merchant/organization queues
25. [ ] Case detail shows subject payload, documents, and decision history
26. [ ] Approve / reject / request info / suspend require reauth and write audit events
27. [ ] Farmer/merchant decisions sync `verified` + `verification_status` on domain rows
28. [ ] AUDITOR can read queues but cannot decide
29. [ ] MARKETPLACE_MODERATOR can decide farmers/merchants only

### A4 Listing moderation (after `marketplace/014` + `identity/021` + redeploy)

30. [ ] Listings nav appears for `marketplace.listings.read`
31. [ ] Dashboard pending listing moderation count links to `/listings?queue=pending`
32. [ ] Queues filter pending / approved / rejected / suspended / flagged
33. [ ] Detail supports approve, reject, suspend, flag, clear-flag, notes
34. [ ] Bulk actions work for selected rows (with reauth)
35. [ ] Rejected/suspended listings leave public buyer search
36. [ ] New farmer listings enter PENDING until approved
37. [ ] AUDITOR can read but not moderate

### A5 Dispute management (after `orders/010` + `identity/022` + redeploy — when ready)

38. [ ] Disputes nav appears for `orders.disputes.read`
39. [ ] Dashboard open disputes count links to `/disputes?queue=open`
40. [ ] Status filters: Open, Under Review, Resolved, Closed, Escalated
41. [ ] Detail shows buyer/seller, order, evidence, timeline, internal notes
42. [ ] Actions: start review, request info, refund intent, resolve, reject, close, escalate (reauth + audit)
43. [ ] Bulk assign works for selected rows
44. [ ] Raising a dispute from the apps creates/reopens a case
45. [ ] AUDITOR can read but not manage; SUPPORT_AGENT can manage

---

## 5. Security notes

- OTP `123456` / `OTP_DEV_BYPASS` must **not** authenticate workforce admins.
- Never paste live passwords, TOTP secrets, recovery codes, or invite tokens into
  chat. Share credentials out-of-band.
- Do not create or modify a **production** Admin Web service for A1/A2.

---

## 6. Known A1 limitations

- Organizations and farmer verification queues remain deferred (see
  `docs/07-decisions/a2-admin-users-design.md`).
- Dashboard operational queues are explicit placeholders for later slices.
- Invite email delivery is not required on staging; use bootstrap / invite links.
- Organization / region scopes are not stored yet (GLOBAL grants only).

---

## 7. Build identifier

| Field | Value |
|---|---|
| Working-tree reference | `6ab2b19` (confirm with `git rev-parse --short HEAD` after deploy) |
| API | Railway `nahu-api` staging deploy after `railway up` |
| Admin Web | Railway `nahu-admin-web` staging deploy after `railway up` |
| Migrations through | `identity/018_identity_seed_admin_roles_permissions.sql` |

---

## 8. What to send back after testing

Please reply with:

1. Admin Portal staging URL (and confirmation health URL still works).
2. Checklist results (pass / fail per item).
3. Any bugs, UX issues, or change requests (screenshots welcome).
4. Explicit accept / reject of A1 staging.

I will then apply final fixes if needed, re-validate the affected items, and only after
your acceptance: Commit → PR → Merge → Tag `milestone-admin-a1-foundation` → A2 design.

---

## 9. Related docs

- `docs/08-guides/migration-manifest.md`
- `docs/08-guides/a1-admin-bootstrap.md`
- `apps/admin-web/README.md`
- `docs/07-decisions/a1-admin-portal-foundation-design.md`
