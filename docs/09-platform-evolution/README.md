# NAHU Platform Evolution

**Status:** Marketplace Engine G2–G10 complete · Production Readiness **accepted** · **RC1 (`v1.0.0-rc1`) prepared**  
**Date:** 2026-07-29  
**Audience:** Product, engineering leads, future module owners  
**Constraint:** Preserve RC1 coffee marketplace, Delivery, and Revenue Engine; evolve incrementally

This folder is the **strategic north star** for evolving Nahu Buna Gebeya into the **NAHU Platform**. Coffee is Version 1 of a category-driven marketplace on a reusable **Marketplace Engine**.

---

## Reading order

| # | Document | Purpose |
|---|----------|---------|
| 1 | [01 — Vision](./01-nahu-platform-vision.md) | Platform map, brands, module boundaries |
| 2 | [02 — Coffee → Multi-Agriculture Strategy](./02-coffee-to-multi-agriculture-strategy.md) | Reuse / generalize / coffee-only / configurable |
| 3 | [03 — Domain Model Refactoring](./03-domain-model-refactoring.md) | Vertical → Category → Product → Listing |
| 4 | [04 — Marketplace Generalization](./04-marketplace-generalization.md) | Goods / supplies / services + packs |
| 5 | [05 — Database Evolution](./05-database-evolution.md) | Schema path to G3 attributes |
| 6 | [06 — API Evolution](./06-api-evolution.md) | Contracts, versioning, non-breaking rules |
| 7 | [07 — Mobile Evolution](./07-mobile-evolution.md) | Buyer / Farmer / Courier apps |
| 8 | [08 — Admin Portal Evolution](./08-admin-evolution.md) | Catalog, attributes, moderation |
| 9 | [09 — Migration & Compatibility](./09-migration-and-compatibility.md) | How to migrate without breaking RC1 |
| 10 | [10 — Implementation Roadmap](./10-implementation-roadmap.md) | Phased G2→G5 + Payments / Finance / AI |
| 11 | [11 — Architecture Review](./11-architecture-review.md) | Independent design review |
| 12 | [12 — Design Validation](./12-design-validation.md) | Pass/fail; D1–D7 **resolved** |
| 13 | [13 — Implementation Readiness](./13-implementation-readiness.md) | Go/No-Go; **G2 approved** |
| 14 | [14 — Marketplace Engine Design](./14-marketplace-engine-design.md) | Reusable engine constitution + readiness |
| 15 | [15 — D1 Marketplace Vertical](./15-d1-marketplace-vertical.md) | Vertical owns categories |
| 16 | [16 — D2 Seller Party](./16-d2-seller-party.md) | Generic seller; Farmer specialization |
| 17 | [17 — D3 Terminology Guide](./17-d3-terminology-guide.md) | Neutral vocabulary |
| 18 | [18 — D4 Attribute Strategy](./18-d4-attribute-extension-strategy.md) | Config attrs + extension sunset |
| 19 | [19 — D5 Form Schema Spec](./19-d5-form-schema-specification.md) | `nahu.form.v1` contract |
| 20 | [20 — D6 Tax & Regulatory](./20-d6-tax-regulatory-model.md) | Compliance architecture |
| 21 | [21 — D7 Module Boundaries](./21-d7-platform-module-boundaries.md) | Ownership + farms-optional |
| 23 | [23 — G2 Admin Catalog Implementation](./23-g2-admin-catalog-implementation.md) | G2 deliverable notes (migrations, API, Admin, tests) |
| 24 | [24 — G2.5 Workflow Validation](./24-g2.5-workflow-validation.md) | End-to-end buyer/farmer/courier/admin workflows |
| 25 | [25 — G2.5 Platform Review](./25-g2.5-platform-review.md) | Architecture, security, performance, debt |
| 26 | [26 — G3 Readiness](./26-g3-readiness.md) | Go/No-Go · freeze · first G3 task |
| 27 | [27 — G3 Attribute Foundation](./27-g3-attribute-foundation.md) | G3 implementation summary |
| 28 | [28 — G3 Migration Strategy](./28-g3-migration-strategy.md) | Dual-write / backfill / rollback |
| 29 | [29 — G3 API Contract](./29-g3-api-contract.md) | Additive attributes[] APIs |
| 30 | [30 — G4 Schema-Driven Listing](./30-g4-schema-driven-listing-foundation.md) | Presentation metadata, listing schema & search-metadata APIs |
| 31 | [31 — G5 Dynamic Listing Consumption](./31-g5-dynamic-listing-consumption.md) | Farmer schema-driven create/edit/details/filters |
| 32 | [32 — G6 Dynamic Buyer Marketplace](./32-g6-dynamic-buyer-marketplace.md) | Buyer browse/details/filters from presentation metadata |
| 33 | [33 — G7 Seller Party Foundation](./33-g7-seller-party-foundation.md) | Generic seller parties; farmer dual-write bridge |
| 34 | [34 — G8 Fulfilment Orchestration](./34-g8-fulfilment-orchestration.md) | Order lifecycle FSM, assignment timeout/reassign, dual confirm + settle |
| 35 | [35 — G9 Payment & Settlement](./35-g9-payment-settlement-orchestration.md) | Payment FSM, escrow, Revenue Engine settlement, refunds, provider stubs |
| 36 | [36 — G10 Operations & Administration](./36-g10-operations-administration.md) | Ops dashboard, order inspection, sellers, courier/payment ops, health |
| 37 | [37 — Production Readiness](./37-production-readiness.md) | Pilot backlog: CI, health, smoke, hardening (no new features) |

---

## Review & delta outcome (2026-07-28)

1. Architecture review: **conditional pass** accepted.  
2. Binding deltas **D1–D7:** design-locked in docs 15–21.  
3. Marketplace Engine: **stable enough to begin G2**.  
4. **G2** Admin Catalog Foundation: **implemented** ([23](./23-g2-admin-catalog-implementation.md)).  
5. **G2.5** stabilization: **pass** ([24](./24-g2.5-workflow-validation.md), [25](./25-g2.5-platform-review.md)).  
6. **G3** Dynamic Attributes: **implemented foundation** ([27](./27-g3-attribute-foundation.md)–[29](./29-g3-api-contract.md)).  
7. **G4** Schema-driven listing foundation: **implemented** ([30](./30-g4-schema-driven-listing-foundation.md)).  
8. **G5** Farmer dynamic listing consumption: **implemented** ([31](./31-g5-dynamic-listing-consumption.md)).  
9. **G6** Buyer dynamic marketplace: **implemented** ([32](./32-g6-dynamic-buyer-marketplace.md)).  
10. **G7** Seller Party foundation: **implemented** ([33](./33-g7-seller-party-foundation.md)).
11. **G8** Fulfilment & delivery orchestration: **implemented** ([34](./34-g8-fulfilment-orchestration.md)).
12. **G9** Payment & settlement orchestration: **implemented** ([35](./35-g9-payment-settlement-orchestration.md)).
13. **G10** Operations & administration: **implemented** ([36](./36-g10-operations-administration.md)).
14. **Production Readiness** (pilot): **accepted** ([37](./37-production-readiness.md)).
15. **RC1 release candidate:** [v1.0.0-rc1](../releases/v1.0.0-rc1/README.md) — freeze, deploy, checklist, pilot verification, Tracks A–C deferred.

---

## Relationship to prior decisions

| Prior doc | Role vs this pack |
|-----------|-------------------|
| [Commodity generalization review](../07-decisions/commodity-generalization-architecture-review.md) | Direction approved 2026-07-17 — this pack **extends** it to full platform vision |
| [G1 marketplace contract](../07-decisions/g1-marketplace-contract-generalization.md) | **Implemented** — extension framework + flexible units; keep as current contract |
| [Phase 3 product catalog](../07-decisions/phase-3-product-catalog-design.md) | Attribute tables designed; **G3** still the implementation path |
| [Nahu Farm V1 overview](../02-architecture/nahu-farm-v1-architecture-overview.md) | Farm ops = optional agri capability under Farms module |
| [Revenue Engine TDD](../08-guides/revenue-engine-tdd.md) | Platform commercial foundation — category-agnostic |
| [RC1 Revenue Engine release](../releases/RC1-Revenue-Engine.md) | Freeze gates for money path during evolution |
| [RC1 Readiness Report](../releases/RC1-Readiness-Report.md) | Stabilisation before category expansion |

---

## Locked defaults (this pack)

1. **Packaging:** multi-doc pack + this index.  
2. **First non-coffee sell-through:** **Cereals / Teff** illustrative only.  
3. **Branding:** **NAHU Platform** → **Nahu Farms** (Agriculture vertical experience) → **Nahu Buna Gebeya** (coffee).  
4. **Path:** G2 catalog/verticals → G3 attributes → G4 form schemas → activate by config.  
5. **Constitution:** [14 — Marketplace Engine Design](./14-marketplace-engine-design.md).

---

## Explicit non-goals (current waves)

- No G3 attribute implementation in G2.5 (design + seed + review only beyond G2)  
- No activating non-coffee / non-agri sell-through  
- No live Telebirr/CBE/Chapa money movement  
- No SellerParty / tax engine / schema-driven forms yet
