# Phase 4 — Farmer Platform (Nahu Farm)

**Status:** Approved — architecture & roadmap accepted; detailed sub-phase designs required before implementation  
**Date:** 2026-07-14 (approved same day)  
**Product name:** Nahu Farm (Farmer Platform module within Nahu Platform)  
**Prerequisite:** Phase 1–3 baseline (Identity, Marketplace/Orders, Product Catalog) — staging validated; production promotion of Phase 3 still held for on-device checks  

**Authority alignment**

| Source | How Phase 4 uses it |
|--------|---------------------|
| Architecture Principles | Platform-first; Nahu Farm is a **module**, not a separate backend |
| `docs/README.md` phases | Phase 4 was labeled “Inventory”; this design **expands** Phase 4 into the Farmer Platform program with Inventory as the core stock capability |
| Phase 3 Product Catalog | **`catalog.products` remains the SKU hub** for stock, plans, and analytics |
| Mobile API v1 | Additive APIs; Expo Farmer app remains primary client; offline-friendly design |
| Phase 5 Nahu Delivery | Logistics against orders — out of Phase 4 build |

---

## 1. Why Phase 4 now

Phases 1–3 delivered: who the user is, what they can sell (coffee-first marketplace), and **what** the product is (`catalog.products`).

Farmers still lack a platform layer for:

- **Where** production happens (farms / plots)
- **How much** they hold (inventory)
- **Where** stock sits (warehouse / storage readiness)
- **What they plan** to produce (seasons / production plans)
- **How they see** performance (dashboards & analytics)

Without that layer, listings remain disconnected from real stock and planning, and Inventory alone would be a thin ledger without farm context.

**Phase 4 goal:** Introduce **Nahu Farm** — the farmer operations backbone — so marketplace listings, future delivery, certification, finance, and AI sit on verified farm + stock + plan data.

---

## 2. Business goals

1. Give each farmer a **digital farm record** (one or more farms) linked to their Identity + farmer profile.
2. Track **inventory of catalog products** (coffee first; multi-commodity-ready) with unit codes from `catalog.units`.
3. Support **storage locations** (on-farm store, cooperative warehouse, later 3PL) without redesign.
4. Enable **production planning** by season/crop cycle against Product (+ optional Variety).
5. Provide **farmer dashboards** (stock, listings, orders, plan vs actual) via API for mobile.
6. Preserve **full marketplace and Buyer app compatibility**; Farmer app gains APIs additively.
7. Keep a clean path to **Delivery, Pricing, Finance, Certification, AI Advisory**.

### Non-goals (Phase 4 program)

- Nahu Delivery / fleet / routing (Phase 5)
- Live payment webhooks / banking
- Full attribute EAV migration off coffee listing enums (separate track)
- Admin CMS / national MoA reporting portals (consume same APIs later)
- Replacing Expo with Flutter
- Production SMS / mobile production cutover (parallel operational track)

---

## 3. Positioning in the long-term architecture

```
Identity          →  who
Catalog           →  what (Product hub)          [Phase 3 ✓]
Marketplace       →  offer / order / escrow       [Phase 1–2 ✓]
Nahu Farm         →  farm / stock / store / plan / insights  [Phase 4]
Nahu Delivery     →  move order to buyer          [Phase 5]
Finance / Cert / AI →  consume farm + product + order facts
```

### Value-chain update (from Phase 3)

```
Farmer (Identity + farmer_profile)
    ↓
Farm / Plot                         ← Phase 4a
    ↓
Production Plan (season, product)   ← Phase 4d
    ↓
Inventory (product + qty + unit)    ← Phase 4b
    ↓
Warehouse / Storage location        ← Phase 4c (readiness)
    ↓
Listing (optional reserve from stock) ← extend marketplace
    ↓
Order → Escrow → Delivery → Certification → AI
```

**Invariant:** Stock and plans FK to **`catalog.products`** (and optionally `product_varieties`). Never treat Category as a stock SKU.

---

## 4. Domain model (proposed)

### 4.1 Schemas (SQL-first, modular)

| Schema | Owns |
|--------|------|
| `farms` | Farms, plots, farm membership / ownership |
| `inventory` | Stock lots, movements, reservations |
| `warehouse` | Storage sites, bins/zones (can start thin) |
| Existing `marketplace` | Listings/orders; **additive** FKs to inventory later |
| Existing `catalog` | Products, units, varieties — **read-only consumers** |

Avoid putting farm geometry and stock ledgers into `marketplace` — keep Marketplace = trade, Nahu Farm = operations.

### 4.2 Core entities

#### Farm (`farms.farms`)

- Owned by `marketplace.farmer_profiles` (or `identity.users` + role check)
- Fields (indicative): name, region/zone/woreda (text now; geography module later), approx size_ha, altitude, status (`ACTIVE`/`INACTIVE`), primary language notes
- One farmer may have **many farms**

#### Plot (`farms.plots`) — optional early

- Belongs to farm; area_ha; crop focus; soil/notes later
- Coffee: plots can map to washing-station context later without schema redesign

#### Storage site (`warehouse.storage_sites`)

- Types: `ON_FARM`, `COOPERATIVE`, `NAHU`, `THIRD_PARTY`
- Links: optional `farm_id`, optional `cooperative_id`
- Status lifecycle similar to products (`ACTIVE` / …)

#### Stock lot (`inventory.stock_lots`)

- `product_id` → `catalog.products` (**required**)
- Optional `product_variety_id`, `farm_id`, `storage_site_id`
- `quantity` + `unit_code` → `catalog.units`
- `status`: `AVAILABLE` | `RESERVED` | `QUARANTINE` | `DEPLETED`
- Quality snapshot later (or listing attributes phase)

#### Stock movement (`inventory.stock_movements`)

- Append-only ledger: `RECEIVE`, `ADJUST`, `RESERVE`, `RELEASE`, `DISPATCH`, `TRANSFER`, `LOSS`
- `qty`, `unit_code`, references lot, optional `listing_id` / `order_id`
- Source of truth for analytics (never edit history; correct with reversing movement)

#### Reservation (`inventory.reservations`) — when listings bind to stock

- Links `listing_id` ↔ `stock_lot_id` + qty
- Created when listing goes live (optional mode); released/consumed on cancel/sale

#### Production plan (`farms.production_plans` + `plan_lines`)

- Season / year / window (`season_code`, start/end dates)
- Line: `product_id`, optional variety, planned_qty, unit, farm/plot
- Later: actual harvest movements auto-compare to plan

#### Dashboard / analytics

- Prefer **query APIs + SQL views / materialized summaries** in Phase 4e
- Optional later: `analytics.events` or warehouse sync — not required for MVP dashboards

### 4.3 Relationship to existing tables

| Existing | Relationship |
|----------|--------------|
| `identity.users` | Authn; FARMER role |
| `marketplace.farmer_profiles` | Farmer business profile; owns farms |
| `marketplace.listings` | May later set `stock_lot_id` / reservation (additive, nullable) |
| `orders.orders` | Consume reservation on pay/complete (later) |
| `catalog.products` / `units` | Stock & plan SKU and UoM |

**Farmer profile stays.** Do not rename farmer → seller in Phase 4.

---

## 5. Capability roadmap (sub-phases)

Phase 4 is a **program**. Ship in slices; each slice: design approve → SQL → Prisma → API → tests → docs → staging smoke.

| Sub-phase | Name | Outcome | Effort |
|-----------|------|---------|--------|
| **4.0** | Foundations | Schemas `farms` / `inventory` / `warehouse` stubs; module boundaries; farmer ownership rules | S |
| **4.1** | Farm management | CRUD farms (+ optional plots); list “my farms” | M |
| **4.2** | Inventory core | Stock lots + movements; coffee product; balance APIs | **Closed** (staging + Farmer APK) |
| **4.3** | Warehouse readiness | Storage sites; assign lots to sites; coop site type | Design draft — [phase-4.3-warehouse-design.md](phase-4.3-warehouse-design.md) |
| **4.4** | Listing ↔ stock (optional bind) | Nullable reservation; create listing can deduct/reserve | M |
| **4.5** | Production planning | Seasons + plan lines; plan vs actual (from movements) — [**Closed** on staging + M10](phase-4.5-production-planning-design.md) | M |
| **4.6** | Dashboards & analytics | Farmer home summary API; stock & sales & plan KPIs — [**Closed** on staging + M11](phase-4.6-dashboards-design.md) | M |
| **4.7** | Harvest management | Field harvest sessions → inventory RECEIVE — [**Closed** on staging + M12](phase-4.7-harvest-management-design.md) | M |

**Recommended first implementation after this doc is approved:** **4.0 + 4.1** (farms) **then 4.2** (inventory). Warehouse and planning build on stock. Dashboards last so they read real data.

### 5.1 Farm management (4.1) — detail

**Farmer can:** register farm(s), edit location/size, deactivate farm, list farms.

**API sketch:**

- `GET /api/v1/farms/mine`
- `POST /api/v1/farms`
- `GET /api/v1/farms/:id`
- `PATCH /api/v1/farms/:id`

Mobile: additive screens in Farmer app later; API-first now.

### 5.2 Inventory (4.2) — detail

**Farmer can:** receive stock (harvest), adjust, view balances by product/farm/site.

**API sketch:**

- `GET /api/v1/inventory/balances?farmId=&productCode=`
- `POST /api/v1/inventory/movements` (typed commands)
- `GET /api/v1/inventory/lots`
- `GET /api/v1/inventory/lots/:id`

Rules:

- Quantities always with `unit_code` consistent with product `default_unit_code` unless conversion table exists (none in 4.2)
- Coffee first; other products allowed in data when category/product active

### 5.3 Warehouse readiness (4.3) — detail

Not full WMS. **Readiness** means:

- Named storage sites
- Capacity optional
- Lot location
- Ready for coop warehouse actors later

Defer: bin-level picking, barcode, cold-chain sensors.

### 5.4 Production planning (4.5) — detail

- Annual/seasonal plan per farm
- Lines reference `product_id`
- Actuals = sum of `RECEIVE` movements in window
- Feeds AI advisory (“plan vs weather”) later

### 5.5 Dashboards & analytics (4.6) — detail

**Farmer dashboard API** (single mobile-friendly payload), e.g.:

- Farms count / active
- Stock by product (top N)
- Active listings / reserved qty
- Open orders (as seller)
- Plan attainment % this season

Principle: dashboards are **read models** over Farm + Inventory + Marketplace — no duplicate transactional stores.

Reporting for MoA / exporters later uses same events, different auth.

---

## 6. API & module layout (NestJS)

```
apps/api/src/
  farms/          # Farm + plots + production plans (or split plans later)
  inventory/      # Lots, movements, balances, reservations
  warehouse/      # Storage sites (thin)
  marketplace/    # Existing; additive listing↔stock
  catalog/        # Existing; Product hub
```

- Controllers thin; SQL migrations under `database/migrations/farms|inventory|warehouse/`
- Prisma maps new schemas; keep `multiSchema`
- Auth: `JwtAuthGuard` + `RolesGuard` `FARMER` (and later COOP_ADMIN)
- Errors: `{ error: "..." }`

### Mobile compatibility

| Client | Phase 4 impact |
|--------|----------------|
| Farmer Expo | New endpoints optional; existing listing/order flows unchanged until 4.4 enabled |
| Buyer Expo | No break; may see richer availability later |
| Staging hold | Production promotion of Phase 3/4 remains a separate release decision |

---

## 7. Data & analytics principles

1. **Append-only movements** for inventory truth.
2. **Product hub** for all stock/plan lines.
3. **Canonical codes** + en/am (+ translations pattern from Phase 3 for farm type labels if needed).
4. **Offline-friendly:** mobile may queue movements; server validates and assigns ids (design sync contracts in 4.2).
5. **AI-ready:** farm_id, product_id, region, season, qty on every movement for advisory grounding.
6. **Security:** farmer A cannot read farmer B’s farms/stock; audit sensitive adjusts.

---

## 8. Risks & open decisions

| Topic | Options | Recommendation |
|-------|---------|----------------|
| Expand README “Phase 4 = Inventory” | Rename to Farmer Platform / keep Inventory as 4.2 | **Expand** label; Inventory remains central deliverable |
| Listings must always bind stock | Hard require vs optional | **Optional** in 4.4 (flag); coffee MVP can stay offer-first |
| Farm vs profile `farm_size_ha` | Dedupe vs keep both | Profile = summary; farms = detail source of truth over time |
| Coop warehouse ownership | Farmer-only sites first | Start ON_FARM; coop sites in 4.3 |
| Geography FKs | Free text vs geography module | Free text + codes later (same as listings) |
| Analytics warehouse | In-DB views vs external | In-DB APIs first (4.6) |

---

## 9. Success criteria (program)

- Farmer can manage ≥1 farm via API and see it in Farmer app (when UI shipped).
- Coffee stock can be received and balanced against `ETHIOPIAN_ARABICA_COFFEE`.
- Storage site can hold a lot (warehouse readiness).
- Seasonal plan can be created and compared to receipts.
- Dashboard API returns consistent KPIs without breaking Buyer browse.
- Marketplace create listing without farm/stock fields still works (compat).

---

## 10. Suggested approval path

1. **Approve this architecture & roadmap** (no code).
2. Update `docs/README.md` phase table: Phase 4 → Farmer Platform (Nahu Farm); note Inventory + warehouse + planning + dashboards as sub-phases; Phase 5 remains Delivery.
3. Detailed design + DDL for **4.0/4.1 only** (Farms schema) — second decision doc or appendix — then implement.
4. Continue 4.2 → 4.6 in order, staging smoke each slice.

### Approval checklist

- [x] Nahu Farm as Phase 4 program accepted  
- [x] Schema split (`farms` / `inventory` / `warehouse`) accepted  
- [x] Product-as-hub invariant accepted  
- [x] Sub-phase order 4.0→4.6 accepted  
- [x] Listing↔stock binding remains optional initially  
- [x] Ready for detailed **4.1 Farm management** design (SQL-level) before coding  

**Approver:** Product owner **Date:** 2026-07-14

---

## 11. Relation to paused work

| Track | Status |
|-------|--------|
| Phase 3 staging | Deployed + API smoke pass; **on-device app check** pending before commit/prod |
| Phase 4 | **Design only** — does not require Phase 3 production promotion to design; implementation can start on staging after Phase 3 is committed |
| Production | Unchanged until Phase 3 validation + separate Phase 4 release plans |

---

*This document is the Phase 4 entry point. It does not authorize DDL or Nest modules until the checklist is signed and the first sub-phase design is approved.*
