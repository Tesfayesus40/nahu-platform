# Phase 4.3 — Warehouse Readiness Design

**Status:** Draft — awaiting review and approval (design only; **no implementation authorized**)  
**Date:** 2026-07-15  
**Parent:** [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (Approved)  
**Depends on:** Phase 3 Product Catalog · Phase 4.1 Farm Management · Phase 4.2 Inventory (**closed** — staging validated; production promotion separate)  
**Next after this slice (if approved):** Implement 4.3 → then consider 4.4 Listing↔stock  

**Implementation gate:** **Closed** until this design is reviewed and approved. Do **not** create SQL migrations, Prisma models, Nest modules, or mobile UI for warehouse until authorization is explicit.

**Production:** Remains unchanged until a future production promotion is explicitly approved.

---

## 0. Purpose of this document

Define **warehouse readiness** for Nahu Farm so inventory lots can sit at a named **storage location** without building a full WMS.

This document is **architecture-first**. It is the sole deliverable until approved.

---

## 1. Business objectives and scope

### 1.1 Objectives

1. Give farmers (and later cooperatives) a first-class **storage site** concept distinct from farm geography and marketplace offers.
2. Allow inventory lots to be **located** at a storage site (on-farm store, cooperative warehouse, later Nahu/3PL).
3. Preserve append-only inventory truth from Phase 4.2 — location changes are **movements** (or explicit location updates with audit), not silent row rewrites of history.
4. Stay multi-commodity-ready via `catalog.products` (coffee first).
5. Remain additive for Expo Farmer (`/api/v1`); no Buyer app changes required in 4.3.

### 1.2 In scope (proposed 4.3 build — after approval)

| Area | Proposal |
|------|----------|
| Schema | `warehouse` (or `warehouse` tables under agreed schema name) with **storage sites** |
| Site types | At least: `ON_FARM`, `COOPERATIVE`, `NAHU`, `THIRD_PARTY` |
| Links | Optional `farm_id` (for on-farm stores); optional cooperative id when available |
| Lot location | Assign / move lot to a storage site; clear display on lot + balances filters |
| Lifecycle | Site status `ACTIVE` / `INACTIVE` (align with farm/product patterns) |
| Auth | Same farm-party rules as 4.1/4.2 for farmer-owned sites; coop actor thin/partial if schema-ready |
| API | CRUD (farmer) for “my” sites; assign lot ↔ site; list lots by site |
| Mobile | **Out of this design’s implementation gate** — Farmer UI additive later (mapping item M7); API-first OK |

### 1.3 Out of scope (explicit)

| Deferred | Phase / track |
|----------|----------------|
| Bin / rack / zone picking | Later WMS |
| Barcode / RFID / weighing scale integration | Later |
| Cold-chain sensors | Later |
| Full 3PL billing / SLAs | Later |
| Auto-reserve on listing create | **4.4** |
| Nahu Delivery dispatch from warehouse | **Phase 5** |
| Buyer-facing warehouse UX | Not planned for 4.3 |
| Production Nest/mobile cutover | Separate ops gate |
| Live payment stock release | Later |

---

## 2. Positioning in the value chain

```
Identity → Catalog (Product) → Farm / Plot → Inventory (lots + movements)
                                              ↓
                                    Warehouse (storage sites)  ← 4.3
                                              ↓
                         Listing ↔ stock reserve (4.4) → Order → Delivery (5)
```

**Invariants (unchanged):**

- Stock is of a **Product**, never a Category alone.
- Farm ≠ Product; Farm ≠ Warehouse.  
  - Farm = production / ownership context  
  - Warehouse site = **where holding**  
  - Inventory lot = **what + how much**
- Marketplace listing remain offers until 4.4 binds/reserves stock.

---

## 3. Domain model (proposed)

### 3.1 Storage site (`warehouse.storage_sites` — names indicative)

| Field (indicative) | Notes |
|--------------------|-------|
| `id` | UUID |
| `code` | Optional short code |
| `name` / `name_am` | Display |
| `site_type` | `ON_FARM` \| `COOPERATIVE` \| `NAHU` \| `THIRD_PARTY` |
| `status` | `ACTIVE` \| `INACTIVE` |
| `farm_id` | Optional FK → `farms.farms` (required when type = ON_FARM) |
| `cooperative_id` | Optional; nullable until cooperatives entity matures |
| `region` / zone / woreda | Text locality (consistent with farms) |
| `centroid_lat` / `centroid_lng` | Optional |
| `capacity` + `capacity_unit_code` | Optional; no hard enforcement in 4.3 MVP |
| `notes` | Free text |
| audit | `created_at` / `updated_at` / actor |

### 3.2 Party access

Reuse **farm_parties** where site is tied to a farm. For `COOPERATIVE` / `NAHU` / `THIRD_PARTY` without farm:

- **4.3 MVP recommendation:** Farmer may create `ON_FARM` sites for farms they own; creating standalone COOP/NAHU/3PL sites may be restricted or stubbed until org actors exist.
- Schema should **not** block later coop managers.

### 3.3 Lot ↔ site

Extend `inventory.stock_lots` with nullable `storage_site_id` (additive).

**Location change options (choose in approval):**

| Option | Description | Recommendation |
|--------|-------------|----------------|
| **A** | `PATCH` lot `storageSiteId` + audit row | Simple; weaker ledger trail |
| **B** | Movement type `TRANSFER` / `RELOCATE` that sets site | Stronger; aligns append-only spirit |
| **C** | Hybrid: site set on RECEIVE; later moves via movement | **Recommended** |

Interim Phase 4.2 field `storage_label` remains for free-text until site assigned; 4.3 may keep both (label optional nickname within a site).

### 3.4 What we do **not** model in 4.3

- Bin / shelf / pallet IDs  
- Putaway / pick waves  
- Multi-step ASN receiving against purchase orders  

---

## 4. API sketch (indicative — not for implementation yet)

All under `/api/v1`, camelCase, `{ error }` failures, `FARMER` role unless noted.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/storage-sites/mine` | List sites farmer can use |
| `POST` | `/storage-sites` | Create site |
| `GET` | `/storage-sites/:id` | Detail |
| `PATCH` | `/storage-sites/:id` | Update / deactivate |
| `POST` | `/inventory/lots/:id/relocate` | Move lot to site (or equivalent movement) |
| `GET` | `/inventory/lots?storageSiteId=` | Filter (extend 4.2 query) |
| `GET` | `/inventory/balances?storageSiteId=` | Filter (extend 4.2 query) |

Receive (`POST /inventory/receive`) may accept optional `storageSiteId` once 4.3 ships.

**Buyer:** no new endpoints required.

---

## 5. Module layout (Nest — after approval)

```
apps/api/src/
  warehouse/     # storage sites (new)
  inventory/     # extend lot location + queries
  farms/         # unchanged ownership rules (consume)
  catalog/       # unchanged
```

SQL: `database/migrations/warehouse/` (+ additive inventory column migration).  
Prisma: map `warehouse` schema; keep multiSchema.  
Tests: access control, ON_FARM requires farm_id, relocate validation, filters.

---

## 6. Mobile impact (planning only)

| Client | 4.3 impact |
|--------|------------|
| Farmer Expo | Additive screens later (list sites, pick site on receive/relocate). **Not in this design approval’s build** unless product asks for a thin follow-on. |
| Buyer Expo | None |
| API | Additive; existing inventory clients ignore unknown fields |

Production mobile cutover remains **out of scope**.

---

## 7. Risks and open decisions

| Topic | Options | Recommended default for approval |
|-------|---------|----------------------------------|
| Schema name | `warehouse` vs fold into `inventory` | Separate **`warehouse`** schema (parent Phase 4) |
| Relocate semantics | PATCH vs movement | **Movement-backed relocate (C)** |
| Capacity enforcement | Soft vs hard reject receive | Soft (warn only) in 4.3 |
| Who creates COOP sites | Farmer stub vs admin-only | Farmer **ON_FARM** only in MVP API; other types schema-ready |
| Keep `storage_label` | Drop vs keep | **Keep** optional |
| Mobile in same sprint as API | Yes / API-first | **API-first**; Farmer UI after staging API smoke |

---

## 8. Implementation roadmap (only after approval)

| Step | Deliverable |
|------|-------------|
| 1 | Approve this design (checklist below) |
| 2 | SQL migrations (staging first) |
| 3 | Prisma map + generate |
| 4 | Nest `warehouse` module + inventory extensions |
| 5 | Tests + docs (API README, data dictionary, mapping) |
| 6 | Staging migrate + deploy + smoke |
| 7 | Optional Farmer UI |
| 8 | Production promotion (**explicit separate approval**) |

---

## 9. Staging test plan (post-implement — not now)

1. Create ON_FARM storage site for an owned farm.  
2. Receive stock with `storageSiteId` → lot shows site.  
3. Relocate lot to second site → movement history + new site.  
4. Balances filter by `storageSiteId`.  
5. Other farmer cannot read/relocate site/lot → 404.  
6. Create listing without warehouse fields → still works (4.4 not required).  

---

## 10. Approval checklist

- [ ] Objectives / scope accepted  
- [ ] Out-of-scope (no full WMS / no 4.4 bind) accepted  
- [ ] Storage site types accepted  
- [ ] Lot↔site model + relocate approach accepted  
- [ ] Auth / ON_FARM-only MVP accepted (or alternative specified)  
- [ ] API sketch accepted  
- [ ] API-first (mobile deferred) accepted  
- [ ] Production remains separate accepted  
- [ ] **Implementation authorized** (explicit)

**Approver:** _________________ **Date:** _________________

---

## Related documents

- [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md)  
- [Phase 4.2 — Inventory](phase-4.2-inventory-design.md) (closed / staging validated)  
- [Backend ↔ Mobile feature mapping](../backend-mobile-feature-mapping.md)  
- [Documentation index](../README.md)  

---

*This document does not authorize DDL, Nest code, or mobile implementation until the approval checklist is signed.*
