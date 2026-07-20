# A1 Admin Bootstrap Runbook

One-time procedure to create the first workforce administrators. Use on **staging**
(or local). Do **not** use on production until production Admin Portal is explicitly
approved.

Credentials, invite tokens, TOTP secrets, and recovery codes must be handled
out-of-band. Never commit them.

---

## Prerequisites

1. A1 migrations applied via `scripts/apply-migrations.mjs` (or `.sh`).
2. Nest API running with:
   - `JWT_SECRET` (strong)
   - `ADMIN_MFA_ENCRYPTION_KEY` (32-byte hex or base64; required when `NODE_ENV=production`)
3. Admin Web reachable (staging URL or `http://localhost:3001`).

Generate MFA key:

```bash
openssl rand -hex 32
```

---

## Option A — SQL bootstrap of the first SUPER_ADMIN (staging/local)

Use when no inviter exists yet.

1. Choose email, Ethiopian phone (`+251XXXXXXXXX`), and a strong temporary password.
2. Hash the password with Argon2id (Node one-liner from repo root after `pnpm install`):

```bash
node -e "const argon2=require('argon2'); argon2.hash(process.argv[1]).then(console.log)" "YOUR_TEMP_PASSWORD"
```

3. In `psql` against the target database, run a controlled insert (edit values):

```sql
BEGIN;

WITH new_user AS (
  INSERT INTO identity.users (
    first_name, last_name, phone, email, status,
    phone_verified, email_verified, mfa_required, authz_version
  ) VALUES (
    'Bootstrap', 'Admin', '+2519XXXXXXX', 'admin@example.com', 'ACTIVE',
    true, true, true, 1
  )
  RETURNING id
),
cred AS (
  INSERT INTO identity.credentials (user_id, password_hash, password_changed_at)
  SELECT id, '$ARGON2_HASH$', NOW() FROM new_user
  RETURNING user_id
)
INSERT INTO identity.user_roles (user_id, role_id)
SELECT cred.user_id, r.id
FROM cred
JOIN identity.roles r ON r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

COMMIT;
```

4. Complete TOTP enrollment through the portal enroll URL printed by the bootstrap
   script (`/enroll-mfa?token=...`), then sign in at `/login`.

---

## Option B — Invitation flow (preferred after first inviter exists)

1. Sign in as `SUPER_ADMIN` or `PLATFORM_ADMIN`.
2. Create an invitation via API (requires recent re-auth password):

```bash
curl -X POST "$API/admin/auth/invitations" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ops@example.com",
    "phone": "+2519XXXXXXX",
    "roleCodes": ["PLATFORM_ADMIN"],
    "reauthPassword": "CURRENT_PASSWORD",
    "reason": "Staging acceptance tester"
  }'
```

3. Share the returned invite token / accept URL out-of-band:
   `{ADMIN_WEB_ORIGIN}/accept-invite?token=...`
4. Recipient: set password → enroll TOTP → save recovery codes → login.

For `AUDITOR` test accounts, use `"roleCodes": ["AUDITOR"]`.

---

## Option C — Dev/staging bootstrap script (laptop + public DB URL)

From `apps/api` after dependencies are installed. Use the Postgres
`DATABASE_PUBLIC_URL` (not `*.railway.internal`). **Do not pass `JWT_SECRET`** —
bootstrap only creates the invitation; Nest signs the enrollment JWT.

```powershell
cd apps/api
$env:DATABASE_URL = "<DATABASE_PUBLIC_URL>"
# $env:ALLOW_ADMIN_BOOTSTRAP = "true"   # only if NODE_ENV=production in your shell

node scripts/bootstrap-admin.cjs `
  --email admin@example.com `
  --phone +2519XXXXXXX `
  --password '...' `
  --role SUPER_ADMIN `
  --adminOrigin https://<admin-web-host>
```

The script prints an `enrollUrl` with a raw invitation token. Open it out-of-band,
complete TOTP, save recovery codes, then login. Clear the env vars afterward. Prefer
disabling public DB access again once bootstrap is done if you enabled it only for
this step.

---

## Dual custody

Maintain at least two separately held `SUPER_ADMIN` identities on staging before
calling A1 complete. Do not share a single admin account.

---

## Verification

1. Login with email + password → MFA challenge → portal.
2. Capabilities match the role.
3. Audit log shows login and invitation events.
4. OTP `123456` cannot obtain an admin session for the workforce user.
5. Logout and logout-all revoke access as expected.
