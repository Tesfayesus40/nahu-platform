# Phase 4.1 — Farm Management Design (Complete Review)

**Status:** Approved v1.2 — refinements accepted; implementation authorized  
**Date:** 2026-07-14  
**Parent:** [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (Approved)  
**Slice:** 4.0 foundations + 4.1 farm management (expanded for ecosystem readiness)

**Implementation gate:** Authorized — SQL → Prisma → API → Tests → Docs → Staging → Validation  

---

## 0. Design verdict (for reviewers)

| Review theme | Design response | Ships in 4.1 DDL? | Ships in 4.1 API? |
|--------------|-----------------|-------------------|-------------------|
| Multiple farms per farmer | 1:N via membership | Yes | Yes |
| Ownership / coop / lease | `tenure_type` + `farm_parties` | Yes | Owner create + mine list; coop/tenant APIs thin/partial |
| Hierarchy Farm→Plot→Field→Unit | Tables through Field; production units stub | Farm+Plot+Field tables; `production_units` stub | Farm (+ Plot CRUD); Field optional |
| Catalog / Inventory / … hooks | Integration map; **no product ownership on Farm** | — | — |
| Season / cropping cycle | Documented future layer (§4.1) | Reserved for 4.5 | — |
| Geospatial / satellite | Lat/lng + GeoJSON boundary | Yes (no PostGIS required) | Optional fields |
| Lifecycle / size / audit / i18n | Status, size_ha, audit, translations | Yes | Status/size/names; audit append-only internal |

This version **supersedes** the earlier short 4.1 draft (single `farmer_profile_id` owner column only).

---

## 1. Business goals (4.1)

1. Establish **Farm** as the durable production place in Nahu Farm.
2. Support **Ethiopian operating realities**: own land, leased/tenant plots, cooperative-managed sites, multiple farms per producer.
3. Define a **stable hierarchy** that inventory, warehouse, orders, AI, weather, certification, and precision ag can hang from **without redesign**.
4. Be **geospatial-ready** (GPS, boundaries, satellite overlays) without mandating PostGIS on day one.
5. Remain **mobile-API compatible** and additive to Marketplace / Buyer flows.

---

## 2. Business model — ownership & tenure

### 2.1 Concepts

| Concept | Definition |
|---------|------------|
| **Farm** | Logical production holding registered on the platform (may span multiple plots) |
| **Party** | Actor with a relationship to a farm (farmer profile, later cooperative org) |
| **Tenure** | How the holding is possessed/operated legally or customarily |
| **Membership role** | What the party may do on that farm |

### 2.2 Tenure types (`farms.tenure_type`)

```text
OWNED          — farmer (or household) owns / holds rights
LEASED         — farmer operates under lease / tenancy
COOPERATIVE    — farm/site managed under cooperative control
CUSTOMARY      — customary / communal arrangements (Ethiopia-aware)
MIXED          — multiple tenures across plots (farm-level summary)
OTHER
```

Farm-level `tenure_type` is a **summary**. Plot-level tenure can differ (e.g. owned homestead + leased expansion).

### 2.3 Farm parties (`farms.farm_parties`)

Many farmers and (later) cooperatives can relate to one farm:

| Role (`party_role`) | Meaning |
|---------------------|---------|
| `OWNER` | Primary rights holder; default creator |
| `CO_OWNER` | Shared ownership |
| `OPERATOR` | Day-to-day manager (may be same as owner) |
| `TENANT` | Lessee operating the farm/plot |
| `COOP_MANAGER` | Cooperative officer managing member farm/site |
| `VIEWER` | Read-only (extensionist, inspector — later) |

**4.1 create flow:** Creating farmer becomes `OWNER` + `OPERATOR` with `is_primary = true`.  
**Coop / tenant onboarding APIs:** Schema-ready; full multi-party invite flows can land in 4.1.1 without DDL redesign.

### 2.4 Multiple farms per farmer

Allowed and expected (`farm_parties` 1:N). `GET /farms/mine` returns every farm where the caller’s farmer profile is an active party.

### 2.5 Cooperative-managed farms

- `tenure_type = COOPERATIVE` and/or party role `COOP_MANAGER`.
- Optional `cooperative_id` → `marketplace.cooperatives` on the farm row (nullable).
- Future: Identity org membership (`user_organizations`) grants coop roles — **do not block 4.1** on full IAM redesign.

### 2.6 Tenant / leased farms

- Farm or plot `tenure_type = LEASED`.
- Optional lease window on party or plot: `valid_from` / `valid_to`.
- Ownership **history** preserved via `farm_party_history` (see §7) when parties change — not by overwriting.

---

## 3. Farm hierarchy

```
Farm                         (holding / enterprise unit)
 └── Plot                    (parcels / blocks)
      └── Field              (sub-divisions within a plot — optional)
           └── Production unit  (trees block, greenhouse, pen, pond, apiary…)
```

| Level | Purpose | 4.1 |
|-------|---------|-----|
| **Farm** | Legal/ops unit; dashboards roll up here | Full CRUD-ish API |
| **Plot** | Contiguous land unit; primary geospatial polygon often here | Table + API |
| **Field** | Finer management zone (e.g. coffee blocks A/B) | Table; API optional |
| **Production unit** | Typed operational unit for precision ag / livestock / fishery | Stub table + enum; API later |

**Rule:** Inventory lots and production plans may attach to `farm_id` and optionally `plot_id` / `field_id` / `production_unit_id` in later phases — columns reserved in those modules, not on listing today.

---

## 4. Core domain separation — Farm, Product, Listing

**Invariant (permanent):**

```
catalog.products          ← what can be traded / stocked (catalog owns the product type)
        ▲
        │ references
marketplace.listings      ← commercial offer of a Product (optionally from a Farm)
        ▲
        │ produced / supplied by (optional bind in 4.4+)
farms.farms / plots       ← where production happens (does NOT own Product rows)
```

| Entity | Owns | Does **not** own |
|--------|------|------------------|
| **Farm** | Place, hierarchy, parties, geospatial, ops history | Product master data |
| **Product** | Catalog identity, units, lifecycle | Farms or listings |
| **Listing** | Offer of a **Product** (qty, price, grade…) | Farm tenure; may later *reference* `farm_id` |

- Farms **produce** output that becomes inventory and/or **listings**.
- Listings **reference** `catalog.products` (already via `product_id`).
- Therefore **Farms do not own Products directly** — there is **no** `farms.products` table and **no** required `primary_product_id` on farms in 4.1.
- Historical “what was grown here” is modeled by **Season / Cropping Cycle** lines (§4.1) and inventory movements — not by embedding products on the farm row.

---

## 4.1 Future layer — Season / Cropping Cycle (no redesign)

Documented now; **implemented in Phase 4.5 (production planning)**, not in 4.1 DDL.

```
Farm / Plot / Field / Production unit
        │
        └── CroppingCycle (season window)
                └── CycleCropLine → catalog.products (+ optional variety)
                        ├── planned_qty + unit
                        └── actuals ← inventory RECEIVE movements in window
```

**Indicative future tables (4.5):**

```text
farms.cropping_cycles
  id, farm_id, plot_id?, field_id?, production_unit_id?,
  code, name, season_year, starts_on, ends_on, status, …

farms.cropping_cycle_lines
  id, cycle_id, product_id, product_variety_id?,
  planned_qty, unit_code, notes, …
```

**Why this matters:** Multiple years of coffee/teff/etc. on the same farm stay as cycle history. Farm identity stays stable; products stay in catalog; listings remain offers tied to products (and optionally to a cycle/harvest lot later).

**4.1 rule:** Do not add ad-hoc `crop` text columns that would fight this model.

---

## 5. Future ecosystem integration

```
                    ┌──────────── catalog.products ────────────┐
                    │         ▲              ▲                 │
         cropping cycles (4.5)│              │ listings.product_id
                    │         │              │                 │
                    └────► farms / plots     └── marketplace.listings
                                      │              (optional farm_id in 4.4)
              ┌───────────┬───────────┼───────────┬────────────┐
              ▼           ▼           ▼           ▼            ▼
         warehouse     inventory    orders    certificates   advisory
           (4.3)         (4.2)    (via farm)   (origin)      / weather
```

| Module | Integration contract (no redesign) |
|--------|--------------------------------------|
| **Product Catalog** | Products stay in `catalog`; cycles/stock/listings **reference** `product_id` — farms never own product rows |
| **Inventory (4.2)** | `stock_lots.farm_id` / `plot_id` + `product_id` |
| **Warehouse (4.3)** | `storage_sites.farm_id`; on-farm store type |
| **Orders** | Via listing → product; optional `farm_id` on listing later |
| **AI Advisory** | Farm location + season/cycle + product from listing/stock |
| **Weather** | Farm/plot centroid or boundary |
| **Certifications** | Bind to farm or plot (+ product on cert line later) |
| **Precision agriculture** | Production units + GeoJSON + future imagery |
| **Season / cycle (4.5)** | Historical production without redesign (§4.1) |

Marketplace create listing **without** `farmId` remains valid until 4.4 optionally binds stock/farm.

---

## 6. Geospatial readiness

### 5.1 Principles

- Store **WGS84** coordinates.
- Prefer **GeoJSON** (`JSONB`) for boundaries so staging Postgres works **without** PostGIS.
- Keep a clear upgrade path: optional PostGIS `geometry` generated later from GeoJSON.
- Satellite imagery references storage URLs / scene ids in a later `farms.imagery_assets` table — **not** in 4.1 core, but farm/plot ids are stable.

### 5.2 Columns (farm, plot, field)

| Column | Type | Use |
|--------|------|-----|
| `centroid_lat` | `NUMERIC(9,6)` | GPS pin / map marker |
| `centroid_lng` | `NUMERIC(9,6)` | GPS pin / map marker |
| `boundary_geojson` | `JSONB` | Polygon / MultiPolygon Feature or geometry |
| `boundary_source` | `VARCHAR(40)` | `MANUAL`, `GPS_TRACE`, `IMPORTED`, `SATELLITE_DERIVED` |
| `boundary_updated_at` | `TIMESTAMPTZ` | Freshness for imagery overlays |

Validation (API): if GeoJSON present, `type` must be Polygon or MultiPolygon; lat ∈ [-90,90], lng ∈ [-180,180].

### 5.3 Satellite compatibility

- Boundaries in GeoJSON are interchangeable with most GIS / Earth Engine / Mapbox workflows.
- Later: `imagery_assets(farm_id|plot_id, provider, scene_id, captured_at, cloud_url, bbox_geojson)`.
- No imagery download pipeline in 4.1.

---

## 7. Operational readiness

### 6.1 Lifecycle / status (`farms.farm_status` — shared by farm/plot/field)

| Status | Meaning |
|--------|---------|
| `DRAFT` | Incomplete registration |
| `ACTIVE` | Operating |
| `INACTIVE` | Temporarily paused |
| `SUSPENDED` | Compliance / dispute hold (platform or coop) |
| `ARCHIVED` | Retired; retain for history/stock FKs |

Default on create: `ACTIVE` (mobile simplicity). Clients may use `DRAFT` when multi-step onboarding exists.

### 6.2 Farm size

- `size_ha` on farm (optional declared total).
- Plot/field `size_ha` for rollups.
- Future: derived area from polygon (PostGIS/`turf`) — until then declared size is authoritative.
- `farmer_profiles.farm_size_ha` remains a **profile summary**; no auto-sync in 4.1 (document optional later job).

### 6.3 Ownership & party history

```text
farms.farm_party_history
  id, farm_id, farmer_profile_id?, cooperative_id?,
  party_role, tenure_type?,
  valid_from, valid_to,
  changed_by_user_id, reason, created_at
```

On every party insert/update/end: append history row. Supports lease renewals and coop takeovers without losing audit trail.

### 6.4 Multi-language

| Mechanism | Use |
|-----------|-----|
| `name` + `name_am` on farm/plot | Canonical en/am (platform default) |
| `farms.farm_translations` | Other locales (`om`, `ti`, `so`, `aa`, …) — same pattern as `catalog.product_translations` |

Admin region labels stay free text for now (user-generated / local naming).

### 6.5 Audit history

```text
farms.farm_audit_log
  id, entity_type ('FARM'|'PLOT'|'FIELD'|'PARTY'),
  entity_id, farm_id,
  action ('CREATE'|'UPDATE'|'STATUS_CHANGE'|…),
  actor_user_id,
  before_json, after_json,
  created_at
```

Service layer writes audit on mutations. No public audit API in 4.1 (admin later).

---

## 8. Proposed database schema (4.1 DDL)

### 7.1 Schema & enums

```sql
CREATE SCHEMA IF NOT EXISTS farms;

CREATE TYPE farms.farm_status AS ENUM (
  'DRAFT', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED'
);

CREATE TYPE farms.tenure_type AS ENUM (
  'OWNED', 'LEASED', 'COOPERATIVE', 'CUSTOMARY', 'MIXED', 'OTHER'
);

CREATE TYPE farms.party_role AS ENUM (
  'OWNER', 'CO_OWNER', 'OPERATOR', 'TENANT', 'COOP_MANAGER', 'VIEWER'
);

CREATE TYPE farms.production_unit_kind AS ENUM (
  'GENERIC', 'TREE_BLOCK', 'GREENHOUSE', 'PEN', 'POND', 'APIARY', 'OTHER'
);
```

### 7.2 `farms.farms`

```sql
CREATE TABLE farms.farms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                VARCHAR(40),
  name                VARCHAR(150) NOT NULL,
  name_am             VARCHAR(150),
  tenure_type         farms.tenure_type NOT NULL DEFAULT 'OWNED',
  cooperative_id      UUID REFERENCES marketplace.cooperatives(id) ON DELETE SET NULL,
  status              farms.farm_status NOT NULL DEFAULT 'ACTIVE',
  region              VARCHAR(100) NOT NULL,
  region_en           VARCHAR(100),
  zone                VARCHAR(100),
  woreda              VARCHAR(100),
  kebele              VARCHAR(100),
  altitude_m          NUMERIC(6,1),
  size_ha             NUMERIC(10,2),
  centroid_lat        NUMERIC(9,6),
  centroid_lng        NUMERIC(9,6),
  boundary_geojson    JSONB,
  boundary_source     VARCHAR(40),
  boundary_updated_at TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Note:** Primary owner is **not** only a column on `farms` — it lives in `farm_parties` (`is_primary`). Avoids coop/tenant redesign.

### 7.3 `farms.farm_parties`

```sql
CREATE TABLE farms.farm_parties (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id            UUID NOT NULL REFERENCES farms.farms(id) ON DELETE CASCADE,
  farmer_profile_id  UUID REFERENCES marketplace.farmer_profiles(id) ON DELETE CASCADE,
  cooperative_id     UUID REFERENCES marketplace.cooperatives(id) ON DELETE CASCADE,
  party_role         farms.party_role NOT NULL,
  tenure_type        farms.tenure_type,
  is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from         DATE,
  valid_to           DATE,
  status             farms.farm_status NOT NULL DEFAULT 'ACTIVE',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_farm_party_actor CHECK (
    farmer_profile_id IS NOT NULL OR cooperative_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX uq_farms_one_primary_party
  ON farms.farm_parties (farm_id) WHERE is_primary = TRUE AND status = 'ACTIVE';
```

### 7.4 Hierarchy tables

- `farms.plots` — `farm_id`, identity fields, size, tenure override, geospatial columns, status  
- `farms.fields` — `plot_id`, same pattern  
- `farms.production_units` — `field_id` nullable + `plot_id` nullable + `farm_id` required, `kind`, geospatial optional  

(Exact column lists mirror farms geospatial + status pattern; full SQL in implementation migration files after approval.)

### 7.5 Translations, history, audit

- `farms.farm_translations (farm_id, locale, name, description)` UNIQUE(farm_id, locale)  
- `farms.farm_party_history` (§6.3)  
- `farms.farm_audit_log` (§6.5)  

---

## 8. Prisma

- Add schema `farms` to datasource  
- Map all 4.1 tables/enums  
- No Prisma Migrate for DDL  

---

## 9. REST API (4.1 surface)

Base `/api/v1`. Errors `{ "error": "…" }`.

### Farms

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/farms/mine` | FARMER | Farms where caller is active party |
| `POST` | `/farms` | FARMER | Creates farm + primary OWNER/OPERATOR party |
| `GET` | `/farms/:id` | Party with access | |
| `PATCH` | `/farms/:id` | OWNER/OPERATOR (not VIEWER) | |

### Plots

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/farms/:farmId/plots` | Party |
| `POST` | `/farms/:farmId/plots` | OWNER/OPERATOR |
| `PATCH` | `/plots/:id` | OWNER/OPERATOR |

### Deferred API (schema exists)

- Field CRUD, production units, party invite, coop attach, public audit feed, imagery  

### Create farm example

```json
{
  "name": "Kaffa Highland Farm",
  "nameAm": "የካፋ ተራራ እርሻ",
  "tenureType": "OWNED",
  "region": "ጅማ",
  "regionEn": "Jimma",
  "altitudeM": 1850,
  "sizeHa": 2.5,
  "centroidLat": 7.673,
  "centroidLng": 36.834,
  "boundaryGeojson": {
    "type": "Polygon",
    "coordinates": [[[36.83, 7.67], [36.84, 7.67], [36.84, 7.68], [36.83, 7.68], [36.83, 7.67]]]
  }
}
```

---

## 10. Nest module layout

```
apps/api/src/farms/
  farms.module.ts
  farms.controller.ts
  plots.controller.ts
  farms.service.ts
  dto/...
```

Authorization helper: resolve farmer profile → active `farm_parties` → role gate.

---

## 11. What 4.1 implements vs reserves

| Area | Implement now | Reserve / later |
|------|---------------|-----------------|
| Farm + parties (owner) | Yes | Coop invite UX, multi-OWNER workflows |
| Plots API | Yes | — |
| Field / production unit | DDL | CRUD APIs |
| Geospatial columns | Yes | PostGIS, imagery pipeline |
| Translations table | Yes | Locale query param on GET |
| Audit + party history | Yes (write) | Admin read APIs |
| Inventory / warehouse / plans | — | 4.2–4.5 |
| Listing.farmId | — | 4.4 |

---

## 12. Backward compatibility

- No change to listing/order DTOs required for 4.1.  
- Buyer app unaffected.  
- Farmer app: new screens optional.  
- Existing `farmer_profiles` unchanged.  

---

## 13. Migration & rollout sequence (after approval)

1. SQL: schema, enums, farms, parties, plots, fields, production_units, translations, history, audit  
2. Prisma map + generate  
3. API: farms + plots  
4. Tests (ownership isolation, multi-farm, geospatial validation, status)  
5. Documentation  
6. **Staging only** migrate + deploy + smoke  
7. On-device Farmer check when UI exists  

Production: separate promotion decision (alongside Phase 3 hold as applicable).

---

## 14. Risks & decisions locked by this design

| Risk | Mitigation |
|------|------------|
| Single-owner column blocks coop/lease | Parties table is source of access |
| PostGIS unavailable on Railway | GeoJSON JSONB first |
| Hierarchy over-build | Field/PU are DDL + deferred API |
| Profile vs farm size conflict | Document; no auto-sync in 4.1 |
| Audit volume | JSON diffs only on change; no PII beyond actor id |

---

## 15. Staging test plan (post-implement)

1. Create two farms for one farmer → both in `/farms/mine`  
2. Second farmer cannot read first farmer’s farm  
3. Add plot with polygon → persisted GeoJSON round-trip  
4. `INACTIVE` farm hidden from default mine list  
5. Create farm/plot without any product fields → still OK (products live on listings later)  
6. Listing create without farm fields → still works  
7. Party history row written on create  

---

## 16. Approval checklist

- [x] Ownership model (parties + tenure) accepted  
- [x] Multi-farm, coop-ready, lease-ready model accepted  
- [x] Hierarchy Farm → Plot → Field → Production unit accepted  
- [x] Farm / Product / Listing separation accepted (farms do not own products)  
- [x] Season / Cropping Cycle future layer documented (§4.1)  
- [x] Ecosystem integration map accepted  
- [x] Geospatial (lat/lng + GeoJSON; PostGIS later) accepted  
- [x] Lifecycle, size, history, i18n, audit approach accepted  
- [x] 4.1 API scope (farms + plots; field/PU deferred) accepted  
- [x] Implementation authorized: SQL → Prisma → API → Tests → Docs → Staging → Validation  

**Approver:** Product owner **Date:** 2026-07-14

---

*Replaces the prior short Phase 4.1 draft. Parent Phase 4 program doc remains the roadmap authority for 4.2–4.6.*
