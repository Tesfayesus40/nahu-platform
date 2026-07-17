# Commodity Generalization Architecture Review

**Status:** Direction approved 2026-07-17 — refined into G1 design  
**Date:** 2026-07-17  
**Audience:** Product + Engineering  
**Related:** `phase-3-product-catalog-design.md`, `g1-marketplace-contract-generalization.md`  
**Constraint:** Production unchanged until explicitly approved

---

## 1. Executive recommendation

Nahu Platform is **already partially commodity-agnostic** at the catalog and farm-operations layers. Coffee remains hard-wired in the **marketplace sell/buy contract** (listing columns, validation, certificates, Farmer listing UI, Buyer discovery UI).

**Before Buyer development, complete thin marketplace contract generalization (G1).**  
Do **not** migrate coffee enums off listings, redesign farms, or activate non-coffee sell-through yet.

### Approved refinements (2026-07-17)

1. **Commodity Extension Framework** — not a one-off “Coffee Extension”; Coffee is the first plugged-in family.  
2. **Generic quality / grade / certification** where possible; only truly coffee-specific attrs (process method, cup score, washing station, …) live in the Coffee extension.  
3. **Flexible units from G1** — `quantity`, `unitCode`, `pricePerUnit`, optional packaging.  
4. **Branding** — Nahu Farms umbrella; Nahu Buna Gebeya retained as coffee experience until broader cutover.

| Question | Answer |
|----------|--------|
| Minimum before Buyer? | G1 listing contract + extension framework shaping |
| Complete all generalization first? | **No** |
| Incremental during Buyer? | **Yes** |
| Activate cereals/livestock now? | **No** |

**Next document:** `g1-marketplace-contract-generalization.md` (awaiting approval to start SQL).

---

## 2. Current state (what already exists)

### Already generic (keep)

| Module | Why |
|--------|-----|
| `catalog.categories` | Sector gate; COFFEE active; cereals/pulses/… seeded inactive |
| `catalog.products` / varieties / units / translations | Product hub for inventory & planning |
| Farms, plots, parties, activities | Place & work — not commodity-specific |
| Cropping cycles, harvest sessions | Product-coded |
| Inventory lots / balances, warehouse sites | Product-coded |
| Orders, escrow, delivery addresses | Structurally listing-agnostic |
| Identity / auth | Role-based, not commodity |

### Still coffee-specific (must isolate)

| Surface | Evidence |
|---------|----------|
| Listing create DTO | Required `processMethod`, `grade`; `quantityKg` / `pricePerKg`; coffee altitude/cupScore ranges |
| `marketplace.listings` columns | Typed coffee enums + kg pricing |
| Certificates | Coffee grade/process/altitude fields and wording |
| Farmer `NewListingScreen` / `EditListingScreen` | Always renders coffee fields; local `COFFEE_ORIGINS` |
| Buyer browse/detail/home | Coffee filters, “Ethiopian Coffee”, kg-only cards |
| Advisory | Coffee pricing/advisory content |
| Branding | “Nahu Buna Gebeya” / coffee-first artwork |

Phase 3 already designed the long-term attribute model (`attribute_definitions` / `listing_attribute_values`) but deferred DDL. That design remains the north star.

---

## 3. Target conceptual model

```
Category (commodity family)     e.g. COFFEE, CEREALS, LIVESTOCK
    └── Product (saleable type) e.g. ETHIOPIAN_ARABICA_COFFEE, TEFF
            └── Variety (optional)
                    └── Listing (offer)
                            ├── Generic core: product, qty+unit, price/unit,
                            │   location, harvest/offer date, photos, farm/lot
                            └── Commodity attributes (coffee today; others later)
```

**Naming rule:** Prefer **Category / Product** (already in schema) over introducing a separate “Commodity” entity. “Commodity” in product language ≈ `catalog.categories`.

---

## 4. Module classification

### Generic platform modules (commodity-neutral)

- Identity & roles  
- Farms / Plots / Parties / Audit  
- Activities (types are operational, not coffee grades)  
- Cropping cycles & harvest sessions  
- Inventory & warehouse  
- Catalog (categories, products, units, varieties)  
- Listings **core** (who, what product, how much, where, photos, status)  
- Orders / escrow / payment hooks  
- Buyers (profile, addresses, order history)  
- Notifications / OTP  

### Commodity-specific extensions (Coffee first)

| Extension | Examples |
|-----------|----------|
| Coffee quality | Grade, process method, cup score, variety cultivar |
| Coffee provenance | Washing station, coffee cooperative (as coffee attrs) |
| Coffee altitude as quality signal | Listing altitude band for coffee (farm altitude stays generic) |
| Coffee certificates | Origin certificate fields & copy |
| Coffee advisory / ECX-style pricing | Advisory module |
| Coffee mobile UX | Origin chips, grade/process pickers |

**Future extensions (data + activation, not redesign):** cereals moisture/packing; livestock sex/age/weight; honey moisture; dairy fat % — via the same attribute system.

---

## 5. Minimum architecture changes before Buyer

### Goal of this slice

Make the **shared marketplace contract** product-first so Buyer can be built without baking coffee into search, cards, detail, checkout, and certificates forever — while coffee apps keep working.

### In scope (pre-Buyer / early Buyer foundation)

**A. Listing contract v2 (additive, backward compatible)**

1. Treat `productCode` / `categoryCode` as first-class (already optional with coffee default — keep default for legacy clients).  
2. Add additive unit-aware fields:
   - `quantity` + `unitCode` (nullable initially; backfill from `quantity_kg` + `KG`)
   - `pricePerUnit` (nullable; backfill from `price_per_kg`)
3. Keep `quantityKg` / `pricePerKg` readable/writable for coffee clients until Farmer/Buyer cut over.  
4. Make coffee fields **required only when category is COFFEE** (server-side validation by product/category), not globally required forever.  
5. Response shape always includes:
   - `productCode`, `categoryCode`, names, `defaultUnitCode`
   - `attributes[]` or explicit coffee block for coffee listings (dual-write later)

**B. Attribute foundation (thin)**

Option chosen for minimal disruption:

- **Short term:** Keep coffee typed columns; introduce API response grouping:
  - `core` vs `coffee` (or `attributes.coffee`)
- **Next approved phase:** Implement Phase 3 §3.6 attribute tables; dual-write coffee columns → attribute values; then optional non-coffee products.

Do **not** drop coffee enums before mobile cutover.

**C. Buyer prerequisites (API)**

- `GET /categories` (active) — already exists  
- `GET /products` — already exists  
- `GET /listings` filters: `categoryCode`, `productCode` — largely exists  
- Facet endpoint or documented filter metadata for coffee-only first (`grades`, `processMethods` when category=COFFEE)

**D. Branding decision (product, not DDL)**

| Layer | Recommendation |
|-------|----------------|
| Platform umbrella | **Nahu Farms** |
| Coffee marketplace experience | Keep **Nahu Buna Gebeya** as coffee brand / app display until cutover |
| Certificates / SMS | Move to generic “Nahu Farms” wording when Buyer cert UI is rebuilt; coffee-specific subtitle OK |

### Explicitly out of scope before Buyer

- Activating non-coffee categories for sell-through  
- Geography master data module  
- Moving farms/activities redesign  
- Full attribute DDL + migrating away from coffee enums  
- Livestock/dairy unit conversion engine  
- Renaming production Railway project / production deploy  

---

## 6. Migration strategy (minimal disruption)

### Principle

**Additive → dual-write → new clients → deprecate.** Never big-bang rewrite of listings.

```
Phase G0 (done)     Catalog spine + inactive sectors + product_id on listings
Phase G1 (next)     Listing contract generalization + coffee-conditional validation
Phase G2 (w/ Buyer) Buyer product-first UI; Farmer listing form coffee section
Phase G3 (later)    Attribute tables + dual-write; unit fields become primary
Phase G4 (later)    Activate next commodity (e.g. TEFF) end-to-end
Phase G5 (later)    Deprecate kg-only / coffee-required columns when unused
```

### Compatibility matrix

| Client | During G1–G2 | After G3 |
|--------|--------------|----------|
| Current Farmer APK | Still posts coffee fields + kg | Optional coffee attrs via form section |
| New Buyer | Reads product + unit fields; shows coffee attrs only if present | Same |
| Certificates | Coffee wording if coffee listing | Generic cert + coffee extras |

### Data migration

1. Backfill `unit_code = 'KG'`, `quantity = quantity_kg`, `price_per_unit = price_per_kg` for all rows.  
2. Ensure every listing has `product_id` / `category_id` (already backfilled for coffee).  
3. No production change until approved staging → production window.

---

## 7. Sequencing vs Buyer development

### Recommended sequence

```
1. Approve this architecture
2. G1 platform (SQL additive columns + Prisma + listing validation/service + docs + staging)
3. Start Buyer on G1 contract (browse by category/product; coffee facets for COFFEE)
4. Parallel: Farmer listing form = generic core + CoffeeAttributesSection
5. Certificates / branding polish as Buyer screens land
6. Defer attribute DDL and non-coffee activation until after Buyer coffee MVP is stable
```

### Why not “finish all generalization first”

- Farms/inventory are already product-aware — low Buyer risk.  
- Full attribute migration is weeks of dual-write + mobile risk with little Buyer MVP benefit.  
- Buyer needs a **stable contract**, not every future commodity schema.

### Why not “start Buyer with zero platform change”

- Buyer would hardcode coffee filters/cards/certs again — expensive to undo.  
- kg-only pricing blocks cereals (quintal), livestock (head), dairy (liter).

---

## 8. Roadmap: Nahu Buna Gebeya → Nahu Farms

| Horizon | Outcome |
|---------|---------|
| **Now** | Coffee is the only live sellable commodity; platform named/positioned as Nahu Farms internally |
| **Buyer MVP** | Buyer is a Nahu Farms buyer app that happens to sell coffee first; UI not titled as coffee-only forever |
| **Next commodity** | Activate one inactive category + product + attribute defs + Farmer form section + Buyer facets |
| **Brand cutover** | Farmer/Buyer launcher names → Nahu Farms (or keep coffee app name for farmer coffee SKU if product prefers dual brand) |
| **Mature** | Coffee columns become views/compat shims; attributes are source of truth |

Preserve: all existing coffee listings, orders, certificates, inventory lots, farm data.

---

## 9. Proposed approval checklist

Approve / amend:

- [ ] Category = commodity family; Product = saleable type (no new Commodity table)  
- [ ] G1 additive listing unit fields + coffee-conditional validation before Buyer UI hardening  
- [ ] Coffee grade/process/cup/washing station remain coffee extension (columns short-term)  
- [ ] Attribute DDL deferred to G3 after Buyer coffee MVP  
- [ ] Non-coffee sell-through deferred  
- [ ] Production untouched until explicit approval  
- [ ] Normal workflow after approval: Architecture → Review → Approval → SQL → Prisma → API → Tests → Docs → Staging → Mobile → APK → Validation → Commit → PR → Merge → Tag  

---

## 10. Open decisions for product

1. **Farmer app name:** keep “ናሁ ቡና ገበያ” for coffee farmers, or rebrand to Nahu Farms now?  
2. **Buyer app name:** Nahu Farms Buyer vs coffee-branded buyer?  
3. **First non-coffee category** after Buyer coffee MVP (recommendation: `CEREALS` / teff — high Ethiopia relevance, mass units).  
4. Persist listing geo as free text vs future geography FKs (recommend free text until geography module).
