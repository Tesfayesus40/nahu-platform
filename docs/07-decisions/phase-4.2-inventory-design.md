# Phase 4.2 — Inventory Design

**Status:** Approved — implementation authorized  
**Date:** 2026-07-15 (approved same day)  
**Parent:** [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (Approved)  
**Depends on:** Phase 3 Product Catalog · Phase 4.1 Farm Management (merged / milestone-tagged)  
**Next after this slice:** 4.3 Warehouse readiness · 4.4 Listing↔stock (optional)

**Implementation gate:** Authorized — SQL → Prisma → API → Tests → Docs → Staging → Validation → Production (separate promotion)

---

## 1. Business objectives and scope

### 1.1 Objectives

1. Give farmers a **trusted quantity ledger** of agricultural stock keyed to **`catalog.products`**.
2. Support **lot/batch traceability** from harvest (or receipt) through sale/loss — Ethiopia coffee-first, multi-commodity-ready.
3. Anchor stock to **farms/plots** (where produced or held) without farms owning product master data.
4. Provide an **append-only movement model** suitable for analytics, AI, disputes, and future warehouse/delivery.
5. Keep marketplace listing create **unchanged** in 4.2 (stock↔listing binding is **4.4**).

### 1.2 In scope (4.2 build)

- Schema `inventory` with stock lots, movements, optional reservations table (schema now; bind API in 4.4)
- Farmer APIs: receive/adjust/transfer (farm↔farm or plot), balances, lot detail, movement history
- Coffee and any **ACTIVE** catalog product with a `default_unit_code`
- Unit recording + **same-dimension conversion table** (limited factors)
- Authorization via farm parties (same ownership model as 4.1)

### 1.3 Out of scope (4.2)

| Deferred | Phase |
|----------|--------|
| Full WMS bins / 3PL warehouses | 4.3 |
| Auto-reserve on listing create | 4.4 |
| Cropping-cycle actuals wiring | 4.5 |
| Farmer dashboard aggregates | 4.6 |
| Nahu Delivery dispatch from warehouse | 5 |
| Live payment/escrow stock release webhooks | later |
| Changing listing `quantityKg` / coffee enums | not this slice |
| Mobile redesign (API-first; Expo additive later) | parallel |

---

## 2. Domain invariants

```
catalog.products ──◄── inventory.stock_lots.product_id     (required)
catalog.units    ──◄── lot + movement unit_code
farms.farms      ──◄── stock_lots.farm_id                  (required in 4.2)
farms.plots      ──◄── stock_lots.plot_id                  (optional)
marketplace.listings ──► products (unchanged in 4.2)
         └── (4.4) optional reservation / farm_id / lot_id
```

| Rule | Statement |
|------|-----------|
| **Product hub** | Stock is always of a Product; never of a Category alone |
| **Farm ≠ Product** | Farms locate production/hold; they do not own product types |
| **Listing ≠ Inventory (yet)** | Listings remain offers; binding is optional later (4.4) |
| **Ledger truth** | Balances = computed from movements (or cached qty updated only via movements) |
| **No silent edits** | Corrections = reversing + new movement, not UPDATE on history rows |

---

## 3. Entity relationships

```
FarmerProfile ──party──► Farm ──► Plot
                           │
                           ▼
                     StockLot ──► Product (+ Variety?)
                           │         │
                           │         └── Unit (default)
                           ▼
                    StockMovement (append-only)
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Reservation   Order ref    Transfer pair
           (4.4)       (optional)   (two movements)
```

### 3.1 Core entities

| Entity | Purpose |
|--------|---------|
| **StockLot** | Traceable batch of a product at a farm (optional plot); carries current status + qty |
| **StockMovement** | Immutable event changing lot qty/status or creating lots |
| **Reservation** | Soft hold linking lot qty to a listing/order (DDL in 4.2; APIs in 4.4) |
| **UnitConversion** | Factor between units of the **same dimension** (MASS↔MASS, etc.) |

### 3.2 Future Warehouse (4.3) — reserved columns

```text
stock_lots.storage_site_id  UUID NULL  -- FK added when warehouse.storage_sites exists
```

4.2 may store a free-text `storage_label` (e.g. “Home store”, “Coop shade”) without a warehouse FK so farmers can tag location before WMS.

---

## 4. Inventory lifecycle

### 4.1 Lot status (`inventory.lot_status`)

| Status | Meaning | Sellable? |
|--------|---------|-----------|
| `RECEIVED` | Just inducted; pending QC/accept | No (or policy: yes — **default: treat as AVAILABLE on receive** for MVP) |
| `AVAILABLE` | Free for listing/sale/use | Yes |
| `RESERVED` | Held for listing/order | No (held) |
| `QUARANTINE` | Quality/compliance hold | No |
| `DAMAGED` | Unusable / write-down candidate | No |
| `EXPIRED` | Past usable date | No |
| `SOLD` | Fully disposed via sale | No |
| `DEPLETED` | Qty driven to zero by outbound/adjust | No |
| `CANCELLED` | Voided lot (error correction) | No |

**4.2 MVP simplification:** `RECEIVE` movement creates lot directly in **`AVAILABLE`** (skip separate receive step) unless client sends `quarantine: true` → `QUARANTINE`. Status `RECEIVED` remains in enum for future multi-step intake.

### 4.2 Status transitions (allowed)

```
AVAILABLE ──RESERVE──► RESERVED ──RELEASE──► AVAILABLE
AVAILABLE ──DISPATCH/SALE──► DEPLETED or SOLD (partial: qty↓, status stays AVAILABLE until 0)
AVAILABLE ──DAMAGE/EXPIRE──► DAMAGED / EXPIRED
* ──ADJUST──► qty change; status may become DEPLETED if qty=0
QUARANTINE ──RELEASE_QC──► AVAILABLE
```

Illegal transitions rejected with `{ error }`.

---

## 5. Lot / batch management and traceability

### 5.1 Lot identity

| Field | Role |
|-------|------|
| `id` | UUID PK |
| `lot_code` | Human code unique per farm (or globally unique `FARMCODE-YYYYMMDD-SEQ`) |
| `product_id` | Catalog product |
| `product_variety_id` | Optional |
| `farm_id` / `plot_id` | Provenance / location |
| `harvest_date` / `received_at` | Traceability dates |
| `expires_on` | Optional (dairy, produce) |
| `quality_note` | Free text (grade text for now; attributes later) |
| `source_type` | `HARVEST`, `PURCHASE`, `TRANSFER_IN`, `ADJUSTMENT_OPENING` |
| `external_ref` | Optional washing station ticket / coop receipt |

### 5.2 Traceability chain

- Each movement stores `lot_id`, `qty`, `unit_code`, `reason`, `actor_user_id`, optional `listing_id` / `order_id` / `counterpart_lot_id` (transfers).
- Audit path: lot → movements ordered by `created_at` → related order/listing when bound (4.4+).
- Certificates (existing origin certs) can later cite `lot_id` — additive, not required in 4.2.

---

## 6. Unit handling and conversions

### 6.1 Recording rule

- Every lot and movement has `unit_code` → `catalog.units`.
- Default on receive: product’s `default_unit_code` if client omits unit.
- Unit must share **`dimension`** with product default **or** have a defined conversion factor to that unit.

### 6.2 Conversions (`catalog.unit_conversions`) — 4.2 DDL

```text
from_unit_code, to_unit_code, factor NUMERIC,  -- to = from * factor
UNIQUE(from_unit_code, to_unit_code)
```

Seed examples (illustrative):

| From | To | Factor |
|------|-----|--------|
| `QUINTAL` | `KG` | 100 |
| `BAG` | `KG` | (define carefully or omit until standardized) |

**No cross-dimension conversion** (e.g. LITER ↔ KG) in 4.2.

### 6.3 Balance reporting

Balances return qty in **lot unit** and optionally **normalized qty in product default unit** when conversion exists.

Listing `quantityKg` remains marketplace-specific until a later unit-aware listing phase.

---

## 7. Stock movement model

### 7.1 Movement types (`inventory.movement_type`)

| Type | Effect |
|------|--------|
| `RECEIVE` | Create lot (+qty) or add to lot |
| `ADJUST_IN` / `ADJUST_OUT` | Manual correction |
| `TRANSFER_OUT` / `TRANSFER_IN` | Paired move between lots/locations |
| `RESERVE` / `RELEASE` | Soft hold qty (4.4; type reserved now) |
| `DISPATCH` | Outbound for sale/delivery |
| `LOSS` | Damaged/expired write-off |
| `RETURN` | Rare inbound after outbound |

### 7.2 Movement row (append-only)

```text
id, lot_id, movement_type,
qty (>0), unit_code,
qty_delta signed in lot unit (computed server-side),
reason, actor_user_id,
listing_id?, order_id?, counterpart_movement_id?,
metadata JSONB?,
created_at
```

**Never UPDATE/DELETE movements** in application code. Fix with compensating movement.

### 7.3 Quantity on lot

- `stock_lots.quantity_on_hand` maintained in the **same transaction** as movement insert (performance cache).
- Optional nightly reconcile job compares sum(movements) vs cache (ops, not 4.2 MVP).

---

## 8. Proposed database schema

### 8.1 Schema

```sql
CREATE SCHEMA IF NOT EXISTS inventory;
```

### 8.2 Enums

```sql
CREATE TYPE inventory.lot_status AS ENUM (
  'RECEIVED', 'AVAILABLE', 'RESERVED', 'QUARANTINE',
  'DAMAGED', 'EXPIRED', 'SOLD', 'DEPLETED', 'CANCELLED'
);

CREATE TYPE inventory.movement_type AS ENUM (
  'RECEIVE', 'ADJUST_IN', 'ADJUST_OUT',
  'TRANSFER_OUT', 'TRANSFER_IN',
  'RESERVE', 'RELEASE',
  'DISPATCH', 'LOSS', 'RETURN'
);

CREATE TYPE inventory.lot_source_type AS ENUM (
  'HARVEST', 'PURCHASE', 'TRANSFER_IN', 'ADJUSTMENT_OPENING', 'OTHER'
);
```

### 8.3 `catalog.unit_conversions`

```sql
CREATE TABLE catalog.unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit_code VARCHAR(20) NOT NULL REFERENCES catalog.units(code),
  to_unit_code   VARCHAR(20) NOT NULL REFERENCES catalog.units(code),
  factor         NUMERIC(18,6) NOT NULL CHECK (factor > 0),
  UNIQUE (from_unit_code, to_unit_code)
);
```

### 8.4 `inventory.stock_lots`

```sql
CREATE TABLE inventory.stock_lots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_code            VARCHAR(64) NOT NULL,
  product_id          UUID NOT NULL REFERENCES catalog.products(id) ON DELETE RESTRICT,
  product_variety_id  UUID REFERENCES catalog.product_varieties(id) ON DELETE SET NULL,
  farm_id             UUID NOT NULL REFERENCES farms.farms(id) ON DELETE RESTRICT,
  plot_id             UUID REFERENCES farms.plots(id) ON DELETE SET NULL,
  storage_site_id     UUID,  -- FK deferred to 4.3
  storage_label       VARCHAR(150),
  unit_code           VARCHAR(20) NOT NULL REFERENCES catalog.units(code),
  quantity_on_hand    NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved   NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  status              inventory.lot_status NOT NULL DEFAULT 'AVAILABLE',
  source_type         inventory.lot_source_type NOT NULL DEFAULT 'HARVEST',
  harvest_date        DATE,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_on          DATE,
  quality_note        TEXT,
  external_ref        VARCHAR(100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, lot_code),
  CHECK (quantity_reserved <= quantity_on_hand)
);
```

### 8.5 `inventory.stock_movements`

```sql
CREATE TABLE inventory.stock_movements (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id                  UUID NOT NULL REFERENCES inventory.stock_lots(id) ON DELETE RESTRICT,
  movement_type           inventory.movement_type NOT NULL,
  qty                     NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  unit_code               VARCHAR(20) NOT NULL REFERENCES catalog.units(code),
  qty_in_lot_unit         NUMERIC(14,3) NOT NULL,  -- signed: +in / -out
  reason                  VARCHAR(500),
  actor_user_id           UUID,
  listing_id              UUID,  -- no FK required in 4.2; validate in 4.4
  order_id                UUID,
  counterpart_movement_id UUID REFERENCES inventory.stock_movements(id),
  metadata                JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 8.6 `inventory.reservations` (DDL now; service in 4.4)

```sql
CREATE TABLE inventory.reservations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id      UUID NOT NULL REFERENCES inventory.stock_lots(id),
  listing_id  UUID,
  order_id    UUID,
  qty         NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  unit_code   VARCHAR(20) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RELEASED, CONSUMED
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 9. Integration map

| Module | 4.2 integration |
|--------|-----------------|
| **Product Catalog** | Required `product_id`; unit from `catalog.units` |
| **Farms / Plots** | Required `farm_id`; optional `plot_id`; party-based auth |
| **Listings** | No required change; optional `listing_id` on movements for future |
| **Orders** | Optional `order_id` on movements; consume path in 4.4+/payments |
| **Warehouse (4.3)** | Fill `storage_site_id`; drop reliance on `storage_label` |
| **Delivery (5)** | `DISPATCH` movements when goods leave for buyer |
| **AI / Analytics** | Movement stream = features for advisory & dashboards (4.6) |
| **Cropping cycles (4.5)** | `RECEIVE` with harvest_date attributes against cycle window |

---

## 10. API design (`/api/v1`)

Auth: JWT + `FARMER`; must be active party on the lot’s farm with write role for mutations.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/inventory/lots` | List lots (`farmId`, `productCode`, `status`, pagination) |
| `GET` | `/inventory/lots/:id` | Lot detail + recent movements |
| `GET` | `/inventory/balances` | Aggregates by product/farm (`farmId`, `productCode`) |
| `POST` | `/inventory/receive` | Create lot + `RECEIVE` movement |
| `POST` | `/inventory/movements` | Typed command: adjust / loss / transfer / … |
| `GET` | `/inventory/lots/:id/movements` | Full movement history |

### 10.1 Receive example

```json
POST /inventory/receive
{
  "farmId": "…",
  "plotId": "…",
  "productCode": "ETHIOPIAN_ARABICA_COFFEE",
  "qty": 50,
  "unitCode": "KG",
  "harvestDate": "2026-07-01",
  "sourceType": "HARVEST",
  "qualityNote": "Grade 2 washed",
  "storageLabel": "Home store",
  "lotCode": "optional-or-server-generated"
}
```

Response: lot with `status: AVAILABLE`, `quantityOnHand: 50`.

### 10.2 Adjust example

```json
POST /inventory/movements
{
  "lotId": "…",
  "type": "ADJUST_OUT",
  "qty": 2,
  "reason": "Moisture loss estimate"
}
```

### 10.3 Transfer example

```json
POST /inventory/movements
{
  "lotId": "…",
  "type": "TRANSFER_OUT",
  "qty": 10,
  "toFarmId": "…",
  "toPlotId": null,
  "reason": "Move to second farm store"
}
```

Server creates `TRANSFER_OUT` on source and `TRANSFER_IN` (new or existing lot) on destination, linked by `counterpart_movement_id`.

### 10.4 Errors

Unchanged contract: `{ "error": "…" }` (insufficient qty, wrong unit dimension, no farm access, illegal status).

---

## 11. Prisma model changes (map-only)

- Add schema `inventory` to datasource  
- Models: `StockLot`, `StockMovement`, `Reservation`  
- Enums: `LotStatus`, `MovementType`, `LotSourceType`  
- Model `UnitConversion` under catalog  
- Relations from `Farm` / `Plot` / `Product`  

No Prisma Migrate DDL.

---

## 12. Nest module layout

```
apps/api/src/inventory/
  inventory.module.ts
  inventory.controller.ts
  inventory.service.ts
  dto/receive-stock.dto.ts
  dto/create-movement.dto.ts
  dto/query-lots.dto.ts
```

Register in `AppModule`. Reuse Farms party checks (inject `FarmsService` helper or shared `FarmAccessService`).

---

## 13. Migration strategy

| Step | Artifact |
|------|----------|
| 1 | `catalog/009_catalog_unit_conversions.sql` (+ seed QUINTAL→KG) |
| 2 | `inventory/001_inventory_schema.sql` |
| 3 | `inventory/002_inventory_enums.sql` |
| 4 | `inventory/003_inventory_stock_lots.sql` |
| 5 | `inventory/004_inventory_stock_movements.sql` |
| 6 | `inventory/005_inventory_reservations.sql` |
| 7 | Prisma map + API + tests |
| 8 | Staging apply → smoke → document |
| 9 | Production promotion only after staging + explicit approval |

**Idempotency:** Seeds use `ON CONFLICT DO NOTHING`. DDL CREATE is not re-run-safe (same as prior phases); use pending-file apply on existing DBs.

**Rollback:** Drop `inventory` schema / conversions table; marketplace unaffected.

---

## 14. Backward compatibility

| Surface | Impact |
|---------|--------|
| Listing create / browse / orders | **None** in 4.2 |
| Farmer/Buyer Expo apps | No required release |
| Farms APIs | Unchanged |
| Products APIs | Unchanged |
| New inventory routes | Additive |

Farmers may ignore inventory until UI ships; marketplace remains offer-first.

---

## 15. Future extensibility

| Capability | How 4.2 enables it |
|------------|-------------------|
| **Warehouse** | `storage_site_id` + move lots between sites |
| **Delivery** | `DISPATCH` + order_id linkage |
| **AI** | Movement features (qty, product, farm, season dates) |
| **Analytics / dashboards** | Sum movements / balances APIs |
| **Certification** | Lot id on origin/trace docs |
| **Cropping cycles** | RECEIVE tied to cycle window (4.5) |
| **Multi-commodity** | Any ACTIVE product + unit dimension |

---

## 16. Risks, assumptions, open decisions

### Assumptions

- Farmer always has at least one farm (4.1) before receiving stock.  
- Coffee remains the first practiced commodity; other ACTIVE products allowed.  
- Soft reservations are not enforced against listings until 4.4.  

### Risks

| Risk | Mitigation |
|------|------------|
| Qty drift vs movements | Single transactional update; optional reconcile later |
| BAG weight ambiguity | Don’t seed BAG→KG until business defines factor |
| Premature listing bind | Explicitly out of 4.2 |
| Storage without warehouse | `storage_label` interim |
| Performance of history | Indexes on `lot_id`, `farm_id`, `product_id`, `created_at` |

### Open decisions (defaults proposed)

| Topic | Default for approval |
|-------|----------------------|
| Receive → status | Directly `AVAILABLE` |
| Partial sale status | Lot stays `AVAILABLE` until qty 0 → `DEPLETED` (or `SOLD` if fully sold via order bind) |
| Reservation DDL | Create empty table in 4.2 |

---

## 17. Implementation roadmap (after approval)

| Step | Deliverable |
|------|-------------|
| 1 | SQL migrations (staging first) |
| 2 | Prisma map + generate |
| 3 | Inventory Nest module + DTOs |
| 4 | Unit/service tests (qty math, access, illegal transition) |
| 5 | Docs (API README, data dictionary) |
| 6 | Staging deploy + smoke (receive, balance, adjust, transfer) |
| 7 | On-device optional (no UI required) |
| 8 | Production promotion (explicit) |

---

## 18. Staging test plan (post-implement)

1. Farmer with farm receives 50 KG coffee → lot AVAILABLE  
2. Balances show 50 KG for product  
3. ADJUST_OUT 5 → on hand 45; movement history length 2  
4. Transfer 10 to second farm → source 35, dest lot 10  
5. Other farmer cannot read lot → 404  
6. Receive with LITER for coffee (MASS product) without conversion → error  
7. `POST /listings` without inventory fields → still works  

---

## 19. Approval checklist

- [x] Objectives / scope accepted  
- [x] Lot lifecycle statuses accepted  
- [x] Movement model (append-only) accepted  
- [x] Farm/plot + product integration accepted  
- [x] Unit conversion approach accepted  
- [x] Reservation DDL now / API in 4.4 accepted  
- [x] Listing/order unchanged in 4.2 accepted  
- [x] Implementation authorized  

**Approver:** Product owner **Date:** 2026-07-15

---

*Parent Phase 4 program remains authoritative for 4.3–4.6 sequencing. This document does not authorize DDL or Nest code until approved.*
