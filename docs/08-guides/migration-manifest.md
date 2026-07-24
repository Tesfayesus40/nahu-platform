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

## A6–A8 Batch 2 (dashboard / audit / system)

Apply after A5:

- `ops/001_ops_schema.sql`
- `ops/002_ops_feature_flags.sql`
- `audit/003_audit_events_filter_indexes.sql`
- `identity/023_identity_batch2_permissions.sql`

## A9–A11 Batch 3 (commerce & operations)

Apply after A8:

- `orders/011_orders_admin_notes.sql`
- `delivery/001_delivery_schema.sql`
- `delivery/002_delivery_fulfillment_cases.sql`
- `marketplace/015_marketplace_promotions.sql`
- `identity/024_identity_batch3_permissions.sql`

Handoff: [`a9-a11-staging-deployment-checklist.md`](./a9-a11-staging-deployment-checklist.md)

## D1 Delivery identity / RBAC / config

Apply after A14 / batch4 permissions:

- `identity/026_identity_delivery_phase1_permissions.sql`
- `ops/006_ops_delivery_phase1_config.sql`

Then regenerate Prisma client (`npx prisma generate` in `apps/api`).

## D2 Delivery shipment domain schema

Apply after D1:

- `delivery/003_delivery_shipment_domain.sql`
- `delivery/004_delivery_aggregate_guards.sql` (immutability + assignment integrity)

Then `npx prisma generate` in `apps/api`. See [`d2-delivery-shipment-domain-schema.md`](../07-decisions/d2-delivery-shipment-domain-schema.md).

## D3 Courier application foundation

App: `nahu-buna-gebaya/nahu-buna-courier/`. Nest courier routes in `apps/api` (no new SQL beyond D2/004). See [`d3-courier-application-foundation.md`](../07-decisions/d3-courier-application-foundation.md).

## D4 Dispatch assignment engine

Apply after D3:

- `ops/007_ops_delivery_dispatch_config.sql`

See [`d4-dispatch-assignment-engine.md`](../07-decisions/d4-dispatch-assignment-engine.md).

## D5 Delivery execution engine

Apply after D4:

- `delivery/005_delivery_execution_arrived_status.sql` (`ARRIVED` + `arrived_at`)

Then `npx prisma generate` in `apps/api`. See [`d5-delivery-execution-engine.md`](../07-decisions/d5-delivery-execution-engine.md).

## D6 Delivery operations administration

No new SQL. Admin APIs + Admin Portal ops UI. See [`d6-delivery-operations-administration.md`](../07-decisions/d6-delivery-operations-administration.md).

## D7 Courier delivery experience

No new SQL. Courier list query params + app UX. See [`d7-courier-delivery-experience.md`](../07-decisions/d7-courier-delivery-experience.md).

## D8 Farmer & Buyer delivery experience

No new SQL. Party read APIs + Farmer/Buyer tracking UX. See [`d8-farmer-buyer-delivery-experience.md`](../07-decisions/d8-farmer-buyer-delivery-experience.md).

## D9 Delivery operational readiness

SQL: `ops/008_ops_delivery_sla_thresholds.sql` (SLA hour settings). Admin ops metrics/alerts + portal polish. See [`d9-delivery-operational-readiness.md`](../07-decisions/d9-delivery-operational-readiness.md).

## D10 Proof of Delivery framework

SQL: `ops/009_ops_delivery_pod_requirements.sql` (OTP/photo/GPS/recipient flags). See [`d10-proof-of-delivery-framework.md`](../07-decisions/d10-proof-of-delivery-framework.md).

## D11 Courier earnings & settlement

SQL: `delivery/006_delivery_earnings_settlement_types.sql` (earning types + settlement ledger statuses). Append-only immutability remains from `delivery/004`. See [`d11-courier-earnings-settlement.md`](../07-decisions/d11-courier-earnings-settlement.md).

## D12 Delivery RC1 hardening

SQL: `delivery/007_delivery_rc1_hardening_indexes.sql` (unique primary accrual, unique earning references, hot-path indexes). See [`d12-delivery-platform-rc1-architecture.md`](../07-decisions/d12-delivery-platform-rc1-architecture.md).
