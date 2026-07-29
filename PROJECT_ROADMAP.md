# Nahu Platform — Project Roadmap (Living)

**Status:** Official strategic direction  
**Last updated:** 2026-07-29  
**Current phase:** **Phase 1 – RC1 Pilot & UAT**  
**Master source of truth:** [NAHU_MASTER_ROADMAP.md](./NAHU_MASTER_ROADMAP.md)

This file is the **living operational roadmap**. Update it when a phase completes, when a maintenance release is cut, or when progress status changes. Do **not** start work from a future phase until the current phase is completed **and approved**.

---

## Guiding vision

Build and validate the **Coffee Marketplace** first, then evolve the same platform into **Nahu Farms** — a configurable multi-product agricultural marketplace — without duplicating marketplace infrastructure.

---

## How to use this document

| Audience | Use |
|----------|-----|
| Humans | Milestone planning, Go/No-Go, sequencing |
| Cursor / agents | Default planning authority unless a **critical** production/pilot issue requires maintenance first |
| Engineers | Do not implement Phase N+1 features during Phase N |

**Priority override:** Pilot feedback or production defects that need a maintenance release (e.g. `v1.0.1`) take priority over advancing to the next major milestone.

---

## Phase status board

| Phase | Milestone | Status |
|-------|-----------|--------|
| **0** | Foundation | **Completed** |
| **1** | RC1 Pilot & UAT | **Current — in progress** |
| **2** | Coffee Marketplace Production `v1.0.0` | Not started (blocked on Phase 1 approval) |
| **3** | Stabilization `v1.0.x` | Not started |
| **4** | Coffee Enhancement `v1.1` | Not started |
| **5** | **Nahu Farms `v2.0`** | Not started — next *major product* milestone after coffee maturity |
| **6** | Enterprise Agriculture | Future |
| **7** | Nahu Delivery (expanded) | Future |
| **8** | AI & Smart Agriculture | Future |
| **9** | Nahu Ecosystem | Future |

---

## Phase 0 – Foundation (Completed)

Architecture, Identity, Marketplace, Orders, Payments (stub), Fulfilment, Courier, Admin, Operations, CI/CD, Staging, RC1 tag, staging validation.

Evidence: [docs/releases/v1.0.0-rc1/](./docs/releases/v1.0.0-rc1/) · [RC1_STAGING_VALIDATION.md](./docs/releases/v1.0.0-rc1/RC1_STAGING_VALIDATION.md)

---

## Phase 1 – RC1 Pilot & UAT (Current)

**Goal:** Complete RC1 UAT and prepare the Coffee Marketplace for a stable production release decision.

| Workstream | Status |
|------------|--------|
| UAT documents | Done (local/release pack) |
| Pilot guide + APK distribution | Done |
| Bug reporting template | Done |
| Release readiness | Done — **Ready for Pilot** |
| Staging secured for pilot | Done |
| **Pilot execution** | **Pending** |
| Go / No-Go (from UAT) | Pending |

**Rules for Phase 1**

- No new product features  
- No Telebirr live rails, Honey vertical, notifications platform, or AI  
- Maintenance / S1 fixes from pilot only if approved  

**Exit criteria:** UAT sign-off per [UAT_CHECKLIST.md](./docs/releases/v1.0.0-rc1/UAT_CHECKLIST.md); update this board and recommend Phase 2 (or a `v1.0.0-rc1.x` / `v1.0.1` maintenance path if required).

**Materials:** [PILOT_GUIDE.md](./docs/releases/v1.0.0-rc1/PILOT_GUIDE.md) · [RC1_RELEASE_READINESS.md](./docs/releases/v1.0.0-rc1/RC1_RELEASE_READINESS.md)

---

## Phase 2 – Coffee Marketplace Production (`v1.0.0`)

Only after Phase 1 approval.

- Production deployment  
- Monitoring, backups, security hardening  
- Publish apps (as approved)  
- Release notes + operations documentation  

---

## Phase 3 – Stabilization (`v1.0.x`)

Maintenance only: bug fixes, UX polish, performance, security patches. Prefer `v1.0.1+` before Phase 4 if pilot/production issues demand it.

---

## Phase 4 – Coffee Marketplace Enhancement (`v1.1`)

- Live payments (Telebirr / Chapa / SantimPay, etc.)  
- Real escrow provider flows  
- Notifications  
- Better search, ratings, analytics  
- Courier improvements  

---

## Phase 5 – Nahu Farms (`v2.0`)

**Next major product milestone after coffee marketplace maturity.**

Evolve the Coffee Marketplace into a **configurable agricultural marketplace** on the **same core platform**:

Coffee, Honey, Cereals, Pulses, Oilseeds, Fruits, Vegetables, Dairy, Poultry, Livestock, Fish, Flowers, Seeds, Fertilizer, Machinery, and others.

Principles: generic catalog/attributes/listings; coffee remains the reference implementation; avoid duplicated business logic per crop.

Related design history: [docs/09-platform-evolution/](./docs/09-platform-evolution/)

---

## Phases 6–9 (Future — do not start early)

| Phase | Theme |
|-------|--------|
| 6 | Enterprise Agriculture |
| 7 | Nahu Delivery (expanded logistics product) |
| 8 | AI & Smart Agriculture |
| 9 | Nahu Ecosystem (Wallet / Finance / broader portfolio) |

---

## Development principles (roadmap)

1. Finish one milestone before the next.  
2. No new features during validation.  
3. Keep the platform generic and reusable.  
4. Coffee is the reference implementation.  
5. Avoid duplicated business logic.  
6. Keep this file accurate as a living roadmap.  
7. Critical pilot/production fixes beat forward feature work.

---

## Next recommended action (as of last update)

**Execute Phase 1 pilot UAT** using the RC1 pilot pack.  
Do **not** begin Phase 2 production cutover or Phase 4/5 product work until Phase 1 is approved.

When Phase 1 completes, the logical next phase is **Phase 2 – Coffee Marketplace Production (`v1.0.0`)**, unless UAT requires a maintenance RC first.
