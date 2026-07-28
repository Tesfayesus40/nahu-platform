# RC1 Manifest — v1.0.0-rc1

**Status:** Documentation / version freeze prepared — **not tag-ready** until RC1-required product code is committed  
**Date:** 2026-07-29  
**Authority:** This file is the authoritative description of what `v1.0.0-rc1` is intended to contain vs what is currently on release commits.

---

## 1. Repositories & release commits

| Repository | Branch | Latest release-prep commit | Ahead of remote |
|------------|--------|----------------------------|-----------------|
| `nahu-platform` | `main` | `5adbb62` — `docs(release): prepare v1.0.0-rc1 freeze and release pack` | **1** ahead of `origin/main` |
| `nahu-buna-gebaya` | `chore/farmer-rc1` | `419bad2` — `docs(release): prepare v1.0.0-rc1 freeze for mobile apps` | **1** ahead of `origin/chore/farmer-rc1` |

**Tags:** none created yet.  
**Push:** not performed.

---

## 2. Version numbers (on release commits)

| Component | Version on HEAD | Repo |
|-----------|-----------------|------|
| Monorepo `nahu-platform` | `1.0.0-rc1` | nahu-platform |
| Nest API `@nahu-platform/api` | `1.0.0-rc1` | nahu-platform |
| Admin Web `@nahu-platform/admin-web` | `1.0.0-rc1` | nahu-platform |
| Gebaya root | `1.0.0-rc1` | nahu-buna-gebaya |
| Buyer app + Expo `version` | `1.0.0-rc1` | nahu-buna-gebaya |
| Farmer app + Expo `version` | `1.0.0-rc1` | nahu-buna-gebaya |
| **Courier app** | **Excluded from this RC1 commit set** | see §2.1 |
| Shared packages (`shared/**`) | No separate package version — versioned with gebaya root | nahu-buna-gebaya |

### 2.1 Courier exclusion (version consistency)

**Decision:** Courier is **explicitly excluded** from the taggable RC1 commit set until its application source is committed.

| Fact | Detail |
|------|--------|
| On HEAD | `nahu-buna-courier/COURIER_RC1.md` + some assets only (~9 tracked paths) |
| Working tree only | `package.json`, `app.config.js` (`1.0.0-rc1`), `App.js`, `src/**`, EAS config, etc. |
| Reason | Committing checklist/version labels without the runnable app would leave a partially versioned, non-reproducible pilot surface |

**To include Courier in RC1:** commit the full `nahu-buna-courier/` app at `1.0.0-rc1`, then update this manifest and [VERSION-FREEZE.md](./VERSION-FREEZE.md) before tagging.

---

## 3. Included applications (intended RC1 scope)

| App | Intended in RC1 | On release commit today? |
|-----|-----------------|--------------------------|
| Nest API | Yes | **No** — G2–G10 / Production Readiness code still WIP on disk |
| Admin Web | Yes | **No** — pricing/catalog portals & related changes still WIP |
| Buyer | Yes | **Partial** — version bump only; Nest/delivery/fee screens still WIP |
| Farmer | Yes | **Partial** — version bump only; schema listing / delivery WIP |
| Courier | Yes (product intent) | **Excluded** until source committed (§2.1) |

---

## 4. Included backend modules (intended when code is committed)

| Module / gate | Role |
|---------------|------|
| Identity / Auth | OTP, JWT, admin MFA |
| Marketplace + Catalog G2–G5 | Coffee vertical, attributes, listing schema |
| Seller Party G7 | Generic sellers; farmer bridge |
| Orders + Revenue Engine | Fee snapshots, disputes |
| Delivery RC1 (D1–D12) | Shipments, courier CRM, POD, earnings |
| Fulfilment G8 | Orchestration FSM |
| Payments G9 | Escrow / settlement / stub providers |
| Ops G10 | Admin ops dashboard & inspection |
| Pricing | Schedules, fees, stub rails |

**Database migration level (frozen target):** through `ops/013_ops_query_indexes.sql`  
See [migration-manifest.frozen.json](./migration-manifest.frozen.json).

**Important:** `database/migrations/manifest.json` and G8–G10 SQL files are still **uncommitted** in the working tree. The frozen JSON in this release pack describes the **target** RC1 schema, not what is necessarily on `origin/main` today.

---

## 5. Release documents

| Document | Path |
|----------|------|
| This manifest | `docs/releases/v1.0.0-rc1/RC1_MANIFEST.md` |
| Release notes | `docs/releases/v1.0.0-rc1/README.md` |
| Version freeze | `docs/releases/v1.0.0-rc1/VERSION-FREEZE.md` |
| Deployment | `docs/releases/v1.0.0-rc1/DEPLOYMENT.md` |
| Checklist | `docs/releases/v1.0.0-rc1/CHECKLIST.md` |
| Pilot verification | `docs/releases/v1.0.0-rc1/PILOT-VERIFICATION.md` |
| Backlog | `docs/releases/v1.0.0-rc1/BACKLOG.md` |
| Tagging procedure | `docs/releases/v1.0.0-rc1/TAGGING.md` |
| Frozen migrations | `docs/releases/v1.0.0-rc1/migration-manifest.frozen.json` |
| Production Readiness | `docs/09-platform-evolution/37-production-readiness.md` |
| Mobile pointer | gebaya `RC1_RELEASE.md` |

---

## 6. Known limitations

- Payment providers are **stubs** (not live Telebirr/CBE/Chapa)
- Dynamic delivery fee flag **OFF**
- Courier earnings may be **0** unless `delivery.earning.flat_etb` is set
- Coffee vertical only
- No full notification platform
- Legacy Express in gebaya root is **quarantined** (not RC1 path)
- Courier app **not** on release commits (excluded §2.1)
- Most RC1 product code still **uncommitted** — tagging HEAD today would **not** ship G8–G10 / mobile Nest work

---

## 7. Deferred features (RC2+ / Tracks A–C)

| Track | Scope |
|-------|--------|
| A | Live Telebirr, CBE Birr, Chapa |
| B | Push / SMS / Email notification platform |
| C | Honey Marketplace activation |
| Other | Device E2E, OpenAPI, finance ledger, refund policy engine |

---

## 8. Prerequisites for deployment (when tag-ready)

1. Commit all **RC1 required** working-tree paths (see §9) into the release branches  
2. Confirm versions still `1.0.0-rc1` (and Courier included or still excluded by decision)  
3. Apply migrations through `ops/013` on staging  
4. Deploy Nest Docker image; verify `/health/ready`  
5. Point Admin Web + mobile EAS at Nest (never Express)  
6. Set secrets (`JWT_SECRET`, `ADMIN_MFA_ENCRYPTION_KEY`, `CORS_ORIGINS`, …)  
7. Run checklist + pilot path (`PILOT-VERIFICATION.md`)  
8. **Then** create annotated tags `v1.0.0-rc1` (human approval required)

---

## 9. Uncommitted inventory (finalization review)

Classification key:

- **RC1 required** — must land on the tagged commit for a reproducible pilot  
- **Future work** — keep out of RC1 tag  
- **Temporary / generated** — do not tag; gitignore or delete  
- **Can be discarded** — safe to drop if regenerable / accidental  

### 9.1 nahu-platform (summary)

| Path / group | Reason still uncommitted | Classification | Recommendation |
|--------------|--------------------------|----------------|----------------|
| `apps/api/src/pricing/**`, `payments/**`, `ops/**`, G8 orchestration | Production Readiness / G8–G10 product code | **RC1 required** | Commit before tag |
| `database/migrations/{catalog,pricing,payments,delivery/009,identity/027–029,ops/010–013,orders/012–013,marketplace/016–021}/**` + `manifest.json` | Schema for RC1 money/ops path | **RC1 required** | Commit before tag |
| `apps/api` health/main/Dockerfile, `.env.example`, staging-deploy, CI, `test:rules` / `run-rules-tests.cjs`, `pilot-e2e-smoke.cjs`, `pnpm-lock.yaml` | PR hardening + CI | **RC1 required** | Commit before tag |
| `apps/admin-web` pricing/catalog portals + nav/types/order/dispute wiring | Admin RC1 surfaces | **RC1 required** | Commit before tag |
| `apps/api/prisma/schema.prisma` + marketplace/orders/delivery hooks | Supports RC1 modules | **RC1 required** | Commit with modules |
| `docs/08-guides/nest-only-ops.md`, revenue-engine-*, technical-debt, evolution `01–36`, README | Supporting RC1 ops/design docs | **RC1 required** (docs) | Commit with release or immediately after product commit |
| `apps/api/scripts/{diagnose-*,approve-listing,apply-location*,smoke-location*,probe-*,inspect-*,rc1-db-crm*,verify-shipment*}.cjs` | One-off staging diagnostics | **Temporary / generated** or ops tooling | Keep out of tag or quarantine under `scripts/uat/`; do not block RC1 |
| `scripts/apply-location-migrations.cjs` | Location migration helper | **Future work** / tooling | Exclude from tag unless needed for staging |
| Icon/audit one-offs already absent | — | — | — |

### 9.2 nahu-buna-gebaya (summary)

| Path / group | Reason still uncommitted | Classification | Recommendation |
|--------------|--------------------------|----------------|----------------|
| Buyer Nest/auth/checkout fee/delivery screens + `tokenStorage`, delivery address screens | Buyer RC1 against Nest | **RC1 required** | Commit before tag |
| Farmer Nest/schema listing/pickup/delivery screens | Farmer RC1 | **RC1 required** | Commit before tag |
| `shared/{marketplace,delivery,components/**}` tests + helpers | Shared RC1 contracts | **RC1 required** | Commit before tag |
| `.github/workflows/ci.yml`, root `test` script, `LEGACY_EXPRESS.md`, AGENTS Expo 54, `.gitignore` | CI / Nest-only hygiene | **RC1 required** | Commit before tag |
| `nahu-buna-courier/**` (app source; not checklist) | Courier pilot app | **RC1 required** *if* courier in pilot; else keep excluded | Commit full app **or** keep §2.1 exclusion |
| `shared/brand/icons/orientation/*`, compare/analyze glyph scripts | Icon orientation experiments | **Temporary / generated** | Discard or keep local; do not tag |
| `nahu-buna-courier/UI_REDESIGN.md`, `COURIER_RC1_UI_AUDIT.md` | Design notes | **Future work** | Exclude from tag |
| `docs/guides/google-maps-configuration.md` | Maps setup | **Future work** / ops | Optional; not blocking freeze docs |
| `package.json.*` backup clones (if any) | Accidental copies | **Can be discarded** | Delete; already gitignored pattern |
| `.tmp-rc1-export*` (if present) | Expo export junk | **Temporary / generated** | Delete / gitignore |

---

## 10. Tag readiness verdict

| Repo | Tag-ready now? | Why |
|------|----------------|-----|
| `nahu-platform` | **No** | Release docs + versions only; G8–G10 / PR / Admin product code uncommitted |
| `nahu-buna-gebaya` | **No** | Version bumps + checklists only; Buyer/Farmer Nest work + shared + Courier source uncommitted |

**Next step after approval:** commit RC1-required groups → refresh this manifest with final hashes → then create tags / push.

---

## 11. Sign-off

| Gate | Owner | Date | Result |
|------|-------|------|--------|
| Manifest reviewed | | | |
| RC1-required code committed | | | |
| Tag `v1.0.0-rc1` approved | | | |
