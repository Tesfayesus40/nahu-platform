# Phase 3 — Product Catalog Design

**Status:** Approved v1.2 — implementation authorized  
**Date:** 2026-07-14 (v1.1 review; v1.2 product status + multilingual)  
**Authority:** Incremental phases in `docs/README.md` (Phase 3 → Inventory → Delivery)  
**Related:** Data dictionary “Agricultural Catalog”; Engineering Playbook mobile API v1 contract  

**Out of scope for Phase 3 implementation:** production SMS, mobile cutover, inventory/warehouse/delivery DDL, JWT refresh, M6 envelope, payment webhooks, admin CMS, full attribute engine UI, normalized listing-attribute tables (§3.6)

---

## 0. Architect review summary (v1.1 → v1.2)

| Topic | Verdict | Design response |
|-------|---------|-----------------|
| Category → Product → Variety → Listing | **Sound spine** for Ethiopian multi-commodity | Keep; clarify Variety is optional; expand category seeds |
| `attributes_schema` alone | **Not future-proof enough** as the only path | Demote to optional placeholder; commit to normalized attribute reference tables in a follow-on phase (documented now) |
| `product_id` + mobile compatibility | **Compatible** if additive + nullable + coffee defaults | Keep Phase 2-style backfill; add explicit `is_default` on products |
| Value-chain fit (inventory → cert → AI) | **Good if Product is the stable SKU hub** | Document FK map for every downstream module |
| Codes / units / grades / regions stability | **Needs explicit stability rules** | Codes immutable; grades/process stay coffee enums for now; geography deferred |
| Normalization vs complexity | **Slight under-spec on attributes; slight denorm on dual FKs** | Product owns category; listing `category_id` denormalized; attribute tables designed, not built in Phase 3 DDL |
| Product lifecycle vs category | **Needed** (v1.2) | `catalog.product_status` independent of category `is_active` |
| Multilingual (Ethiopia) | **Needed** (v1.2) | Keep `name_en`/`name_am`; add `product_translations` for all other locales without redesign |

**Approval:** Phase 3 **core catalog** authorized for implementation (SQL → Prisma → API → tests → docs). Do **not** treat `attributes_schema` as the long-term attribute system.

---

## 1. Business goals and scope

### Goals

1. Introduce a **product layer** under `catalog` so Nahu Farms sells named agricultural products, not only categories.
2. Support Ethiopia’s major agricultural sectors over time by **data + activation**, not schema redesign.
3. Keep **coffee** as the only live sellable path in Phase 3 while Expo Farmer/Buyer apps keep working unchanged.
4. Make **`catalog.products` the stable hub** for Inventory, Warehousing, Pricing, Orders (via listings), Delivery, Certification, and AI.
5. Design for the **full agricultural value chain**, not listings alone.

### Target value chain (future architecture)

```
Category
    ↓
Product          ←── catalog hub (Phase 3)
    ↓
Variety          ←── optional
    ↓
Listing          ←── marketplace offer (Phase 1–2 + product_id in Phase 3)
    ↓
Inventory        ←── stock of Product (Phase 4)
    ↓
Warehouse        ←── location / lot of Inventory
    ↓
Order            ←── already FK → Listing (⇒ Product)
    ↓
Escrow Payment   ←── orders module today; webhooks later
    ↓
Delivery         ←── Phase 5 logistics against Order
    ↓
Certification    ←── already Order → origin_certificates; later product/std codes
    ↓
AI Advisory      ←── grounded on Product + region + season + listing attributes
```

Phase 3 builds only through **Product / Variety / Listing.product_id**. Downstream boxes are **integration contracts**, not Phase 3 tables.

### In scope (Phase 3 build)

- `catalog.units`, `catalog.products` (with **lifecycle status**), `catalog.product_varieties`
- `catalog.product_translations` (multilingual extension; see §3.8)
- Inactive category seeds for major Ethiopian sectors (incl. fisheries, forestry)
- Coffee product with `status = ACTIVE`, `is_default = true` + optional varieties
- Nullable `marketplace.listings.product_id` + coffee backfill
- REST: `GET /products`, `GET /products/:codeOrId`; additive listing fields
- Prisma map + documentation
- Documented follow-on: attribute reference model + value-chain FK map

### Out of scope (Phase 3 build)

- Creating attribute / grade / process reference tables **in DDL** (designed in §3.6; implemented in a later approved phase)
- Moving coffee `grade` / `process_method` off listings
- Unit-generic listing quantity/price columns (`quantity` + `unit_code`)
- Enabling non-coffee listing create
- Inventory, warehouse, delivery, pricing tables
- Changing Orders / Certificates / Advisory schemas

---

## 2. Conceptual model

```
catalog.categories
        │ 1
        │ *
catalog.products              ← stable identity for the value chain
        │ 1
        ├── * catalog.product_varieties   (optional)
        │
        └── * marketplace.listings        (offer; category_id denormalized)
```

| Entity | Role | Fits sectors |
|--------|------|----------------|
| **Category** | Commodity family; marketplace activation gate | Coffee, cereals, pulses, oilseeds, spices, fruits, vegetables, livestock, dairy, honey, fisheries, forestry, other |
| **Product** | Saleable type / SKU class | Arabica coffee, teff, sesame, cattle, fresh milk, tilapia, eucalyptus timber, … |
| **Variety** | Optional cultivar / breed / landrace / species strain | Heirloom coffee, Fogera cattle, white teff — **omit** when not meaningful |
| **Listing** | Concrete farmer/seller offer at a place and time | Qty, price, photos, location; coffee grade/process today |

### Sector fit notes

| Sector | Category | Product examples | Variety meaning | Listing-specific (not Product) |
|--------|----------|------------------|-----------------|--------------------------------|
| Coffee | `COFFEE` | Arabica coffee | Cultivar | Grade, process, cup score, washing station |
| Cereals | `CEREALS` | Teff, maize, wheat | Landrace / cultivar | Moisture, season, packing |
| Pulses / oilseeds | `PULSES` / `OILSEEDS` | Chickpea, sesame | Cultivar | Cleanliness, oil content later |
| Spices | `SPICES` | Berbere chili, korarima | Cultivar | Dryness, grind |
| Fruits / vegetables | `FRUITS` / `VEGETABLES` | Avocado, onion | Cultivar | Size grade, ripeness |
| Livestock | `LIVESTOCK` | Cattle, goat, sheep | Breed | Sex, age, live weight |
| Dairy | `DAIRY` | Fresh milk, butter | Rarely used | Fat %, chilled |
| Honey | `HONEY` | Natural honey | Floral source (optional) | Moisture, comb vs extracted |
| Fisheries | `FISHERIES` | Tilapia, Nile perch | Strain (optional) | Fresh vs dried, catch date |
| Forestry | `FORESTRY` | Eucalyptus timber | Species/provenance | Length, diameter class |

**Conclusion:** The four-level spine is flexible enough **if**:
1. Variety stays optional.
2. Commodity-specific trade attributes live on **Listing** (today typed coffee columns; later normalized attributes — §3.6).
3. Product does not try to encode grade/process/sex/age.

---

## 3. Proposed database schema

### 3.1 `catalog.units`

```sql
CREATE TABLE catalog.units (
    code            VARCHAR(20) PRIMARY KEY,
    name_en         VARCHAR(50) NOT NULL,
    name_am         VARCHAR(50) NOT NULL,
    dimension       VARCHAR(20) NOT NULL
        CHECK (dimension IN ('MASS', 'VOLUME', 'COUNT', 'LENGTH', 'OTHER')),
    sort_order      SMALLINT NOT NULL DEFAULT 0
);
```

**Seed (illustrative):**

| code | dimension |
|------|-----------|
| `KG`, `QUINTAL`, `BAG` | MASS |
| `LITER` | VOLUME |
| `HEAD`, `PIECE`, `CRATE` | COUNT |
| `METER` | LENGTH |

`dimension` enables future pricing/inventory conversion rules without redesign. No conversion factors in Phase 3.

### 3.2 `catalog.products`

Product lifecycle is **independent** of category activation:

```sql
CREATE TYPE catalog.product_status AS ENUM (
    'ACTIVE',        -- sellable / visible in default catalog APIs
    'INACTIVE',      -- hidden; not offered
    'COMING_SOON',   -- announced; not sellable yet
    'DISCONTINUED'   -- retired; keep FK history; never reuse code
);
```

```sql
CREATE TABLE catalog.products (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id       UUID NOT NULL
        REFERENCES catalog.categories(id) ON DELETE RESTRICT,
    code              VARCHAR(80) NOT NULL UNIQUE,
    name_en           VARCHAR(150) NOT NULL,
    name_am           VARCHAR(150) NOT NULL,
    description_en    TEXT,
    description_am    TEXT,
    default_unit_code VARCHAR(20) NOT NULL
        REFERENCES catalog.units(code) ON DELETE RESTRICT,
    status            catalog.product_status NOT NULL DEFAULT 'INACTIVE',
    is_default        BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order        SMALLINT NOT NULL DEFAULT 0,
    -- Optional transitional hint only — NOT the long-term attribute system (§3.6).
    attributes_schema JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category_id ON catalog.products (category_id);
CREATE INDEX idx_products_status ON catalog.products (status);

CREATE UNIQUE INDEX uq_products_one_default_per_category
    ON catalog.products (category_id)
    WHERE is_default = TRUE;
```

| Status | Default list (`activeOnly=true`) | Listing create |
|--------|----------------------------------|----------------|
| `ACTIVE` | Included | Allowed if category active |
| `INACTIVE` | Excluded | Rejected |
| `COMING_SOON` | Excluded (unless filtered) | Rejected |
| `DISCONTINUED` | Excluded | Rejected |

**`is_default`:** Explicit default when client omits `productCode`. Coffee default must be `ACTIVE`.

### 3.3 `catalog.product_varieties`

```sql
CREATE TABLE catalog.product_varieties (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL
        REFERENCES catalog.products(id) ON DELETE CASCADE,
    code        VARCHAR(80) NOT NULL,
    name_en     VARCHAR(150) NOT NULL,
    name_am     VARCHAR(150) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, code)
);
```

Listing still uses free-text `variety` in Phase 3. Optional later: `listings.product_variety_id` FK (additive).

### 3.4 `marketplace.listings` delta

```sql
ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS product_id UUID;

ALTER TABLE marketplace.listings
    ADD CONSTRAINT fk_listings_product
        FOREIGN KEY (product_id)
        REFERENCES catalog.products(id)
        ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_listings_product_id
    ON marketplace.listings (product_id);
```

- Nullable until backfill verified.
- Keep `grade`, `process_method`, `quantity_kg`, `price_per_kg` as-is.
- **Source of truth for family:** `product.category_id`. Listing `category_id` is denormalized for filters/indexes; service always sets both from the resolved product.

### 3.5 Phase 3 DDL does **not** include

| Deferred | Why |
|----------|-----|
| Full attribute definition tables | Avoid Phase 3 complexity; design locked in §3.6 |
| Listing `attributes` JSONB | Mobile still uses coffee columns |
| `quantity` + `unit_code` on listings | Breaking for Expo |
| Inventory / warehouse | Phase 4+ |
| Geography tables | Separate module; listing `region` remains free text for now |
| Category / variety / unit translation tables | Same pattern as §3.8; add when those entities need locales beyond en/am |

### 3.6 Long-term attribute model (design commitment — **not Phase 3 DDL**)

`attributes_schema` JSONB on products is **insufficient** as the only long-term mechanism because:

- Poor filterability (“all GRADE_2 + WASHED”)
- Weak referential integrity for allowed values
- Harder for AI, reporting, and certification standards to share canonical codes
- Encourages per-product schema drift

**Target (future approved phase, after coffee enums can be dual-written or migrated):**

```
catalog.attribute_definitions
  id, scope_type ('CATEGORY'|'PRODUCT'), scope_id,
  code, name_en, name_am,
  data_type ('ENUM'|'NUMBER'|'TEXT'|'BOOLEAN'|'DATE'),
  unit_code NULL, is_required, sort_order

catalog.attribute_options
  id, attribute_definition_id, code, name_en, name_am, sort_order

marketplace.listing_attribute_values
  listing_id, attribute_definition_id,
  option_id NULL, value_text NULL, value_number NULL, value_boolean NULL, value_date NULL
```

**Migration path from coffee enums (later):**

1. Seed definitions for coffee `GRADE`, `PROCESS_METHOD` with options matching current Postgres enums.
2. Dual-write from existing listing columns into `listing_attribute_values`.
3. Make coffee columns nullable or views; eventually drop enums when Expo/API no longer require them.

Until that phase, **coffee grade/process stay on listing columns** — no mobile break.

### 3.7 Code and classification stability rules

| Asset | Rule |
|-------|------|
| Category / product / variety / unit **codes** | Immutable after publish; rename via `name_*` / translations only; never reuse a retired code |
| Soft delete | Prefer `status = DISCONTINUED` or `INACTIVE`; avoid hard delete if listings/orders reference the row |
| Product lifecycle | Independent of category `is_active` (§3.2) |
| Grades / quality standards | Canonical codes live in future `attribute_options` (or keep coffee enums until then) |
| Regional classification | Listing free-text now; future `geography` module; do **not** put woreda FKs on products |
| Quality standards (ECX, organic, fairtrade) | Future certification / standards entities referencing `product_id` — not product columns |

### 3.8 Multilingual strategy (Ethiopian languages — no redesign)

**Goal:** Support all relevant Ethiopian languages for catalog names/descriptions without adding `name_xx` columns per language.

#### Phase 3 schema

1. **Canonical columns on `catalog.products`:** `name_en`, `name_am`, `description_en`, `description_am`  
   - Required for English + Amharic (current platform default).  
   - Keeps existing API style and simple SQL filters.

2. **Extension table (Phase 3 DDL):**

```sql
CREATE TABLE catalog.product_translations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID NOT NULL
        REFERENCES catalog.products(id) ON DELETE CASCADE,
    locale       VARCHAR(15) NOT NULL,  -- BCP 47 / ISO 639-1 (+ optional region): en, am, om, ti, so, aa, …
    name         VARCHAR(150) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, locale)
);

CREATE INDEX idx_product_translations_locale
    ON catalog.product_translations (locale);
```

#### Locale policy

| Locale | Role |
|--------|------|
| `en` | English — also stored in `name_en` / `description_en` |
| `am` | Amharic — also stored in `name_am` / `description_am` |
| `om` | Afaan Oromo — translations table only |
| `ti` | Tigrinya — translations table only |
| `so` | Somali — translations table only |
| `aa` | Afar — translations table only |
| *(others)* | Add rows with new `locale` values; **no ALTER TABLE** |

**Rules:**

- Do **not** add `name_om`, `name_ti`, … columns later.
- Optional: mirror `en`/`am` into `product_translations` for a single read path; or resolve: if locale is `en`/`am` use columns, else translations, else fallback `am` → `en`.
- API Phase 3 may expose `nameEn`/`nameAm` only; optional later query `?locale=om` with fallback chain.
- Same table pattern will be reused for categories, varieties, and units when needed (`category_translations`, etc.) — **not** required in Phase 3 DDL.

#### Why this avoids redesign

- Unlimited locales via rows, not columns.  
- FKs and unique `(product_id, locale)` stay stable.  
- AI / mobile can request preferred locale without schema churn.

### 3.9 Intentionally deferred schema (summary)

Covered in §3.5–§3.6. Phase 3 ships units, products (status), varieties, product_translations, listing.product_id, and seeds only.

---

## 4. Value-chain integration map

How Product plugs into modules **without redesign**:

| Module | Integration | Phase |
|--------|-------------|-------|
| **Marketplace / Listing** | `listings.product_id` (+ denormalized `category_id`) | 3 |
| **Orders** | Already `orders.listing_id` → listing → product | exists |
| **Escrow payment** | Order lifecycle; product needed only for display/reporting | exists / webhook later |
| **Inventory** | `inventory.*(product_id, unit_code, qty, owner…)` | 4 |
| **Warehouse** | Stock located in warehouse/bin; stock row → product | 4+ |
| **Delivery** | Shipment against order (product via listing) | 5 |
| **Certification** | Today order-origin cert; later cert types / product standards → `product_id` | later |
| **Pricing** | Future price lists / reference prices keyed by `product_id` (+ region, grade option) | later |
| **AI Advisory** | Prompts and knowledge keyed by `product.code` + category + region + season; listing attributes as features | later |
| **Reporting** | Aggregate GMV / volume by `product_id` / category | anytime after Phase 3 |

**Invariant:** Downstream modules never FK only to Category when they mean a saleable good — they FK to **Product** (or Listing → Product).

---

## 5. REST API (proposed)

Base: `/api/v1`  
Contract: success = direct resource JSON; errors = `{ "error": "…" }` (unchanged).

### 5.1 `GET /products`

Query: `categoryCode?`, `activeOnly` (default `true`), `page`, `limit`  

Pagination **must** match existing listings list response shape exactly (implementation check).

**Example item:**

```json
{
  "id": "…",
  "code": "ETHIOPIAN_ARABICA_COFFEE",
  "categoryCode": "COFFEE",
  "categoryNameEn": "Coffee",
  "categoryNameAm": "ቡና",
  "nameEn": "Ethiopian Arabica Coffee",
  "nameAm": "የኢትዮጵያ አረቢካ ቡና",
  "descriptionEn": "…",
  "descriptionAm": "…",
  "defaultUnitCode": "KG",
  "defaultUnitNameEn": "Kilogram",
  "defaultUnitNameAm": "ኪሎግራም",
  "dimension": "MASS",
  "status": "ACTIVE",
  "isDefault": true,
  "sortOrder": 1,
  "varieties": [
    { "code": "HEIRLOOM", "nameEn": "Heirloom", "nameAm": "ባህላዊ", "isActive": true }
  ]
}
```

`activeOnly=true` (default) means `status = ACTIVE`. Optional later: `?status=COMING_SOON` for announcement UIs.
### 5.2 `GET /products/:codeOrId`

UUID or `code`. Respect `activeOnly` semantics for public callers.

### 5.3 Categories

`GET /categories` unchanged in Phase 3.

### 5.4 Listings — additive only

| Direction | Fields |
|-----------|--------|
| Create (optional) | `productCode` |
| Response (additive) | `productId`, `productCode`, `productNameEn`, `productNameAm`, `defaultUnitCode`, `isDefault` n/a |

**Resolve rules:**

1. No `productCode` + no `categoryCode` → COFFEE category’s **`is_default`** product with `status = ACTIVE`.
2. Only `categoryCode` → that category’s default **ACTIVE** product; error if none.
3. `productCode` set → use that product; set listing `category_id` from `product.category_id`; **reject** if client `categoryCode` conflicts.
4. Category inactive or product not `ACTIVE` → “not available yet.”
5. Coffee DTO validators unchanged (`grade`, `processMethod`, `quantityKg`, `pricePerKg`, …).

**Legacy create (still valid):**

```json
{
  "region": "ጅማ",
  "processMethod": "WASHED",
  "grade": "GRADE_2",
  "quantityKg": 50,
  "pricePerKg": 450,
  "harvestDate": "2026-01-15"
}
```

### 5.5 Filters

Keep `categoryCode`. Add optional `productCode` filter in Phase 3.

No product write APIs in Phase 3.

---

## 6. Prisma model changes (map-only)

Map SQL 1:1: `Unit` (with `dimension`), enum `ProductStatus`, `Product` (with `status`, `isDefault`, optional `attributesSchema`), `ProductVariety`, `ProductTranslation`; `Category.products`; `Listing.productId` + relation.

Prisma does not own DDL.

---

## 7. Migration strategy

| Step | Artifact | Notes |
|------|----------|-------|
| 1 | `catalog/003_catalog_units.sql` | Units + dimension |
| 2 | `catalog/004_catalog_products.sql` | `product_status` enum + products + `is_default` |
| 3 | `catalog/005_catalog_product_varieties.sql` | Varieties table |
| 4 | `catalog/006_catalog_product_translations.sql` | Multilingual extension (§3.8) |
| 5 | `catalog/007_catalog_seed_inactive_categories.sql` | Sector seeds |
| 6 | `catalog/008_catalog_seed_coffee_product.sql` | Default ACTIVE coffee product ± varieties |
| 7 | `marketplace/010_listings_add_product.sql` | Nullable `product_id` |
| 8 | `marketplace/011_listings_backfill_coffee_product.sql` | Backfill coffee listings |
| 9 | Prisma + API | Additive |
| 10 | Staging verify | Optional later `product_id NOT NULL` |

Non-coffee listing create remains blocked until category + product active **and** listing validation supports that commodity.

---

## 8. Backward compatibility (Expo)

| Check | Guarantee |
|-------|-----------|
| Create without product/category codes | Defaults to coffee default product |
| Required coffee fields | Unchanged |
| Response shape | Additive fields only |
| Existing filters / orders / certs | Untouched |
| Apps still on staging until smoke | Unchanged operational rule |

**Compat risk residual:** If any client **strictly** rejects unknown JSON keys (unusual for Expo), additive fields would break — mitigated by matching team’s existing Phase 2 additive category fields pattern (already shipped).

---

## 9. Seed data

### 9.1 Coffee (active)

| code | category | unit | status | is_default |
|------|----------|------|--------|------------|
| `ETHIOPIAN_ARABICA_COFFEE` | `COFFEE` | `KG` | `ACTIVE` | true |

Optional varieties: `HEIRLOOM`, `BOURBON`, `TYPICA` (listings keep free-text `variety` for now).

### 9.2 Inactive categories (seed now)

| code | Notes |
|------|--------|
| `CEREALS` | Teff, maize, wheat, sorghum, barley, … |
| `PULSES` | |
| `OILSEEDS` | Sesame, niger seed, … |
| `SPICES` | |
| `FRUITS` | |
| `VEGETABLES` | |
| `LIVESTOCK` | |
| `DAIRY` | |
| `HONEY` | |
| `FISHERIES` | Added in v1.1 |
| `FORESTRY` | Added in v1.1 |
| `OTHER` | Catch-all |

Activate later with SQL + product inserts — no redesign.

### 9.3 Future products (examples — not required in Phase 3)

`TEFF`, `SESAME`, `HONEY_NATURAL`, `CATTLE`, `FRESH_MILK`, `TILAPIA`, `EUCALYPTUS_TIMBER`, …

---

## 10. Risks, assumptions, normalization notes

### Assumptions

- Expo ignores unknown response fields (consistent with Phase 2).
- One default **ACTIVE** product per category is enough for Phase 3 defaulting.
- Coffee enums remain until an approved attributes migration phase.
- `en`/`am` columns remain the API default; additional Ethiopian languages use `product_translations`.

### Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Dual `category_id` + `product_id` drift | Always set category from product in service; reject mismatches |
| `attributes_schema` mistaken for finished design | §0 + §3.6; leave column nullable unused for coffee |
| `quantity_kg` naming vs HEAD/LITER | Product `default_unit_code` + later unit-aware listing columns |
| Over-building attributes now | No attribute DDL in Phase 3 |
| Under-building attributes forever | Explicit follow-on phase after Phase 3 catalog lands |

### Normalization stance

- **Normalize:** categories, products, varieties, units (reference data).
- **Denormalize carefully:** listing `category_id` (index/filter performance).
- **Defer:** attribute EAV/values until needed; don’t invent per-commodity child tables (`coffee_listings`, `livestock_listings`) — that causes redesign.

---

## 11. Implementation order (only after design approval)

1. Schema SQL (units → products → varieties → translations → category seeds → coffee seed)  
2. Listings `product_id` + backfill  
3. Prisma map + generate  
4. API  
5. Tests  
6. Documentation  

---

## 12. Approval checklist

- [x] Category → Product → Variety → Listing spine accepted for multi-sector Ethiopia use  
- [x] Value-chain integration map accepted (Product as hub)  
- [x] Phase 3 DDL scope accepted (units, products+status, varieties, translations, listing.product_id, seeds)  
- [x] Attribute strategy accepted: coffee columns now; normalized attribute tables later (§3.6)  
- [x] Product lifecycle statuses accepted (`ACTIVE` / `INACTIVE` / `COMING_SOON` / `DISCONTINUED`)  
- [x] Multilingual strategy accepted (`name_en`/`name_am` + `product_translations`)  
- [x] Mobile backward-compatibility strategy accepted  
- [x] Implementation authorized (SQL → Prisma → API → tests → docs)  

**Approver:** Product owner **Date:** 2026-07-14
