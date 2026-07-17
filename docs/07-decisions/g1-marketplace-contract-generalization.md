# G1 — Marketplace Contract Generalization

**Status:** Implemented & validated on staging (2026-07-17) — production unchanged  
**Date:** 2026-07-17  
**Phase:** Commodity generalization G1 (pre-Buyer)  
**Parent:** `commodity-generalization-architecture-review.md`  
**Milestone tag:** `milestone-g1-marketplace-contract`  
**PR:** https://github.com/Tesfayesus40/nahu-platform/pull/11  
**Constraint:** Production unchanged until explicitly approved  

**Approved product direction (incorporated):**
- Commodity Extension Framework (Coffee = first extension)
- Quality / grade / certification as generic concepts where possible
- Flexible units + optional packaging from day one
- Platform brand: **Nahu Farms**; coffee experience: **Nahu Buna Gebeya** until broader cutover

---

## 1. Goal

Make the marketplace listing/order contract **commodity-capable** so Buyer can be built without baking coffee into search, cards, checkout, or certificates — while every existing coffee client keeps working.

Coffee remains the only **activated** sellable category. Non-coffee sell-through stays deferred.

---

## 2. Commodity Extension Framework

### Principle

```
Listing Core (generic, all commodities)
    └── Extension Payload (per category / product family)
            ├── COFFEE   (first implementation)
            ├── CEREALS  (future)
            ├── HONEY    (future)
            └── …
```

Extensions are **not** separate microservices in G1. They are:

1. A **documented contract** for which attributes belong to which category  
2. **API response shaping** (`core` + `extensions.<CATEGORY>`)  
3. **Server validation rules** keyed by `categoryCode`  
4. Later: normalized `attribute_definitions` / `listing_attribute_values` (G3)

### Generic vs extension attributes

| Concept | Layer | G1 treatment |
|---------|-------|--------------|
| Product / category | Core | Already on listing |
| Quantity + unit + price/unit | Core | **Add columns** |
| Optional packaging | Core | **Add columns** |
| Location (region, woreda, farm, lot) | Core | Keep free-text / FKs as today |
| Photos, status, harvest/offer date | Core | Keep |
| **Quality grade** | **Generic concept** | Keep listing `grade` column; treat as **quality grade code** scoped by category (coffee codes today; other categories later). API field: `qualityGrade` (alias `grade` for compat) |
| **Certification** | **Generic concept** | Certificates stay order-linked; wording becomes product-origin; coffee-only fields live under `extensions.coffee` until cert schema generalizes |
| Process method | Coffee extension | Stay on listing; required only for COFFEE |
| Cup score | Coffee extension | Stay optional coffee field |
| Washing station | Coffee extension | Stay optional coffee field |
| Coffee cooperative (as processing provenance) | Coffee extension | Optional text; distinct from generic seller cooperative later |
| Altitude as coffee quality signal | Coffee extension | Optional; farm altitude remains generic farm field |

### Extension registry (design contract — G1 docs + API, not a new DDL table)

| Category | Extension key | Required attrs | Optional attrs |
|----------|---------------|----------------|----------------|
| `COFFEE` | `coffee` | `qualityGrade`, `processMethod` | `cupScore`, `washingStation`, `cooperative`, `altitudeM`, `variety` |
| Others | — | none in G1 | — |

Future categories register the same way without redesigning Listing core.

---

## 3. Listing model (G1 DDL)

### Additive columns on `marketplace.listings`

| Column | Type | Notes |
|--------|------|-------|
| `quantity` | `NUMERIC(12,3) NULL` | Canonical offered qty |
| `unit_code` | `VARCHAR(20) NULL` → `catalog.units(code)` | e.g. KG, LITER, HEAD, PIECE, DOZEN |
| `price_per_unit` | `NUMERIC(12,2) NULL` | Price in ETB per `unit_code` |
| `packaging_label` | `VARCHAR(100) NULL` | e.g. "crate", "jar", "tray", "seedling bag" |
| `packaging_quantity` | `NUMERIC(12,3) NULL` | Units contained per package (optional) |

Keep existing:
- `quantity_kg`, `price_per_kg` (compat dual-write for coffee/legacy clients)
- `grade`, `process_method`, … (coffee extension storage for now)

### Backfill

```
quantity        := quantity_kg
unit_code       := 'KG'
price_per_unit  := price_per_kg
```

For all existing rows.

### Extra unit seeds (catalog)

Add if missing: `DOZEN`, `JAR`, `TRAY`, `BUNDLE`, `SEEDLING` (COUNT/OTHER as appropriate) so honey jars, egg trays, vegetable bundles, and seedlings do not require redesign.

### Orders / certificates (G1)

- Orders continue to store `quantity_kg` for coffee path; **additive** acceptance of unit-aware qty when listing uses non-KG (detail in API section — may dual-store for coffee).
- Certificates: **no breaking DDL in G1**. Response shaping adds product/unit display fields; coffee process/grade remain available for coffee orders. Broader cert generalization = later phase.

---

## 4. API contract (G1)

### Create / update listing

Accept **either**:

**A. Modern (preferred):**
```json
{
  "productCode": "ETHIOPIAN_ARABICA_COFFEE",
  "quantity": 40,
  "unitCode": "KG",
  "pricePerUnit": 280,
  "packagingLabel": null,
  "packagingQuantity": null,
  "qualityGrade": "GRADE_1",
  "processMethod": "WASHED",
  "region": "…",
  "extensions": {
    "coffee": {
      "cupScore": 86,
      "washingStation": "…",
      "cooperative": "…",
      "altitudeM": 1900,
      "variety": "Heirloom"
    }
  }
}
```

**B. Legacy (compat):**
```json
{
  "quantityKg": 40,
  "pricePerKg": 280,
  "grade": "GRADE_1",
  "processMethod": "WASHED",
  …
}
```

Service rules:
1. Resolve product → category.  
2. If modern fields present, write unit columns; if coffee + KG, also fill `quantity_kg` / `price_per_kg`.  
3. If only legacy kg fields, write both kg and unit columns (`unit_code=KG`).  
4. **COFFEE:** require `qualityGrade`/`grade` + `processMethod`.  
5. Non-COFFEE (when activated later): do not require coffee extension fields.  
6. Flat legacy fields (`washingStation`, `cupScore`, …) still accepted and mapped into coffee extension storage.

### Listing response (additive)

```json
{
  "id": "…",
  "productCode": "ETHIOPIAN_ARABICA_COFFEE",
  "categoryCode": "COFFEE",
  "quantity": 40,
  "unitCode": "KG",
  "pricePerUnit": 280,
  "packagingLabel": null,
  "packagingQuantity": null,
  "qualityGrade": "GRADE_1",
  "quantityKg": 40,
  "pricePerKg": 280,
  "grade": "GRADE_1",
  "processMethod": "WASHED",
  "extensions": {
    "coffee": {
      "processMethod": "WASHED",
      "cupScore": 86,
      "washingStation": "…",
      "cooperative": "…",
      "altitudeM": 1900,
      "variety": "Heirloom"
    }
  }
}
```

Buyer and new Farmer clients should prefer `quantity` / `unitCode` / `pricePerUnit` + `extensions`.

---

## 5. Explicitly out of scope for G1

- Activating non-coffee categories for sell-through  
- Full attribute DDL (`attribute_definitions`) — stays G3  
- Dropping `quantity_kg` / coffee enum columns  
- Geography master module  
- Renaming production apps / production deploy  
- Buyer full UI implementation (starts after G1 is on staging)  
- Deep certificate schema rewrite  

---

## 6. Implementation workflow (this phase)

| Step | Deliverable |
|------|-------------|
| 1. Architecture | This document + updated parent review |
| 2. Review / Approval | Product sign-off on G1 |
| 3. SQL | `012_listings_unit_fields.sql` (+ unit seeds if needed) on **staging only** after merge path |
| 4. Prisma | Map new columns |
| 5. API | DTOs, validation by category, dual-write, response shaping |
| 6. Tests | Unit/service tests for coffee legacy + modern unit path |
| 7. Documentation | API README + decision status → Approved/Implemented |
| 8. Staging | Apply migration; smoke create/list listing |
| 9. Mobile | Minimal Farmer compat (still legacy OK); no Buyer build yet unless smoke needs it |
| 10. APK | Only if Farmer must verify dual-write; else defer to Buyer kickoff |
| 11. Validation → Commit → PR → Merge → Tag | `milestone-g1-marketplace-contract` (proposed) |

Production: **no deploy** until explicit approval.

---

## 7. Approval checklist

Please confirm:

- [ ] Commodity Extension Framework as described (Coffee = first extension)  
- [ ] Quality grade + certification treated as generic concepts; process/cup/washing station = coffee extension  
- [ ] G1 adds `quantity`, `unit_code`, `price_per_unit`, `packaging_label`, `packaging_quantity`  
- [ ] Legacy kg fields dual-written for coffee compatibility  
- [ ] Non-coffee sell-through still deferred  
- [ ] Proceed to **SQL → Prisma → API → …** after this approval  
- [ ] Production remains frozen  

---

## 8. Branding

| Layer | Name |
|-------|------|
| Platform | Nahu Farms |
| Coffee marketplace experience | Nahu Buna Gebeya (until broader brand transition) |
