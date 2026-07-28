# RC1 Manifest â€” v1.0.0-rc1

**Status:** Code-complete and **tag-ready** (local) â€” awaiting human approval to push/tag  
**Date:** 2026-07-29  
**Authority:** Authoritative description of the `v1.0.0-rc1` release candidate.

---

## 1. Repositories & release commits

| Repository | Branch | Tip commit (pre-manifest-refresh parent) | Ahead of remote |
|------------|--------|------------------------------------------|-----------------|
| `nahu-platform` | `main` | `b329d8a` â€” product code + release docs complete | **18** ahead of `origin/main` |
| `nahu-buna-gebaya` | `chore/farmer-rc1` | `bd69f15` â€” Buyer/Farmer/Courier/shared + CI | **9** ahead of `origin/chore/farmer-rc1` |

> After this manifest refresh commit lands, use `git rev-parse HEAD` on each repo as the definitive tip for tagging.

**Tags:** none created yet.  
**Push:** not performed.

---

## 2. Version numbers

| Component | Version | Repo |
|-----------|---------|------|
| Monorepo `nahu-platform` | `1.0.0-rc1` | nahu-platform |
| Nest API `@nahu-platform/api` | `1.0.0-rc1` | nahu-platform |
| Admin Web `@nahu-platform/admin-web` | `1.0.0-rc1` | nahu-platform |
| Gebaya root | `1.0.0-rc1` | nahu-buna-gebaya |
| Buyer + Expo `version` | `1.0.0-rc1` | nahu-buna-gebaya |
| Farmer + Expo `version` | `1.0.0-rc1` | nahu-buna-gebaya |
| Courier + Expo `version` | `1.0.0-rc1` | nahu-buna-gebaya |
| Shared packages | Follow gebaya root (no separate semver) | nahu-buna-gebaya |

---

## 3. Included applications

| App | Included |
|-----|----------|
| Nest API | Yes |
| Admin Web | Yes |
| Buyer | Yes |
| Farmer | Yes |
| Courier | **Yes** (RC1 pilot) |
| Shared mobile packages | Yes |

---

## 4. Included backend modules

| Module | Notes |
|--------|-------|
| Identity / Auth | OTP, JWT, admin MFA |
| Catalog G2â€“G5 | Verticals, attributes, listing schema |
| Marketplace | Listings, locations, seller party G7 |
| Orders + Revenue Engine | Fee snapshots, disputes |
| Pricing | Schedules, fees, stub rails |
| Delivery RC1 | Shipments, courier CRM, POD, earnings |
| Fulfilment G8 | Orchestration FSM |
| Payments G9 | Escrow, settlement, stub providers |
| Ops G10 | Dashboard, order inspection, health |
| Production Readiness | Liveness/readiness, CI `test:rules`, Docker `/health/ready`, pilot smoke |

**Database migration level:** through `ops/013_ops_query_indexes.sql`  
Pinned list: [migration-manifest.frozen.json](./migration-manifest.frozen.json) (matches `database/migrations/manifest.json` on tip).

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
| Tagging | `docs/releases/v1.0.0-rc1/TAGGING.md` |
| Nest-only ops | `docs/08-guides/nest-only-ops.md` |
| Mobile pointer | gebaya `RC1_RELEASE.md` |

---

## 6. Exclusions (not in RC1 tag)

| Exclusion | Where |
|-----------|--------|
| Local diagnostic / one-off API scripts | gitignored under `apps/api/scripts/*` (see platform `.gitignore`) |
| Icon orientation experiment assets/scripts | gitignored under gebaya `shared/brand/icons/orientation/` + analyze/compare scripts |
| Courier `UI_REDESIGN.md`, `COURIER_RC1_UI_AUDIT.md` | gitignored |
| Live Telebirr/CBE/Chapa | Deferred Track A |
| Notification platform | Deferred Track B |
| Honey Marketplace | Deferred Track C |
| Legacy Express commercial path | Quarantined (`LEGACY_EXPRESS.md`) |

---

## 7. Known limitations

- Payment providers are **stubs** (not live cash)
- Dynamic delivery fee flag **OFF**
- Courier earnings may be **0** unless `delivery.earning.flat_etb` is set
- Coffee vertical only
- No full push/email notification platform
- Throttler not globally applied on every route (PR-H9 waived for pilot)

---

## 8. Deferred features (RC2+)

| Track | Scope |
|-------|--------|
| A | Live Telebirr, CBE Birr, Chapa |
| B | Push / SMS / Email notifications |
| C | Honey Marketplace activation |

---

## 9. Prerequisites for deployment

1. Push approved release branches (human)  
2. Create annotated tags `v1.0.0-rc1` on both repos (human)  
3. Apply migrations through `ops/013` on staging  
4. Deploy Nest image; verify `GET /health/ready`  
5. Point Admin Web + Buyer/Farmer/Courier EAS at Nest  
6. Set secrets (`JWT_SECRET`, `ADMIN_MFA_ENCRYPTION_KEY`, `CORS_ORIGINS`, â€¦)  
7. Run [CHECKLIST.md](./CHECKLIST.md) + [PILOT-VERIFICATION.md](./PILOT-VERIFICATION.md)

---

## 10. Tag readiness verdict

| Repo | Working tree | Tag-ready? |
|------|--------------|------------|
| `nahu-platform` | Clean | **Yes** (after this manifest commit) |
| `nahu-buna-gebaya` | Clean | **Yes** |

**Do not push or tag until the release owner approves.**
