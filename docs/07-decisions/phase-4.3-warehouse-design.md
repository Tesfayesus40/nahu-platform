# Phase 4.3 — Warehouse Readiness Architecture

**Status:** **Closed** — implemented on staging + Farmer M7 UI; production held  
**Date:** 2026-07-15 (approved and closed same day)  
**Version:** 1.1  
**Parent:** [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (Approved)  
**Depends on:** Phase 3 Product Catalog · Phase 4.1 Farm Management · Phase 4.2 Inventory (**closed** — staging + Farmer APK validated)  
**Next after approval:** Design → SQL → Prisma → API → Tests → Docs → Staging → Mobile → Production (explicit)

**Implementation gate:** **Closed on staging** — SQL → Prisma → API → Tests → Docs → Staging smoke → Farmer M7. Production promotion remains explicit.

**Production:** Remains unchanged until a future production promotion is explicitly approved.

---

## 0. Purpose and review goals

Define **warehouse readiness** for Nahu Farm: named **storage sites** where inventory lots can be held, without building a full WMS.

This review package is intended so product/engineering can verify:

1. Warehouse ownership model  
2. Multi-warehouse support  
3. Warehouse hierarchy and storage locations  
4. Relationship with Inventory, Farms, and Products  
5. Lot movement and traceability  
6. Integration with future Delivery, Orders, AI, and Analytics  
7. Backward compatibility and migration strategy  
8. Long-term extensibility without redesign  

---

## 1. Business objectives and scope

### 1.1 Objectives

1. Introduce a first-class **Storage Site** (= warehouse readiness unit) distinct from Farm and from Marketplace Listing.  
2. Support **many sites per farmer / org** (multi-warehouse).  
3. Locate inventory lots at a site while preserving Phase 4.2 **append-only** movement truth.  
4. Remain **coffee-first, multi-commodity-ready** via `catalog.products`.  
5. Stay additive to `/api/v1` and Expo Farmer; **no Buyer changes** in 4.3.  
6. Leave clean hooks for Delivery (Phase 5), listing↔stock (4.4), AI, and analytics.

### 1.2 In scope (build after approval)

| Area | Proposal |
|------|----------|
| Schema | Separate PostgreSQL schema **`warehouse`** |
| Entity | `storage_sites` (+ optional thin `storage_zones` stub table, unused by API in MVP) |
| Site types | `ON_FARM`, `COOPERATIVE`, `NAHU`, `THIRD_PARTY` |
| Ownership | Site access via farm parties and/or future `warehouse_parties` |
| Lot location | Activate FK `inventory.stock_lots.storage_site_id` (column already reserved in 4.2) |
| Relocate | Movement-backed relocate (extend inventory movements) |
| API | Farmer storage-site CRUD + receive/relocate/filter by site |
| Mobile | API-first; Farmer UI additive after staging API smoke |

### 1.3 Out of scope

| Deferred | When |
|----------|------|
| Bin / rack / pallet picking, putaway waves | Later WMS |
| Barcode / RFID / scale / cold-chain IoT | Later |
| 3PL billing / SLAs | Later |
| Auto-reserve on listing | **4.4** |
| Dispatch from warehouse to buyer | **Phase 5 Delivery** |
| Buyer warehouse UX | Not planned |
| Production Nest/mobile cutover | Separate ops gate |

---

## 2. Positioning in the platform

```
Identity
    ↓
Catalog.Product  (what)
    ↓
Farms.Farm / Plot  (where produced / ownership context)
    ↓
Inventory.StockLot + StockMovement  (how much; ledger truth)     ← 4.2 closed
    ↓
Warehouse.StorageSite  (where held)                             ← 4.3
    ↓
Listing ↔ Reservation (optional)  → Order → Delivery            ← 4.4 / Phase 5
    ↓
AI / Analytics / Certificates  (read facts from above)
```

### Separation of concerns (invariant)

| Concept | Answers | Owns |
|---------|---------|------|
| **Product** | What SKU? | `catalog` |
| **Farm / Plot** | Where produced / who has rights to production place? | `farms` |
| **Storage site** | Where is stock sitting now? | `warehouse` |
| **Lot + movements** | How much, what history? | `inventory` |
| **Listing / Order** | What is offered / sold? | `marketplace` / `orders` |

**Farm ≠ Warehouse ≠ Product.** A farm may have zero or many on-farm stores; a cooperative warehouse may hold lots from many farms later without redesign.

---

## 3. Ownership model

### 3.1 Principles

1. **Every storage site has an access policy** — never world-readable.  
2. **MVP (4.3 API):** farmers manage sites they are entitled to via **farm membership** (`farms.farm_parties` for `ON_FARM`).  
3. **Schema-ready for org actors:** cooperatives / Nahu / 3PL can own or manage sites later without renaming tables.  
4. Ownership of **stock** remains on the lot’s **farm_id** + product (4.2). The site answers **location**, not title to land.

### 3.2 Access rules (MVP)

| Site type | Create / manage (MVP) | Who may place lots there |
|-----------|------------------------|---------------------------|
| `ON_FARM` | Farmer with OWNER/OPERATOR (writable) party on `farm_id` | Same farmers who can move that farm’s inventory |
| `COOPERATIVE` | Schema allows `cooperative_id`; **API create deferred** or admin-only stub | Later coop manager roles |
| `NAHU` | Platform-provisioned later | Later |
| `THIRD_PARTY` | Schema-ready; API deferred | Later |

**Recommendation for approval:** MVP API = **`ON_FARM` only** create/list/update. Other types exist in enum + nullable FKs so multi-warehouse of mixed types does not require redesign.

### 3.3 Optional `warehouse_parties` (schema now or next)

To avoid overloading farm_parties for non-farm sites, propose:

```
warehouse.warehouse_parties
  storage_site_id, party_type (FARMER_PROFILE | COOPERATIVE | USER),
  party_id, role (OWNER | MANAGER | VIEWER), is_primary, active
```

**4.3 choice for approval:**

| Option | Pros | Cons |
|--------|------|------|
| **A — Farm-party only for MVP** | Minimal tables | Coop sites awkward |
| **B — Add `warehouse_parties` DDL in 4.3** | Clean long-term | Slightly more migration |

**Recommended:** **B** — create `warehouse_parties` in 4.3 DDL; MVP API only writes OWNER party for the creating farmer on ON_FARM sites. Matches Phase 4.1 pattern (`farm_parties`) and avoids later table invent.

### 3.4 Deactivation

- Site `status = INACTIVE`: no new receives/relocates into it; existing lots remain until relocated.  
- Soft delete only (no hard delete if lots ever referenced).

---

## 4. Multi-warehouse support

**Yes — first-class.**

| Requirement | Design response |
|-------------|-----------------|
| Farmer with several stores | Many `storage_sites` rows (e.g. home store + cooperative shade) |
| Multiple farms | Each ON_FARM site optionally linked to one `farm_id`; farmer may have sites across farms |
| Shared coop warehouse (future) | One site, many lots from many `farm_id`s; access via warehouse_parties |
| Balances by site | Extend `GET /inventory/balances?storageSiteId=` |
| Lots by site | Extend `GET /inventory/lots?storageSiteId=` |

No “single warehouse per farmer” constraint.

---

## 5. Hierarchy and storage locations

### 5.1 Levels

| Level | 4.3 | Later |
|-------|-----|--------|
| **Storage site** (warehouse) | **Yes — API** | Refinements |
| **Zone / aisle** | Optional stub table `storage_zones` (DDL only, no API) | WMS |
| **Bin / slot** | Not created | WMS |
| **Pallet / container** | Not created | WMS / Delivery |

```
StorageSite
  └── (future) StorageZone
        └── (future) StorageBin
              └── Lot (still inventory.stock_lots; FK deepens later)
```

### 5.2 Lot location fields (inventory)

Already in 4.2 DDL:

- `storage_site_id UUID NULL` — **FK added in 4.3** to `warehouse.storage_sites`  
- `storage_label VARCHAR` — free-text nickname; **kept** (e.g. “Bag A”, shed name inside a site)

4.3 does **not** require zone/bin FKs. Extending later = nullable columns on lot or join table — no redesign of site or lot identity.

### 5.3 Geographic fields

Sites carry region/zone/woreda + optional lat/lng (same style as farms) for maps and logistics scoring later — not mandatory for MVP create.

---

## 6. Relationship with Inventory, Farms, and Products

```
catalog.products ◄──── inventory.stock_lots.product_id     (required)
catalog.units   ◄──── lot + movement unit_code
farms.farms     ◄──── stock_lots.farm_id                   (required today)
farms.plots     ◄──── stock_lots.plot_id                   (optional)
warehouse.storage_sites ◄──── stock_lots.storage_site_id   (optional → preferred when known)
farms.farms     ◄──── storage_sites.farm_id                (when site_type = ON_FARM)
```

| Rule | Statement |
|------|-----------|
| Product hub | Site never replaces Product; lots always have `product_id` |
| Farm provenance | Lot keeps `farm_id` even when stored at a coop/NAHU site (title/ops context) |
| Site location | Lot’s `storage_site_id` is current hold location |
| Consistency | ON_FARM site’s `farm_id` should match lot’s farm when relocating onto that site (MVP validation); relax later for cross-farm coop stores with explicit policy |

---

## 7. Lot movement and traceability

### 7.1 Preserve 4.2 ledger

- `stock_movements` remain append-only.  
- Qty changes only via movements.  
- Relocate **must not** silently UPDATE history rows.

### 7.2 Relocate model (recommended)

**Option C — Hybrid (recommended for approval):**

1. **Receive:** optional `storageSiteId` on `POST /inventory/receive` sets lot location at creation (with RECEIVE movement).  
2. **Later relocate:** `POST /inventory/lots/:id/relocate` (or movement type `RELOCATE` / extend `TRANSFER_*`) inserts a movement and updates `storage_site_id` in the same transaction.  
3. Movement payload records `from_storage_site_id` / `to_storage_site_id` (JSON detail or dedicated columns — prefer columns if migration is cheap).

Qty may stay unchanged on pure relocate (qty delta 0) **or** combine with farm transfer when moving between farms — keep pure relocate qty-neutral for clarity.

### 7.3 Traceability path

```
Lot → ordered movements (RECEIVE, ADJUST_*, TRANSFER_*, RELOCATE, LOSS, …)
    → each movement optional: listing_id, order_id, storage sites
    → later: dispatch (Delivery), certificate cite lot_id
```

Analytics / AI can answer: *where was this lot, when, under which product and farm?*

### 7.4 New / extended movement type

| Approach | Notes |
|----------|--------|
| Add `RELOCATE` to `inventory.movement_type` | Clearest semantics |
| Reuse `TRANSFER_OUT`/`IN` with same farm | Overloaded |

**Recommended:** add **`RELOCATE`** enum value in 4.3.

---

## 8. Integration with future modules

### 8.1 Orders & listing↔stock (4.4)

- Reservations already DDL’d in 4.2.  
- 4.4 may prefer reserving lots that are `AVAILABLE` at a given site; site becomes a filter, not a redesign.  
- Warehouse does **not** create orders.

### 8.2 Delivery (Phase 5)

- Dispatch should leave from a **storage site** (and later bin).  
- Design hook: future `DISPATCH` movement carries `storage_site_id` + `order_id`.  
- 4.3 only ensures sites exist and lots can be located — no routing.

### 8.3 AI Advisory

- Grounding features: site type, region, distances (later), stock age at site, congestion (capacity soft).  
- No AI API changes in 4.3.

### 8.4 Analytics / dashboards (4.6)

- Read models: stock by product × farm × **site**.  
- Prefer SQL views over denormalized warehouse tables.  
- Events: relocate movements are first-class facts.

### 8.5 Certificates

- Origin certs remain order-based today.  
- Future: certificate can cite `lot_id` (+ site at shipment) — additive.

---

## 9. Backward compatibility and migration strategy

### 9.1 Why this is low-risk

| Fact | Implication |
|------|-------------|
| `stock_lots.storage_site_id` already exists, **NULL**, commented for 4.3 | Additive FK only |
| `storage_label` already used | Keep; no breaking rename |
| Inventory APIs ignore unknown fields on clients | Farmer app continues without warehouse UI |
| Listings/orders unchanged | Buyer/Farmer marketplace flows untouched |

### 9.2 Migration steps (after approval — staging first)

1. Create schema `warehouse` + enums + `storage_sites` + `warehouse_parties` (+ optional `storage_zones` stub).  
2. `ALTER TABLE inventory.stock_lots ADD CONSTRAINT fk_storage_site …` (column exists).  
3. Optionally add relocate movement columns / enum value.  
4. Deploy Nest `warehouse` module + inventory extensions.  
5. Existing lots remain `storage_site_id = NULL` until receive/relocate — **valid state**.  
6. Production: only after explicit promotion approval (not part of design approval).

### 9.3 Mobile

- No forced app release for 4.3 API.  
- Additive fields on lot JSON (`storageSiteId`, `storageSiteName`).  
- Farmer UI when ready (mapping M7); Expo production URL unchanged until cutover.

### 9.4 Idempotency / offline

- Same as 4.2: server validates site access; clients may queue relocates offline with retry.

---

## 10. Long-term extensibility (no redesign)

| Future need | How 4.3 absorbs it |
|-------------|-------------------|
| Zones / bins | Child tables under site; lot FKs deepen, site stays |
| Coop-managed warehouses | `warehouse_parties` + COOPERATIVE type already in enum |
| Cross-farm store | Drop MVP “site.farm_id == lot.farm_id” check via policy flag |
| Capacity hard limits | Soft field exists; enforce later |
| Multi-tenant 3PL | THIRD_PARTY type + parties |
| Delivery pick lists | Query lots by site (+ later bin) |
| IoT temp sensors | Side table keyed by `storage_site_id` |
| Flutter clients | Same REST shapes |

**Non-goals that would force redesign (explicitly avoided):** collapsing warehouse into farm rows; putting location only in free-text forever; storing qty on the site instead of the lot ledger.

---

## 11. Domain model detail (indicative DDL intent)

### 11.1 `warehouse.storage_sites`

| Column | Notes |
|--------|-------|
| `id` | UUID PK |
| `code` | Optional unique per owner scope |
| `name` / `name_am` | Required display |
| `site_type` | Enum |
| `status` | ACTIVE / INACTIVE |
| `farm_id` | NULL unless ON_FARM (then required) |
| `cooperative_id` | NULL; future |
| locality + geo | Optional |
| `capacity` / `capacity_unit_code` | Optional soft |
| `notes` | Optional |
| audit timestamps | Yes |

### 11.2 `warehouse.warehouse_parties`

As in §3.3.

### 11.3 Inventory additive

- FK on `storage_site_id`  
- Enum `RELOCATE`  
- Optional `from_storage_site_id` / `to_storage_site_id` on movements  

---

## 12. API sketch (indicative — not for implementation yet)

`/api/v1`, camelCase, `{ error }` body, roles uppercase.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/storage-sites/mine` | Sites farmer can use |
| POST | `/storage-sites` | Create (MVP: ON_FARM) |
| GET | `/storage-sites/:id` | Detail |
| PATCH | `/storage-sites/:id` | Update / deactivate |
| POST | `/inventory/receive` | Optional `storageSiteId` (extend) |
| POST | `/inventory/lots/:id/relocate` | `{ storageSiteId, reason? }` |
| GET | `/inventory/lots` | + `storageSiteId` query |
| GET | `/inventory/balances` | + `storageSiteId` query |

**Buyer:** no new endpoints.

---

## 13. Nest module layout (after approval)

```
apps/api/src/warehouse/     # sites + parties
apps/api/src/inventory/     # relocate + filters + receive site
database/migrations/warehouse/
```

Thin controllers; SQL-first; Prisma multiSchema; mobile-compatible errors.

---

## 14. Mobile impact (planning only)

| Client | 4.3 |
|--------|-----|
| Farmer | Optional later: site list, pick site on receive/relocate |
| Buyer | None |
| Contract | Additive JSON fields only |

API-first recommended in the same workflow step order you specified.

---

## 15. Risks and decisions for approval

| Topic | Recommendation |
|-------|----------------|
| Schema | Separate **`warehouse`** |
| Parties table | **Include `warehouse_parties` in 4.3 DDL** |
| MVP create API | **ON_FARM only** |
| Relocate | **Movement + `RELOCATE` enum** |
| `storage_label` | **Keep** |
| Capacity | Soft; no hard block in MVP |
| Cross-farm coop store | Schema yes; validation rule later |
| Mobile in same sprint | After staging API smoke |
| Production | Separate approval |

---

## 16. Implementation roadmap (only after approval)

| Step | Deliverable |
|------|-------------|
| 1 | Design approved (checklist) |
| 2 | SQL (staging first) |
| 3 | Prisma generate |
| 4 | Nest warehouse + inventory extensions |
| 5 | Tests + docs |
| 6 | Staging migrate + deploy + smoke |
| 7 | Farmer mobile (optional) |
| 8 | Production promotion (**explicit**) |

Workflow: **Design → Review → Approval → SQL → Prisma → API → Tests → Documentation → Staging → Mobile → Production.**

---

## 17. Staging test plan (post-implement — not now)

1. Create two ON_FARM sites on an owned farm.  
2. Receive coffee lot into site A → lot.storageSiteId = A.  
3. Relocate to site B → RELOCATE movement; site B current.  
4. Balances/lots filter by site.  
5. Other farmer: 404 on site and lot.  
6. Listing create without warehouse fields still works.  
7. Lot with NULL site still listable (pre-4.3 data).  

---

## 18. Approval checklist

- [x] **Ownership model** accepted (ON_FARM MVP + warehouse_parties DDL)  
- [x] **Multi-warehouse** accepted (many sites; filters by site)  
- [x] **Hierarchy** accepted (Site now; Zone/Bin later without redesign)  
- [x] **Relationships** with Inventory / Farms / Products accepted  
- [x] **Lot movement & traceability** (RELOCATE + append-only) accepted  
- [x] **Future Delivery / Orders / AI / Analytics** hooks accepted  
- [x] **Backward compatibility & migration** accepted (`storage_site_id` already reserved)  
- [x] **Long-term extensibility** accepted  
- [x] Out-of-scope (no full WMS / no 4.4 bind / no Production cutover) accepted  
- [x] API-first mobile sequencing accepted  
- [x] **Implementation authorized** (explicit — unlocks SQL)

**Approver:** Product owner **Date:** 2026-07-15

---

## Related documents

- [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md)  
- [Phase 4.1 — Farm management](phase-4.1-farm-management-design.md)  
- [Phase 4.2 — Inventory](phase-4.2-inventory-design.md) (**closed**)  
- [Backend ↔ Mobile feature mapping](../backend-mobile-feature-mapping.md)  
- [Documentation index](../README.md)  

---

*This document does not authorize DDL, Nest code, or mobile implementation until the approval checklist is signed.*
