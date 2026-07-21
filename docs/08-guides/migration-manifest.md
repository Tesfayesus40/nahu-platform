# Migration manifest

Database migrations are applied in the dependency-safe order declared in
`database/migrations/manifest.json`. Add every new migration to the end of the
appropriate dependency sequence; filesystem sort order is not used.

## Apply migrations

Set `DATABASE_URL`, ensure `psql` is on `PATH`, and run either:

```sh
./scripts/apply-migrations.sh
```

or, on any platform with Node.js:

```sh
node scripts/apply-migrations.mjs
```

Set `APPLIED_BY` to identify a deployment or operator. It defaults to the OS
username and falls back to `apply-migrations`.

Each successfully applied filename and its SHA-256 checksum is recorded in
`public.schema_migrations`. A matching record is skipped. If a recorded
filename's checksum differs from the current file, the scripts stop without
applying later migrations. Never edit an applied migration; create a new one.

## Railway staging: do not use the internal hostname from a laptop

`railway run --service nahu-api` injects `DATABASE_URL` with a private hostname
such as `postgres-….railway.internal`. That name resolves only **inside**
Railway's private network. A local `psql` process cannot reach it and fails with:

```text
could not translate host name "postgres-….railway.internal" to address
```

### Recommended: apply from your laptop using the public Postgres URL

1. In Railway → project **nahu-platform-api** → environment **staging** → **Postgres** service.
2. Open **Variables** (or **Connect** → Public networking / TCP proxy).
3. Copy `DATABASE_PUBLIC_URL` (host looks like `*.proxy.rlwy.net`, **not** `*.railway.internal`).
   If public networking is disabled, enable the TCP proxy once for staging, copy the
   URL, then you may disable public access again after migrations if desired.
4. From the repo root, override `DATABASE_URL` for the migration process only:

```powershell
cd C:\NahuAI\nahu-platform

# Paste the PUBLIC URL only into your local shell — do not commit it.
$env:DATABASE_URL = "<DATABASE_PUBLIC_URL>"
$env:APPLIED_BY = "staging-a1-laptop"

# Existing staging DB (pre-A1 schema already present, ledger empty):
$env:MARK_EXISTING = "1"
node scripts/apply-migrations.mjs
Remove-Item Env:MARK_EXISTING

# Apply remaining A1 migrations:
node scripts/apply-migrations.mjs

Remove-Item Env:DATABASE_URL
```

Do **not** change the `nahu-api` service's runtime `DATABASE_URL` to the public
URL. The API should keep using the private `${{Postgres.DATABASE_URL}}`.

### Alternative: apply inside Railway (private network)

If you prefer not to use a public DB URL, run the same Node script from a
one-off process that has private-network access (for example a temporary
Railway shell / one-off on `nahu-api` that includes `psql` and the repo). The
laptop path above is the supported A1 staging procedure.

## One-time adoption for an existing database

For a database where the pre-A1 migrations were already applied before the
ledger existed, first verify that its schema is current and backed up. Then run
one of:

```sh
MARK_EXISTING=1 ./scripts/apply-migrations.sh
```

```sh
node scripts/apply-migrations.mjs --mark-applied
```

This mode is accepted only when `public.schema_migrations` is empty and
`identity.users` already exists. It records checksums for the 62 pre-A1
migrations without executing them, then applies the A1 migrations normally.
Do not use this mode for a new or partially migrated database.

## A2 User Management

After A1 migrations are applied, ensure
`identity/019_identity_user_management_permissions.sql` is listed in
`manifest.json` (already present in-repo) and run `node scripts/apply-migrations.mjs`
so SUPER_ADMIN / PLATFORM_ADMIN receive:

- `identity.users.status.write`
- `identity.roles.assign`
- `identity.users.mfa.reset`
- `identity.users.password.reset`

## A3 Verification

Apply (in manifest order) after A2:

- `marketplace/013_marketplace_verification_workflow.sql`
- `identity/020_identity_verification_permissions.sql`

Same laptop procedure with `DATABASE_PUBLIC_URL` — do not use `railway.internal`.

## A4 Listing moderation

Apply after A3:

- `marketplace/014_marketplace_listing_moderation.sql`
- `identity/021_identity_listing_moderation_permissions.sql`

## A5 Dispute management

Apply after A4:

- `orders/010_orders_dispute_cases.sql`
- `identity/022_identity_dispute_permissions.sql`

---

## Staging batch handoff (A2–A5)

When deploying A2–A5 together on staging:

1. Checklist (order + deploy steps): [`a2-a5-staging-deployment-checklist.md`](./a2-a5-staging-deployment-checklist.md)
2. Migration explanations: [`a2-a5-migration-summary.md`](./a2-a5-migration-summary.md)
3. E2E validation (A3–A5): [`a3-a5-staging-validation-plan.md`](./a3-a5-staging-validation-plan.md)
