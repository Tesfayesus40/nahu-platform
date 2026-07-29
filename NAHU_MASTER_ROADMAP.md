# Nahu Platform — Master Roadmap (Source of Truth)

**Document:** `NAHU_MASTER_ROADMAP.md`  
**Role:** Strategic + operational continuity for humans and Cursor agents  
**Last updated:** 2026-07-29  
**Living progress board:** [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md)  
**Strategic input (adopted):** `Nahu_Platform_Strategic_Roadmap` (2026-07-29)

> If guidance conflicts, prefer: (1) critical production/pilot safety, (2) this master doc + living roadmap, (3) phase-specific release packs under `docs/releases/`.

---

## 1. Product vision

Nahu is Ethiopia’s **digital agriculture platform**: secure, mobile-first infrastructure connecting farmers, buyers, cooperatives, couriers, and operators.

**Near-term product:** Coffee Marketplace (Nest API + Admin Web + Buyer/Farmer/Courier apps).  
**Mid-term product milestone:** **Nahu Farms (`v2.0`)** — same marketplace core, many agricultural categories.  
**Long-term portfolio:** Delivery, AI/advisory, Wallet/Finance, and broader ecosystem modules — as separate phases after coffee maturity.

Enterprise vision detail: [docs/business/](./docs/business/) · enterprise `.docx` under `docs/architecture/`.

---

## 2. Architecture overview

| Layer | Implementation |
|-------|----------------|
| API | NestJS monorepo app `@nahu-platform/api` — `/api/v1` |
| Admin | Next.js Admin Web (BFF → Nest) |
| Mobile | Expo apps in `nahu-buna-gebaya` (Buyer, Farmer, Courier) |
| Data | PostgreSQL; **SQL migrations are schema authority** |
| Identity | OTP mobile roles + workforce Admin MFA |
| Commerce | Catalog → Listings → Orders → Stub payments / escrow ledger → Fulfilment → Delivery/POD → Settlement |
| Ops | Admin dashboard, audit, verification, moderation, pricing, delivery ops |

**Hard rules**

- Nest-only for RC1+ mobile/admin traffic (no legacy Express for new work).  
- Platform-first, modular, API-first ([architecture principles](./docs/02-architecture/architecture-principles.md)).  
- Keep domain logic generic so new categories reuse catalog/attributes/listings rather than forked codepaths.

Repos

| Area | Path |
|------|------|
| Docs index | [docs/README.md](./docs/README.md) |
| Architecture principles | [docs/02-architecture/architecture-principles.md](./docs/02-architecture/architecture-principles.md) |
| Platform evolution (multi-ag) | [docs/09-platform-evolution/](./docs/09-platform-evolution/) |
| Decision records | [docs/07-decisions/](./docs/07-decisions/) |
| Staging deploy | [docs/08-guides/staging-deploy.md](./docs/08-guides/staging-deploy.md) |

---

## 3. Official strategic roadmap

Adopted from the Nahu Platform Strategic Roadmap.

```text
Phase 0  Foundation                    [DONE]
Phase 1  RC1 Pilot & UAT               [CURRENT]
Phase 2  Coffee Production v1.0.0
Phase 3  Stabilization v1.0.x
Phase 4  Coffee Enhancement v1.1
Phase 5  Nahu Farms v2.0               ← next major PRODUCT milestone after coffee maturity
Phase 6  Enterprise Agriculture
Phase 7  Nahu Delivery (expanded)
Phase 8  AI & Smart Agriculture
Phase 9  Nahu Ecosystem
```

**Sequencing law:** Do not implement a future phase until the current phase is successfully completed **and approved**.  
**Maintenance law:** `v1.0.1`-style fixes from pilot/production outrank starting the next major milestone.

Progress and exit criteria: always update [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md).

---

## 4. Version roadmap

| Version | Intent |
|---------|--------|
| `v1.0.0-rc1` | Coffee RC — tagged; staging validated; UAT in progress |
| `v1.0.0-rc1.x` | Optional UAT hotfix tags if needed |
| `v1.0.0` | First production Coffee Marketplace release (Phase 2) |
| `v1.0.x` | Stabilization patches (Phase 3) |
| `v1.1.0` | Live payments, notifications, search/ratings, courier upgrades (Phase 4) |
| `v2.0.0` | **Nahu Farms** multi-category marketplace (Phase 5) |
| Later | Delivery product expansion, AI, Wallet/Ecosystem (Phases 6–9) |

Companion mobile repo versions track the same release trains (`nahu-buna-gebaya`).

---

## 5. Release history (summary)

| Release | Repos | Outcome |
|---------|-------|---------|
| `v1.0.0-rc1` | `nahu-platform` + `nahu-buna-gebaya` | Tagged; CI recovered; staging deployed; migrations through `ops/013`; pilot APKs built; UAT pack prepared |
| Pre-RC1 | Platform evolution G1–G10, Delivery D1–D12, Admin A1–A14, Farms 4.x | Foundation for RC1 |

**RC1 pack:** [docs/releases/v1.0.0-rc1/](./docs/releases/v1.0.0-rc1/)  
**Staging validation:** [RC1_STAGING_VALIDATION.md](./docs/releases/v1.0.0-rc1/RC1_STAGING_VALIDATION.md)  
**Readiness:** [RC1_RELEASE_READINESS.md](./docs/releases/v1.0.0-rc1/RC1_RELEASE_READINESS.md) — **Ready for Pilot**, not production.

---

## 6. Future modules (placement on roadmap)

| Module | Roadmap home | Notes |
|--------|--------------|-------|
| Coffee Marketplace | Phases 1–4 | Current focus |
| **Nahu Farms** (multi-category) | **Phase 5 / v2.0** | Same core marketplace; config/catalog driven |
| Nahu Delivery (expanded) | Phase 7 (+ delivery already in RC1 for coffee) | Broader logistics productization |
| Notifications | Phase 4 (`v1.1`) | Beyond OTP |
| Live payments / real escrow | Phase 4 (`v1.1`) | Telebirr/Chapa/SantimPay etc. |
| AI & Smart Agriculture | Phase 8 | After data/ops mature |
| Nahu Wallet / Finance / Ecosystem | Phase 9 | After payments foundation |

Honey and other categories are **Nahu Farms (v2.0)** concerns, not Phase 1 side quests.

---

## 7. Development principles

1. **One milestone at a time** — finish and approve before the next.  
2. **No new features during validation** (RC/UAT windows).  
3. **Generic & reusable platform** — new crops share infrastructure.  
4. **Coffee is the reference implementation** for marketplace patterns.  
5. **Avoid duplicated business logic** across categories/apps.  
6. **SQL-first schema**; Nest API contract stability for mobile.  
7. **Maintenance before glory** — patch pilot/prod issues before Phase N+1.  
8. **Nest-only** for current mobile/admin integrations.  
9. Keep [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md) current.

---

## 8. Coding standards (summary)

| Topic | Standard |
|-------|----------|
| Monorepo | pnpm + Turborepo; `apps/api`, `apps/admin-web` |
| API | NestJS modules; DTO validation; `/api/v1` |
| Schema | Ordered manifest migrations (`database/migrations`); no ad-hoc prod DDL |
| Tests | Prefer rules/unit tests (`test:rules`) for domain; keep CI green |
| Admin | Next.js App Router; BFF proxies; reauth on sensitive mutations |
| Mobile | Expo in `nahu-buna-gebaya`; shared packages under `shared/` |
| Secrets | Never commit `.env`; staging/prod via host secrets |
| Scope | No drive-by refactors; no future-phase features in current-phase PRs |

Deeper guides: [docs/08-guides/](./docs/08-guides/) · CONTRIBUTING if present.

---

## 9. Decision log (major)

| Decision | Why | Where |
|----------|-----|-------|
| Nest replaces gebaya Express for platform API | Single backend; enterprise modularity | Platform migration / nest-only ops |
| SQL migrations as schema authority | Auditability; env parity | `database/migrations` + manifest |
| Coffee-first, then generalize | Prove money path before multi-category complexity | Strategic roadmap; evolution pack |
| Catalog + attributes (G2–G5) before activating non-coffee sell | Config-driven listings beat per-crop forks | `docs/09-platform-evolution/` |
| Payments stubbed in RC1 | Validate orchestration/escrow ledger without live PSP risk | RC1 freeze / BACKLOG Track A |
| Dynamic delivery fee OFF in RC1 | Needs real distance/routing | Feature flag `delivery.dynamic_fee.enabled` |
| Delivery D1–D12 inside coffee RC | Fulfilment is part of coffee money path | `docs/07-decisions/d*.md` |
| Admin MFA required | Workforce security | A1 admin foundation |
| Nahu Farms = v2.0 after coffee maturity | Same platform, many categories — only after production coffee is stable | Strategic roadmap Phase 5 |
| Maintenance releases outrank phase advance | Protect pilot/production trust | This master doc |

Add new rows when architecture/product direction changes; link the approving decision doc.

---

## 10. Agent / Cursor operating contract

When planning or implementing:

1. Read [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md) for **current phase**.  
2. Refuse or defer work that belongs to a **future** phase unless the user explicitly overrides for a critical fix.  
3. Prefer recommendations that advance **Phase 1 → Phase 2**, then stabilization, then `v1.1`, then **Nahu Farms v2.0**.  
4. After a phase completes, recommend the **next phase** and why it is the logical progression.  
5. Update the living roadmap when status changes.

Cursor rule: `.cursor/rules/nahu-roadmap.mdc`

---

## 11. Immediate focus (do this next)

**Phase 1:** Run controlled RC1 pilot UAT ([PILOT_GUIDE.md](./docs/releases/v1.0.0-rc1/PILOT_GUIDE.md)).  

Do **not** begin Telebirr, Honey, notifications, AI, or Nahu Farms implementation until Phase 1 is approved (and any required maintenance release is handled).
