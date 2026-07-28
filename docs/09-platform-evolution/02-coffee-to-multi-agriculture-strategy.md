# 02 — Platform Evolution Strategy (Coffee → Multi-Agriculture)

**Status:** Planning only  
**Date:** 2026-07-28  
**Parent:** [Platform Evolution index](./README.md)  
**Builds on:** [Commodity generalization review](../07-decisions/commodity-generalization-architecture-review.md), [G1](../07-decisions/g1-marketplace-contract-generalization.md)

---

## 1. Strategy in one paragraph

Keep the **platform spine** (identity, catalog, farms, orders, escrow, pricing, delivery, admin). Isolate coffee into an **extension + experience brand**. Generalize the **marketplace contract** and **Admin/mobile form engines** so new categories are activated by **data and configuration**, not by cloning applications. Ship incrementally with **dual-write, feature flags, and RC1 coffee freeze** so existing buyers/farmers/couriers never break.

---

## 2. Classification matrix

### 2.1 Reuse as-is (foundation)

| Area | Why reusable |
|------|----------------|
| Identity / roles / sessions | Actor-based, not commodity |
| `catalog.categories` / products / varieties / units | Already multi-sector seeded |
| Farms, plots, cropping, harvest, inventory, warehouse | Product FKs; production-unit kinds already multi-ag |
| Orders status machine + escrow | Listing-agnostic money hold |
| Revenue Engine schedules & snapshots | Fees on goods/delivery, not coffee fields |
| Delivery shipments, POD, settlement | Logistics; weight/vehicle inputs |
| Admin moderation workflow | Status/decision model is generic |
| G1 unit columns + `extensions.coffee` shaping | First extension plug-in |

### 2.2 Must generalize

| Area | Today’s coffee bias | Target |
|------|---------------------|--------|
| Listing DDL | `process_method`, `grade` NOT NULL coffee enums; kg columns required | Core nullable coffee cols; attributes/extension required by category rules |
| Create/update DTOs | Always require coffee fields | Validate by `categoryCode` |
| Search / facets | Grade, process, kg filters | Facet config per category |
| Certificates | Required grade + process | Template per category; coffee template first |
| Farmer listing UX | Always coffee form | Schema-driven form from catalog |
| Buyer home/browse | Coffee copy and filters | Category hub + coffee default skin |
| Admin listing detail | Coffee-first display | Dynamic attribute panels |
| Advisory | Coffee/ECX-oriented | Pluggable advisory packs |

### 2.3 Remain coffee-specific

| Concept | Home |
|---------|------|
| Process method (washed/natural/honey/…) | Coffee extension |
| Cup score | Coffee extension |
| Washing station | Coffee extension |
| Coffee grade codes (GRADE_1…9) | Coffee quality vocabulary |
| Origin altitude as cup-quality signal | Coffee extension (farm altitude stays generic) |
| Nahu Buna Gebeya brand, icons, coffee marketing | Experience layer |
| Coffee origin certificate template fields/copy | Certificate template `COFFEE_ORIGIN` |

### 2.4 Become configurable

| Knob | Mechanism |
|------|-----------|
| Which categories sell | `categories.is_active` + product seeds |
| Required listing fields | Attribute definitions / validation rules by category |
| Grade vocabularies | Quality standard sets scoped by category |
| Units allowed | Product `default_unit_code` + unit dimension rules |
| Search facets | Admin-configured facet descriptors |
| Listing form layout | Mobile form schema from API |
| Certificate fields | Certificate templates |
| Listing kind | `PRODUCE` / `INPUT` / `SERVICE` on category or product |
| Regulatory gates | Flags on category (e.g. vet products) |

---

## 3. Evolution principles

1. **Configuration over forks** — one Buyer, one Farmer, one Courier codebase.  
2. **Coffee is a plugin** — first and best-supported extension, not the schema default forever.  
3. **Expand catalog before UX** — do not activate a category in UI until products, units, attributes, and validation exist.  
4. **Money and logistics stay dumb to commodity** — no coffee enums in pricing or shipment core.  
5. **Dual-write until proven** — kg ↔ unit; coffee columns ↔ attribute values.  
6. **Flags for activation** — e.g. `marketplace.category.<CODE>.sell_enabled`.  
7. **Illustrative next vertical = Cereals/Teff** — similar weight trade; does not lock launch order.

---

## 4. Risks and trade-offs

| Risk | Trade-off | Mitigation |
|------|-----------|------------|
| Premature category activation | Broken listings / empty facets | Seed + Admin checklist before `is_active` |
| Over-abstracting too early | Slow coffee RC1 | Finish RC1 stabilisation; G3 after G2 tooling |
| EAV attribute soup | Hard queries/reporting | Typed attribute defs; indexed JSON only as bridge |
| Livestock / chemicals regulation | Legal exposure | Category regulatory flags; delayed activation |
| Service listings need scheduling | Different UX | Separate listing kind; share escrow later |
| Brand confusion | Two names in market | Clear hierarchy: Platform / Farms / Buna Gebeya |
| Mobile rewrite temptation | Cost / regression | Schema-driven forms inside existing apps |

---

## 5. What “done” looks like for multi-ag V1

- A non-coffee category can be sold end-to-end with **no coffee-required columns** on new listings.  
- Coffee listings still validate and display exactly as today for Buna Gebeya clients.  
- Admin can activate a category and edit attribute definitions without a deploy of hard-coded enums.  
- Delivery and Revenue Engine need **zero commodity-specific releases** for that launch.
