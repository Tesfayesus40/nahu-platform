# UAT Database Reset (data-only)

Safe, repeatable wipe of **application / demo / test data** for RC1 UAT.
Schema, migrations, indexes, constraints, triggers, enums, functions, RBAC,
catalog lookups, and ops configuration stay intact.

## RC1 UAT policy

For RC1 User Acceptance Testing on **staging**:

- Do **not** run `pnpm db:seed:demo`.
- Staging stays empty of business data so journeys match a fresh production deploy.
- All UAT records are created **manually** via Farmer, Buyer, Courier, and Admin apps
  (English / Amharic UAT datasets).
- Demo seed remains available for local demos, presentations, UI walkthroughs, and
  automated tests — only run on staging if explicitly requested.

Phase 2 of the roadmap starts only after RC1 UAT completes and critical defects are fixed.

## What is removed

- Users not in the preserve set (see below)
- Listings, pickup locations, buyer addresses, farmer profiles, cooperatives
- Orders, disputes, certificates, admin order notes
- Shipments, stops, assignments, events, POD, earnings, tracking, courier profiles
- Farms / inventory / warehouse transactional rows
- OTP codes, admin sessions/invitations, orgs
- Ops runtime notifications / report jobs
- Audit events

Kept login accounts retain identity + roles + credentials/MFA, but **lose**
business rows (profiles, listings, orders, shipments). Recreate those through the apps.

## What is preserved

| Layer | Preserved |
| --- | --- |
| Schema | All tables, indexes, constraints, triggers, enums, functions |
| Migrations | `public.schema_migrations` ledger (not re-run) |
| RBAC | `identity.roles`, `permissions`, `role_permissions` |
| Catalog | categories, units, products, varieties, translations |
| Ops config | feature flags, system settings, alert thresholds |
| Farms lookups | season codes, activity types |
| Default users | Anyone with `SUPER_ADMIN` or `PLATFORM_ADMIN` |
| Optional users | `--keep-user` / `--keep-role` (see below) |

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm db:reset -- --confirm=UAT_RESET` | Data-only wipe + sequence restart |
| `pnpm db:reset -- --dry-run` | Counts + preserve list only |
| `pnpm db:seed` | Verify system/config baseline (migration seeds) |
| `pnpm db:seed:demo` | Optional demo farmer/buyer/courier (not for RC1 staging) |
| `pnpm db:reset-staging` | Alias: reset with confirm already set |

SQL truncate list: `database/scripts/uat-data-reset.sql`  
Runner: `apps/api/scripts/uat-data-reset.cjs`

### Preserve selected accounts

Default keep roles: `SUPER_ADMIN`, `PLATFORM_ADMIN`.

Additional flags (repeatable):

| Flag | Meaning |
| --- | --- |
| `--keep-user=+2519…` | Keep user by phone |
| `--keep-user=name@example.com` | Keep user by email |
| `--keep-role=ADMIN` | Keep all users with that role code |
| `--keep-role=SUPPORT_AGENT` | Same, any seeded role code |

Examples:

```powershell
# Keep specific UAT phones across a wipe
pnpm db:reset -- --confirm=UAT_RESET `
  --keep-user=+251911200001 `
  --keep-user=+251911300001 `
  --keep-user=+251911400001

# Also keep every ADMIN (plus default SUPER_ADMIN / PLATFORM_ADMIN)
pnpm db:reset -- --confirm=UAT_RESET --keep-role=ADMIN

# Preview who would be kept
pnpm db:reset -- --dry-run --keep-user=+251911200001 --keep-role=ADMIN
```

Unknown phones/emails are warned and skipped. Unknown role codes are warned and ignored.

### System vs demo seed

- **System** (`db:seed`): configuration comes from SQL migrations. Asserts
  roles/permissions/catalog/ops/lookups (warns if no admin exists).
- **Demo** (`db:seed:demo`): optional actors only — no listings/orders.

| Role | Phone |
| --- | --- |
| Demo Farmer | `+251911000101` |
| Demo Buyer | `+251911000201` |
| Demo Courier | `+251911000301` |

If no admin remains after a bad wipe, bootstrap:

```bash
node apps/api/scripts/bootstrap-admin.cjs \
  --email you@nahu.ai \
  --phone +2519XXXXXXXX \
  --password '…' \
  --role SUPER_ADMIN
```

---

## Local

1. Point at local Postgres (no Railway internal host):

```powershell
cd C:\NahuAI\nahu-platform
$env:DATABASE_URL = "postgresql://USER:PASS@localhost:5432/nahu"
```

2. Ensure migrations are already applied.

3. Dry-run, then reset:

```powershell
pnpm db:reset -- --dry-run
pnpm db:reset -- --confirm=UAT_RESET
pnpm db:seed
# local demos only:
# pnpm db:seed:demo
```

---

## Staging (RC1)

Use the **public** proxy URL (`DATABASE_PUBLIC_URL`), never `*.railway.internal`.

```powershell
cd C:\NahuAI\nahu-platform
$env:DATABASE_PUBLIC_URL = "<staging public postgres url>"

pnpm db:reset -- --dry-run
pnpm db:reset -- --confirm=UAT_RESET
pnpm db:seed
# DO NOT run db:seed:demo on RC1 staging
```

Between UAT cycles, keep stable tester phones:

```powershell
pnpm db:reset -- --confirm=UAT_RESET `
  --keep-user=+251911200001 `
  --keep-user=+251911300001 `
  --keep-user=+251911400001
```

### Post-reset checks

1. Runner prints `UAT data reset OK`; `schema_migrations` unchanged.
2. `listings = 0`, `orders = 0`, `shipments = 0`; kept users remain.
3. API `/health` reports database up.
4. Admin Portal login with SUPER_ADMIN / PLATFORM_ADMIN.
5. Mobile: register or log in; enter UAT data through the UI.
6. No FK errors on empty list endpoints.

---

## Confirmations

- **Only data removed** — `TRUNCATE` / `DELETE` on business rows; no `DROP TABLE`,
  no migration re-apply, no schema DDL.
- **Migrations unchanged** — `public.schema_migrations` is never truncated.
- Legacy `reset-test-data.mjs` is deprecated; use `db:reset`.

---

## Dev workflow

| Goal | Commands |
| --- | --- |
| Empty UAT-like DB | `pnpm db:reset -- --confirm=UAT_RESET` then `pnpm db:seed` |
| Repeat UAT, keep phones | same + `--keep-user=…` |
| Minimal local (config only) | reset + seed; skip demo |
| Full demo actors | reset + seed + `pnpm db:seed:demo` (not RC1 staging) |

Keep **system** and **demo** seeds separate so pilot / production-like
environments stay clean while demos remain one command away.
