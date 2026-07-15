# Phase 4.5 — Production Planning Architecture

**Status:** **Closed** — implemented on staging + Farmer M10 (incl. Amharic); production held  
**Date:** 2026-07-15 (approved, implemented, and closed same day; v1.1)  
**Version:** 1.1  
**Parent:** [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (Approved)  
**Depends on:** Phase 3 Catalog · Phase 4.1 Farms · Phase 4.2 Inventory · Phase 4.3 Warehouse · Phase 4.4 Listing ↔ Stock (**closed / approved on staging**)  
**Next:** Phase 4.6 Dashboards (design review only until explicitly authorized)

**Implementation gate:** **Closed on staging** — SQL → Prisma → API → Tests → Docs → Staging smoke → Farmer M10 on-device. Production promotion remains explicit.

**Production:** Remains unchanged until a future production promotion is explicitly approved.

**v1.1 review refinements (approved):** production lifecycle statuses; multiple harvest events per plan; configurable season codes (not a fixed BELG/MEHER-only enum); inputs / weather / farm activity ops remain out of scope.

**Naming note:** Phase 4 parent sketched `farms.production_plans` / `plan_lines`. Phase 4.1 reserved **`farms.cropping_cycles` / `cropping_cycle_lines`**. This design adopts the 4.1 names as the canonical SQL entities. “Production planning” is the product capability; a **cropping cycle** is the persisted plan window.

---

## 0. Purpose and review goals

Define **production planning** for Nahu Farm: multi-season, multi-year **cropping cycles** with planned product lines and **computed actuals** from inventory, without redesigning Farms, Catalog, Inventory, Warehouse, or Listing ↔ Stock.

This review package is intended so product/engineering can verify:

1. Season vs cropping-cycle model (multiple seasons, multi-year history)  
2. Planned vs actual production truth (what is stored vs computed)  
3. Relationship among Farm / Plot / Field / Production unit / Product / Inventory  
4. Integration with Warehouse and Listing ↔ Stock (and what deliberately does *not* couple)  
5. Multi-commodity readiness (coffee-first, all catalog products later)  
6. AI forecasting / analytics hooks without a separate plan warehouse  
7. Backward compatibility with existing APIs and Farmer flows  
8. Extensibility so Phase 4.6 dashboards and future advisory need no redesign  

---

## 1. Business objectives and scope

### 1.1 Objectives

1. Let a farmer **plan production** for a season/window on a farm (optionally scoped to plot / field / production unit).  
2. Support **many cycles per farm over years** — stable multi-year production history.  
3. Support **multiple seasons in the same calendar year** (e.g. Belg + Meher) and **multiple products in one cycle**.  
4. Compare **planned qty** vs **actual harvest** (inventory `RECEIVE`) for each product line.  
5. Stay **coffee-first, multi-commodity-ready** via `catalog.products` (+ optional variety).  
6. Remain additive to `/api/v1` and Expo Farmer; **no Buyer changes** in 4.5.  
7. Leave clean hooks for **dashboards (4.6)**, **AI advisory / forecasting**, certification, and MoA-style reporting later.

### 1.2 In scope (build after approval)

| Area | Proposal |
|------|----------|
| Schema | Tables in existing PostgreSQL schema **`farms`** (no new top-level schema) |
| Entities | `season_codes` (configurable), `cropping_cycles`, `cropping_cycle_lines` (+ cycle status enum) |
| Inventory bridge | Optional nullable `cropping_cycle_id` (and optional `cycle_line_id`) on `inventory.stock_lots` at receive |
| Actuals | Read model: sum of **one or more** RECEIVE harvest events attributed to a cycle line |
| Auth | Same farm-party write rules as Farms / Inventory |
| API | Cycle CRUD, lines, plan-vs-actual summary |
| Mobile (M10) | Additive Farmer “Seasons / Plans” UI after staging API smoke |

### 1.3 Out of scope

| Deferred | When |
|----------|------|
| Auto-generated plans from weather / AI models | Separate future phase (advisory) |
| Farm inputs (seed, fertilizer, labour cost) | Separate future phase |
| Weather integration | Separate future phase |
| Field-task / operational activity logging | Separate future phase |
| Materialized analytics warehouse / ETL | 4.6+ if needed |
| Requiring every RECEIVE to bind a cycle | Soft attribution remains valid |
| Binding listing create to a cycle (required) | Optional later; not 4.5 default |
| Changing Buyer app contracts | Not in 4.5 |
| Dashboards home KPI payload | **4.6** (consumes this data) |
| Live payments / production Nest cutover | Explicit gates |
| Hard-delete of historical cycles | Never — archive only |

---

## 2. Domain separation (invariants)

```
catalog.products          →  WHAT is planned / harvested / sold
farms.farms / plots / …   →  WHERE production is planned
farms.cropping_cycles     →  WHEN / which season window (plan header)
farms.cropping_cycle_lines→  HOW MUCH is planned (per product)
inventory.stock_lots      →  physical stock from harvest (actuals source)
warehouse.storage_sites   →  WHERE stock is held after receive (unchanged)
marketplace.listings      →  WHAT is offered (may bind stock via 4.4)
inventory.reservations    →  soft hold listing ↔ lot (unchanged by 4.5)
```

**Rules**

| Rule | Meaning |
|------|---------|
| Plan ≠ Stock | Creating/editing a cycle never mutates `quantity_on_hand` or reservations |
| Plan ≠ Listing | Cycles do not create listings; harvest → lot → optional sell-from-stock (4.4) |
| Farms do not own products | Lines FK to `catalog.products` only |
| Actuals are ledger-derived | Prefer sum of `RECEIVE` movements / lot harvest qty — do not hand-edit “actual” as a parallel ledger |
| History is append-friendly | Closed/archived cycles remain queryable forever |
| Coffee is not a special table | Same cycle/line model for teff, maize, spices, etc. |

---

## 3. Positioning in the platform

```
Identity
    ↓
Catalog.Product  (what)
    ↓
Farms.Farm / Plot / Field / ProductionUnit  (where)
    ↓
CroppingCycle + CycleLines  (planned when / how much)     ← 4.5
    ↓
Inventory RECEIVE → StockLot  (actual harvest)            ← 4.2 (+ optional cycle FK)
    ↓
Warehouse site on lot (where held)                        ← 4.3
    ↓
Listing optional bind → Reservation                       ← 4.4
    ↓
Order → Delivery DISPATCH                                 ← Phase 5
    ↓
Dashboards / AI                                           ← 4.6 + advisory
```

Value-chain alignment with Phase 4 parent: **Plan → Inventory → Warehouse → Listing → Order**.

---

## 4. Current state (what already exists)

| Artifact | Status |
|----------|--------|
| `farms.farms`, `plots`, `fields`, `production_units`, parties | Implemented (4.1) |
| `inventory.stock_lots` with `farm_id`, optional `plot_id`, `harvest_date`, `product_id` | Implemented (4.2) |
| `POST /inventory/receive` | Implemented; **no** cycle FK today |
| `warehouse.storage_sites` + lot location | Implemented (4.3) |
| Listing ↔ stock reservations | Implemented (4.4) |
| Season / cycle tables | **Not created** — reserved in [4.1 §4.1](phase-4.1-farm-management-design.md) |
| Ad-hoc farm “crop” columns | Intentionally avoided in 4.1 |

**4.5 goal:** implement the reserved cycle model and wire optional actuals attribution — without redesigning prior slices.

---

## 5. Season and cropping-cycle model

### 5.1 Concepts

| Concept | Definition | Stored as |
|---------|------------|-----------|
| **Season year** | Calendar / campaign year label for reporting (e.g. `2026`) | `season_year INT` on cycle |
| **Season code** | Named agricultural season within a year (configurable catalog) | FK → `farms.season_codes.code` |
| **Cropping cycle** | One planned production **window** on a farm (optional spatial scope) | `farms.cropping_cycles` |
| **Cycle line** | One planned product (+ optional variety) with planned qty/unit | `farms.cropping_cycle_lines` |
| **Harvest event** | One inventory `RECEIVE` (lot) attributed to a cycle/line | Lot + RECEIVE movement |
| **Actual qty** | Sum of harvest events for that line | **Computed** (see §7) |

A farm may have:

- Many cycles across years (2019…2026…) → **multi-year history**  
- Multiple cycles in one year (different `season_code` or non-overlapping windows / plots)  
- Multiple product lines on one cycle (e.g. coffee + companion crop)

### 5.2 Configurable season codes (approved)

Season codes are **not** a closed PostgreSQL enum of BELG/MEHER. They live in a **lookup table** so regional expansion needs only new rows:

```sql
farms.season_codes (
  code PK,           -- e.g. BELG, MEHER, LONG_RAINS, SHORT_RAINS, CUSTOM
  name, name_am,
  region_hint,       -- optional e.g. ET, KE, UG — filter/documentation
  sort_order,
  is_active,
  metadata JSONB
)
```

- Seed Ethiopia-first codes: `BELG`, `MEHER`, `IRRIGATION`, `YEAR_ROUND`, `CUSTOM`.  
- Cycles store `season_code VARCHAR` **FK** → `farms.season_codes(code)`.  
- Platform/admin (or future CMS) can insert codes for other regions without migration redesign.  
- API: `GET /season-codes` (active only by default).  
- Inactive codes cannot be chosen for **new** cycles; existing cycles keep historical code.

Optional later (additive): richer `season_definitions` calendar rows keyed by year+code+region — **not required** for 4.5.

### 5.3 Spatial scope on a cycle

| Column | Required | Rule |
|--------|----------|------|
| `farm_id` | Yes | Ownership / auth root |
| `plot_id` | No | If set, must belong to `farm_id` |
| `field_id` | No | If set, must belong to `plot_id` |
| `production_unit_id` | No | If set, must belong to `farm_id` |

**Default MVP UX:** farm-level cycle (plot optional). Finer scope is data-ready from day one.

### 5.4 Overlap policy

| Case | Policy |
|------|--------|
| Same farm, overlapping dates, different plots | **Allowed** |
| Same farm, same plot, overlapping dates, different season codes | **Allowed** (warn in API, not hard-block) |
| Same farm, overlapping dates, same plot, same product on two in-flight cycles | **Warn**; do not hard-block MVP |
| Actuals with ambiguous multi-cycle match | Prefer **explicit** `stock_lots.cropping_cycle_id`; else attribution rules in §7.2 |

---

## 6. Planned quantity model

### 6.1 Cycle line

Each line:

- `product_id` → `catalog.products` (**required**)  
- Optional `product_variety_id` → `catalog.product_varieties`  
- `planned_qty` + `unit_code` → `catalog.units`  
- Optional `planned_area_ha` (planning hint; not used for stock math)  
- Optional `notes`

**Unit rule:** Prefer product `default_unit_code`. If client sends another unit, convert with existing inventory unit conversion (same as 4.2) into the line’s stored unit; reject if no conversion.

### 6.2 One product per cycle (MVP constraint)

**Recommend:** at most **one ACTIVE line per (`cycle_id`, `product_id`)** (variety may differ only if product differs — i.e. unique on `cycle_id + product_id`).

Rationale: keeps plan-vs-actual aggregation simple. If two varieties of the same product must be planned separately later, relax unique to `(cycle_id, product_id, product_variety_id)` via migration — **no redesign of headers**.

### 6.3 Plan is not a stock reservation

Editing `planned_qty` never calls `RESERVE` / `RELEASE`. Inventory availability and listing holds remain governed solely by 4.2–4.4.

---

## 7. Planned vs actual (truth model)

### 7.1 Definitions

| Metric | Source of truth |
|--------|-----------------|
| **Planned** | `cropping_cycle_lines.planned_qty` (+ unit) |
| **Actual** | Sum of **all** harvest events (RECEIVEs) attributed to that line (§7.2–7.3) |
| **Variance** | `actual - planned` (API-computed) |
| **Attainment %** | `actual / planned` when planned > 0 |

**Multiple harvest events (approved):** A single cycle line may accumulate many `RECEIVE` lots over the season (picks, staggered drying intake, split deliveries into store). Each qualifying RECEIVE is one **harvest event**; actual qty is their **sum**. Performance API returns both the aggregate and the event list.

**Do not** store farmer-editable `actual_qty` on the line in MVP — that would fork truth from the inventory ledger. Optional later: cached rollup columns refreshed by job for 4.6 performance (`actual_qty_cached`, `actuals_as_of`) — additive only.

### 7.2 Attribution rules (actuals)

**Tier A — Explicit bind (preferred when present)**

On `POST /inventory/receive`, optional:

```json
{
  "croppingCycleId": "…",
  "cycleLineId": "…"
}
```

Persist on `inventory.stock_lots`:

- `cropping_cycle_id` (nullable FK → `farms.cropping_cycles`)  
- `cropping_cycle_line_id` (nullable FK → `farms.cropping_cycle_lines`)

Validation when provided:

1. Caller has farm write access on the lot’s farm.  
2. Cycle belongs to same `farm_id` as receive.  
3. If `plot_id` on receive and cycle has `plot_id`, they must match (or cycle plot null).  
4. Product on lot must match line product (and variety if both set).  
5. Cycle status ∈ {`PLANNED`, `IN_PROGRESS`, `HARVESTED`, `COMPLETED`} for new Tier A attribution (`DRAFT` / `CANCELLED` / `ARCHIVED` rejected).

Actual for a line = sum of RECEIVE `qty_in_lot_unit` across **all** lots bound to that line (multiple harvest events).

**Auto status hint (server, optional, non-breaking):** On first successful Tier A RECEIVE against a `PLANNED` cycle, transition → `IN_PROGRESS`. Further RECEIVEs do not skip ahead to `HARVESTED` / `COMPLETED` (those remain explicit).

**Tier B — Soft temporal attribution (backward compatible)**

If lot has **no** `cropping_cycle_id`:

Include lot’s RECEIVE qty in cycle line actuals when **all** hold:

1. `lot.farm_id = cycle.farm_id`  
2. `lot.product_id = line.product_id`  
3. Coalesce(`lot.harvest_date`, `lot.received_at`::date) ∈ [`cycle.starts_on`, `cycle.ends_on`]  
4. If cycle.`plot_id` set → `lot.plot_id` equals it (lots with null plot **excluded** from plot-scoped cycles)  
5. Cycle status not in {`CANCELLED`, `ARCHIVED`, `DRAFT`}

**Ambiguity:** If a RECEIVE matches **multiple** in-flight cycles under Tier B, attribute to the **narrowest** scope (plot-scoped over farm-scoped), then latest `starts_on`. Surface `attributionConfidence: EXPLICIT | INFERRED | AMBIGUOUS` in API detail for AI/debug. Prefer prompting Farmer app to send Tier A once cycles exist.

### 7.3 Multiple harvest events

```
Cycle line (planned 2000 KG)
   ├── RECEIVE Lot A  500 KG  (harvest event 1)
   ├── RECEIVE Lot B  300 KG  (harvest event 2)
   └── RECEIVE Lot C  200 KG  (harvest event 3)
Actual = 1000 KG   Attainment = 50%
```

- No “single harvest row” entity — each receive/lot **is** the event.  
- `GET …/performance` includes `harvestEvents[]` (lotId, qty, harvestDate, attribution).  
- Adjustments after receive do **not** rewrite harvest actuals (actuals stay RECEIVE-sum).

### 7.4 What does **not** count as actual

| Excluded | Why |
|----------|-----|
| `ADJUST_IN` / purchases / transfers in | Not harvest against plan |
| `RESERVE` / `RELEASE` / listing activity | Commercial holds, not production |
| `DISPATCH` | Fulfillment (Phase 5), reduces stock, not harvest |
| Offer-only listings with no lot | No inventory actual |

### 7.5 Multi-year history

- Cycles are **soft-closed** (`COMPLETED` / `ARCHIVED`), never hard-deleted when they have lines or attributed lots.  
- List API supports `seasonYear`, `seasonCode`, `status`, `from`, `to` filters.  
- Farm identity stays stable; history accumulates as cycle rows.

---

## 8. Lifecycle

### 8.1 Cycle status (approved)

```text
DRAFT → PLANNED → IN_PROGRESS → HARVESTED → COMPLETED → ARCHIVED
              ↘ CANCELLED (from DRAFT / PLANNED / IN_PROGRESS)
```

| Status | Meaning | Plan edits | New RECEIVE bind (Tier A) |
|--------|---------|------------|---------------------------|
| `DRAFT` | Working draft | Yes | No |
| `PLANNED` | Plan committed for the season | Yes | Yes |
| `IN_PROGRESS` | Season underway (typically after first harvest event) | Yes (qty/lines; dated warn) | Yes |
| `HARVESTED` | Harvesting finished; may still refine notes | Lines frozen (notes ok) | Yes (late/small intakes) |
| `COMPLETED` | Season closed for planning purposes | Frozen | Yes (late harvest exception) |
| `CANCELLED` | Abandoned plan | Frozen | No |
| `ARCHIVED` | Hidden from default lists; historical | Frozen | No |

### 8.2 Recommended transitions

| Endpoint | Transition |
|----------|------------|
| Create (default) | → `DRAFT` (client may set `PLANNED`) |
| `POST …/plan` | `DRAFT` → `PLANNED` |
| `POST …/start` | `PLANNED` → `IN_PROGRESS` (also auto on first Tier A receive) |
| `POST …/mark-harvested` | `IN_PROGRESS` → `HARVESTED` |
| `POST …/complete` | `HARVESTED` or `IN_PROGRESS` → `COMPLETED` |
| `POST …/cancel` | `DRAFT` / `PLANNED` / `IN_PROGRESS` → `CANCELLED` |
| `POST …/archive` | `COMPLETED` / `CANCELLED` → `ARCHIVED` |

Completing / archiving does **not** auto-adjust inventory.

### 8.3 Audit

Reuse `farms.farm_audit_log` with new entity type values:

- `CROPPING_CYCLE`  
- `CROPPING_CYCLE_LINE`  

Additive to existing `farms.audit_entity_type` enum — same pattern as 4.1.

---

## 9. Data model (SQL-first, additive)

### 9.1 Status enum + configurable season codes

```sql
CREATE TYPE farms.cropping_cycle_status AS ENUM (
  'DRAFT',
  'PLANNED',
  'IN_PROGRESS',
  'HARVESTED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED'
);

CREATE TABLE farms.season_codes (
  code         VARCHAR(40) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  name_am      VARCHAR(100),
  region_hint  VARCHAR(40),
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed (Ethiopia-first; more regions = INSERT rows later)
INSERT INTO farms.season_codes (code, name, name_am, region_hint, sort_order) VALUES
  ('BELG', 'Belg', NULL, 'ET', 10),
  ('MEHER', 'Meher', NULL, 'ET', 20),
  ('IRRIGATION', 'Irrigation', NULL, NULL, 30),
  ('YEAR_ROUND', 'Year-round', NULL, NULL, 40),
  ('CUSTOM', 'Custom', NULL, NULL, 90);
```

### 9.2 `farms.cropping_cycles`

```sql
CREATE TABLE farms.cropping_cycles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id             UUID NOT NULL REFERENCES farms.farms(id) ON DELETE RESTRICT,
  plot_id             UUID REFERENCES farms.plots(id) ON DELETE SET NULL,
  field_id            UUID REFERENCES farms.fields(id) ON DELETE SET NULL,
  production_unit_id  UUID REFERENCES farms.production_units(id) ON DELETE SET NULL,
  code                VARCHAR(40),
  name                VARCHAR(150) NOT NULL,
  name_am             VARCHAR(150),
  season_year         INT NOT NULL CHECK (season_year BETWEEN 1990 AND 2100),
  season_code         VARCHAR(40) NOT NULL REFERENCES farms.season_codes(code),
  starts_on           DATE NOT NULL,
  ends_on             DATE NOT NULL,
  status              farms.cropping_cycle_status NOT NULL DEFAULT 'DRAFT',
  notes               TEXT,
  metadata            JSONB,  -- AI / extensibility bag (non-authoritative)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on >= starts_on)
);

CREATE INDEX idx_cropping_cycles_farm_id ON farms.cropping_cycles (farm_id);
CREATE INDEX idx_cropping_cycles_season ON farms.cropping_cycles (farm_id, season_year, season_code);
CREATE INDEX idx_cropping_cycles_status ON farms.cropping_cycles (status);
CREATE INDEX idx_cropping_cycles_window ON farms.cropping_cycles (starts_on, ends_on);
```

### 9.3 `farms.cropping_cycle_lines`

```sql
CREATE TABLE farms.cropping_cycle_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id            UUID NOT NULL REFERENCES farms.cropping_cycles(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES catalog.products(id) ON DELETE RESTRICT,
  product_variety_id  UUID REFERENCES catalog.product_varieties(id) ON DELETE SET NULL,
  planned_qty         NUMERIC(14,3) NOT NULL CHECK (planned_qty > 0),
  unit_code           VARCHAR(20) NOT NULL REFERENCES catalog.units(code),
  planned_area_ha     NUMERIC(10,2),
  sort_order          INT NOT NULL DEFAULT 0,
  notes               TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_id, product_id)
);

CREATE INDEX idx_cycle_lines_product ON farms.cropping_cycle_lines (product_id);
```

### 9.4 Inventory bridge (additive)

```sql
ALTER TABLE inventory.stock_lots
  ADD COLUMN IF NOT EXISTS cropping_cycle_id UUID
    REFERENCES farms.cropping_cycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cropping_cycle_line_id UUID
    REFERENCES farms.cropping_cycle_lines(id) ON DELETE SET NULL;

CREATE INDEX idx_stock_lots_cropping_cycle_id
  ON inventory.stock_lots (cropping_cycle_id);
CREATE INDEX idx_stock_lots_cropping_cycle_line_id
  ON inventory.stock_lots (cropping_cycle_line_id);
```

Existing lots remain valid with nulls → Tier B attribution still works for historical windows.

### 9.5 Optional SQL view (documentation / 4.6)

```sql
-- Indicative; may ship as Nest query first
CREATE OR REPLACE VIEW farms.v_cycle_line_actuals AS
SELECT …;  -- planned_qty, actual_receive_qty, variance, attainment
```

Not required for API correctness if Nest computes the same rules.

### 9.6 Explicitly **not** changed in 4.5

| Area | Change |
|------|--------|
| `marketplace.listings` | None required (optional `cropping_cycle_id` deferred) |
| `inventory.reservations` | None |
| Warehouse tables | None |
| Catalog tables | None |
| Buyer APIs | None |

---

## 10. Integration map

| Module | 4.5 contract |
|--------|----------------|
| **Catalog** | Lines reference `product_id` / optional variety; units from `catalog.units` |
| **Farms / Plots / Fields / Units** | Cycle scoped to farm; optional hierarchy FKs; auth via farm parties |
| **Inventory** | Actuals from RECEIVE; optional cycle FKs on lots; receive API additive fields |
| **Warehouse** | Unchanged — receive may still set `storageSiteId`; plan does not place stock |
| **Listing ↔ Stock (4.4)** | Unchanged — after harvest, farmer may sell-from-stock; plan does not auto-list or reserve |
| **Orders / Delivery** | No direct FK in 4.5; lineage lot → cycle available for origin stories later |
| **Dashboards (4.6)** | Consume cycle list + attainment; no duplicate plan store |
| **AI / Forecasting** | Features: farm/plot geo, season_year/code, window, planned_qty, actual receive series, product, region (see §12) |
| **Certification** | Future: cert lines may reference cycle/harvest lot — IDs stable |

### 10.1 End-to-end example (coffee)

```
1. Create cycle: farm F1, Meher 2026, 2026-06-01 → 2026-12-31, ACTIVE
2. Add line: ETHIOPIAN_ARABICA_COFFEE, planned 2000 KG
3. RECEIVE 500 KG with croppingCycleId (+ site ON_FARM)
4. Plan-vs-actual: planned 2000, actual 500, attainment 25%
5. Create listing from lot (4.4) → reservation; on_hand unchanged until Delivery
```

Same steps work for teff/maize by changing `product_id` only.

---

## 11. API design (`/api/v1`)

Auth: JWT + farmer; mutations require active farm party with write role on `farm_id` (same helper as farms/inventory).

### 11.1 Cropping cycles

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/farms/:farmId/cropping-cycles` | List (`seasonYear`, `seasonCode`, `status`, pagination) |
| `POST` | `/farms/:farmId/cropping-cycles` | Create cycle (+ optional lines array) |
| `GET` | `/cropping-cycles/:id` | Detail + lines + plan-vs-actual summary |
| `PATCH` | `/cropping-cycles/:id` | Update name/window/notes/status fields allowed by lifecycle |
| `POST` | `/cropping-cycles/:id/plan` | DRAFT → PLANNED |
| `POST` | `/cropping-cycles/:id/start` | PLANNED → IN_PROGRESS |
| `POST` | `/cropping-cycles/:id/mark-harvested` | IN_PROGRESS → HARVESTED |
| `POST` | `/cropping-cycles/:id/complete` | → COMPLETED |
| `POST` | `/cropping-cycles/:id/cancel` | → CANCELLED |
| `POST` | `/cropping-cycles/:id/archive` | → ARCHIVED |
| `GET` | `/season-codes` | List configurable season codes |

### 11.2 Lines

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/cropping-cycles/:id/lines` | Add line |
| `PATCH` | `/cropping-cycle-lines/:lineId` | Update planned qty/notes (if cycle editable) |
| `DELETE` | `/cropping-cycle-lines/:lineId` | Soft-delete only if no explicit lot binds; else reject |

### 11.3 Plan vs actual

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/cropping-cycles/:id/performance` | Lines with planned / actual / variance / attainment / attribution mix |
| `GET` | `/farms/:farmId/production-history` | Multi-year rollup by `seasonYear` (+ optional product) |

### 11.4 Inventory (additive)

`POST /inventory/receive` accepts optional `croppingCycleId`, `cycleLineId`.  
Responses may include those ids when set. Omitting them preserves today’s behaviour (Tier B).

### 11.5 Example create payload

```json
POST /farms/{farmId}/cropping-cycles
{
  "name": "Meher 2026 Coffee",
  "seasonYear": 2026,
  "seasonCode": "MEHER",
  "startsOn": "2026-06-01",
  "endsOn": "2026-12-31",
  "plotId": null,
  "status": "PLANNED",
  "lines": [
    {
      "productCode": "ETHIOPIAN_ARABICA_COFFEE",
      "plannedQty": 2000,
      "unitCode": "KG",
      "plannedAreaHa": 1.5
    }
  ]
}
```

### 11.6 Example performance response

```json
{
  "cycleId": "…",
  "seasonYear": 2026,
  "seasonCode": "MEHER",
  "status": "IN_PROGRESS",
  "lines": [
    {
      "lineId": "…",
      "productId": "…",
      "productCode": "ETHIOPIAN_ARABICA_COFFEE",
      "plannedQty": 2000,
      "unitCode": "KG",
      "actualQty": 1000,
      "varianceQty": -1000,
      "attainmentPct": 50,
      "harvestEventCount": 3,
      "harvestEvents": [
        { "lotId": "…", "qty": 500, "unitCode": "KG", "harvestDate": "2026-10-01", "attribution": "EXPLICIT" },
        { "lotId": "…", "qty": 300, "unitCode": "KG", "harvestDate": "2026-10-15", "attribution": "EXPLICIT" },
        { "lotId": "…", "qty": 200, "unitCode": "KG", "harvestDate": "2026-11-02", "attribution": "EXPLICIT" }
      ],
      "attribution": {
        "explicitLots": 3,
        "inferredLots": 0,
        "confidence": "EXPLICIT"
      }
    }
  ]
}
```

---

## 12. Future AI forecasting and analytics

4.5 does **not** ship models. It guarantees a stable feature surface:

| Feature family | Fields / streams |
|----------------|------------------|
| Identity / place | `farm_id`, plot/field/unit ids, region/zone/woreda, lat/lng, boundary |
| Season context | `season_year`, `season_code`, `starts_on`, `ends_on`, status |
| Plan targets | product, variety, `planned_qty`, unit, `planned_area_ha` |
| Actual stream | RECEIVE movements + harvest dates + optional cycle FKs |
| Commercial lag | listings/reservations/orders joinable via lot (existing) |
| Extensibility bag | `metadata` JSONB on cycle/line for model experiment tags |

**Advisory path (later):** suggest planned qty from prior years’ actuals + weather — write suggestions into `DRAFT` cycles or `metadata.suggestedPlannedQty`; farmer confirms → `planned_qty`. No redesign of tables.

**Analytics path (4.6):** attainment %, YoY actuals, product mix — read APIs / views over this model.

---

## 13. Multi-commodity readiness

| Concern | Approach |
|---------|----------|
| Coffee MVP | Seed/demo cycles use coffee product codes |
| Teff / maize / spices | Same APIs; different `product_id` |
| Units | KG / QUINTAL / etc. via catalog + conversions |
| Season semantics | Shared enum; crop-specific calendars stay in dates + `CUSTOM` name |
| Qualities / grades | Remain on lots/listings — **not** duplicated on plan lines in 4.5 |

---

## 14. Backward compatibility

| Client / data | Behaviour |
|---------------|-----------|
| Existing Farmer APKs | Unaffected; no required calls |
| `POST /inventory/receive` without cycle ids | Unchanged; Tier B actuals when cycles exist |
| Lots created before 4.5 | Null cycle FKs; still contribute via Tier B if dates/product/farm match |
| Offer-only listings / 4.4 binds | Unchanged |
| Buyer | Unchanged |
| Farm/product invariants | Unchanged — still no `farms.products` |

---

## 15. Mobile (Farmer M10) — after staging API smoke

Additive only (not part of design approval implementation):

1. Farm detail → **Seasons / Plans** list (filter by year).  
2. Create cycle: season year/code, date window, optional plot, product lines + planned qty.  
3. Cycle detail: planned vs actual bars/numbers; link “Receive harvest” prefilling `croppingCycleId`.  
4. Production history: prior years read-only.  

Buyer app: **no changes**.  
Milestone label: **M10** (M7 warehouse, M8 sell-from-stock already used).

---

## 16. Nest module layout

```
apps/api/src/
  farms/
    cropping-cycles/     # controller + service (or farms.plans.*)
    …
  inventory/
    …                    # receive accepts optional cycle ids
```

Prisma models map to `farms` / `inventory` schemas; no new Nest app.

---

## 17. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Double-counting actuals across overlapping cycles | Prefer Tier A bind; Tier B narrowest-scope + confidence flag |
| Farmers edit planned qty to “match” actuals | Allow edits while ACTIVE; COMPLETED freezes lines; audit log |
| Treating plan as stock | Explicit invariant + no inventory side effects in cycle APIs |
| Coffee-only schema drift | Product FK only; no coffee columns on cycle tables |
| Performance of actuals on large history | Indexes on cycle window + lot cycle FKs; optional cached rollups later |
| Soft-delete vs history | ON DELETE RESTRICT on farm; archive cycles; CASCADE lines only with cycle |

---

## 18. Implementation plan (after approval only)

| Step | Work |
|------|------|
| 1 | SQL: enums, `cropping_cycles`, `cropping_cycle_lines`, lot FK columns, indexes; audit enum values |
| 2 | Prisma map + generate |
| 3 | Nest: CroppingCycles module; extend receive validation; performance + history endpoints |
| 4 | Rule tests (lifecycle, unique lines, Tier A/B actuals, auth) |
| 5 | Docs: API README, data dictionary, feature mapping, README phase status |
| 6 | Staging migrate + deploy + API smoke |
| 7 | Farmer M10 UI → EAS staging APK → on-device |
| 8 | Production only when explicitly approved |

---

## 19. Success criteria

- Farmer can create multiple cycles across years and seasons for one farm.  
- Cycle lines plan any active catalog product (coffee first).  
- Plan-vs-actual returns correct totals for explicit binds.  
- Receive without cycle ids still works; Tier B attributes when unambiguous.  
- Creating/editing cycles never changes lot on-hand / reserved.  
- Listing ↔ stock and warehouse flows remain unchanged.  
- Prior seasons remain readable after complete/archive.  
- Staging smoke + Farmer M10 validation before any production promotion.

---

## 20. Approval checklist

- [x] **Canonical entities** `cropping_cycles` / `cropping_cycle_lines` accepted  
- [x] **Configurable `farms.season_codes`** (not fixed BELG/MEHER-only enum) accepted  
- [x] **Lifecycle** `DRAFT → PLANNED → IN_PROGRESS → HARVESTED → COMPLETED → ARCHIVED` (+ `CANCELLED`) accepted  
- [x] **Multi-year history** via many cycles + archive (no hard-delete) accepted  
- [x] **Multiple harvest events** per cycle line (sum of RECEIVEs) accepted  
- [x] **Multiple products per cycle** via lines; unique `(cycle_id, product_id)` accepted  
- [x] **Actuals** = RECEIVE-derived; no editable parallel actual ledger accepted  
- [x] **Tier A optional lot FKs** + **Tier B temporal fallback** accepted  
- [x] **Plan independent of inventory qty / warehouse / listings** accepted  
- [x] **`listing.cropping_cycle_id` deferred** accepted  
- [x] **Optional plot/field/production_unit scope** accepted  
- [x] **Multi-commodity via catalog only** accepted  
- [x] **AI/analytics hooks** (stable IDs + metadata; no models in 4.5) accepted  
- [x] **Buyer unchanged; Farmer M10 after staging smoke** accepted  
- [x] Out-of-scope (inputs, weather, farm activity ops, AI auto-plan, 4.6 dashboards, production cutover) accepted  
- [x] **Implementation authorized** (explicit — unlocks SQL)

**Approver:** Product owner **Date:** 2026-07-15

---

## 21. Resolved review decisions

1. **Default create status:** `DRAFT` (client may create as `PLANNED`).  
2. **Overlapping same-plot same-product in-flight cycles:** warn only.  
3. **Late harvest after COMPLETED / HARVESTED:** Tier A bind allowed.  
4. **`listing.cropping_cycle_id`:** deferred.  
5. **Actuals compute:** Nest-first; SQL view optional later.  
6. **Season codes:** configurable lookup table (v1.1).  
7. **Inputs / weather / activities:** out of scope for 4.5 (confirmed).

---

## 22. References

- [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (§5.4 Production planning)  
- [Phase 4.1 — Farm management](phase-4.1-farm-management-design.md) (§4.1 Future Season / Cropping Cycle)  
- [Phase 4.2 — Inventory](phase-4.2-inventory-design.md) (**closed**)  
- [Phase 4.3 — Warehouse](phase-4.3-warehouse-design.md) (**closed**)  
- [Phase 4.4 — Listing ↔ stock](phase-4.4-listing-stock-design.md) (**approved / staging**)  
- [Backend ↔ Mobile feature mapping](../backend-mobile-feature-mapping.md)  
- DDL precedent: `database/migrations/farms/*`, `database/migrations/inventory/*`
