# G2 — Admin Catalog Foundation (Implementation)

**Status:** Implemented (design baseline: Marketplace Engine docs 14–21)  
**Date:** 2026-07-28  
**Scope:** Marketplace Verticals + generic categories/product types + Admin Catalog — **no** attributes, forms, SellerParty, tax, or activation of non-agri sell-through.

---

## 1. Architecture rationale

G2 materializes Document 14’s **Catalog** spine without breaking RC1 coffee:

| Decision | Why |
|----------|-----|
| `marketplace_verticals` first-class | Categories belong to a vertical (D1); future sectors without redesign |
| Seed future verticals **inactive** | Architecture ready; no accidental sell-through |
| Additive API fields (`verticalCode`, `productTypeCode`) | Mobile/Admin clients ignore unknown fields safely |
| Keep `ETHIOPIAN_ARABICA_COFFEE` as default | Omit-`productCode` listing create + existing FKs unchanged |
| Add `GREEN_COFFEE` / `ROASTED_COFFEE` / `GROUND_COFFEE` | Generic product types under COFFEE |
| `sell_enabled` separate from `is_active` | Visibility vs commerce gate |
| `catalog.admin.write.enabled` flag | Freeze taxonomy edits without redeploy |
| No attribute EAV / form schemas | Explicitly out of G2 |

---

## 2. Migrations

| File | Purpose |
|------|---------|
| `catalog/011_catalog_marketplace_verticals.sql` | Verticals table + seed (AGRICULTURE active; others inactive) |
| `catalog/012_catalog_categories_g2_fields.sql` | `marketplace_vertical_id`, `sell_enabled`, `listing_kind`; backfill AGRICULTURE; Oil Crops label |
| `catalog/013_catalog_seed_coffee_product_types.sql` | Green / Roasted / Ground product types |
| `identity/027_identity_catalog_g2_permissions.sql` | `catalog.read` / `catalog.write` |
| `ops/012_ops_catalog_g2_feature_flags.sql` | `catalog.admin.write.enabled` (default true) |

Apply via the normal migration runner / manifest order.

---

## 3. API changes (additive only)

### Public

| Method | Path | Change |
|--------|------|--------|
| GET | `/api/v1/catalog/verticals` | **New** |
| GET | `/api/v1/catalog/verticals/:code` | **New** |
| GET | `/api/v1/catalog/verticals/:code/categories` | **New** |
| GET | `/api/v1/categories` | Adds `verticalCode`, `categoryCode`, `listingKind`, `sellEnabled`, `vertical` |
| GET | `/api/v1/products` | Adds `productTypeCode`, `productCode`, `verticalCode` |
| GET | `/api/v1/listings*` | Adds `verticalCode`, `listingKind`, `productTypeCode` |

No removals. Coffee defaults unchanged.

### Admin

| Method | Path | Permission |
|--------|------|------------|
| GET/PATCH | `/api/v1/admin/catalog/verticals` | read / write |
| GET/POST/PATCH | `/api/v1/admin/catalog/categories` | read / write |
| GET/POST/PATCH | `/api/v1/admin/catalog/products` | read / write |
| GET/POST/PATCH | `/api/v1/admin/catalog/products/:code/varieties` | read / write |

Writes gated by `catalog.admin.write.enabled`.

---

## 4. Admin UI

- Nav: **Catalog** (`catalog.read`)
- Page: `/catalog` — tabs for Verticals, Categories, Products & Varieties
- BFF proxies under `/api/catalog/*`

---

## 5. Mobile impact

- No schema-driven forms; no UI redesign.
- Existing `GET /categories` and `GET /products` remain; new fields are additive.
- Buyer/Farmer continue to use `code` / `categoryCode` / `productCode`.
- Coffee create/list flows unchanged (default product still `ETHIOPIAN_ARABICA_COFFEE`).

Optional later (not required for G2): display `productTypeCode` when present.

---

## 6. Backward compatibility

- Existing listings keep `product_id` → `ETHIOPIAN_ARABICA_COFFEE`.
- Coffee category remains `is_active` + `sell_enabled`.
- Listing coffee columns / extension validation unchanged.
- Category codes remain globally unique (composite uniqueness deferred).

---

## 7. Testing checklist

- [ ] Migrations apply cleanly on empty and staging DBs  
- [ ] `GET /categories?activeOnly=true` returns COFFEE with `verticalCode=AGRICULTURE`  
- [ ] `GET /products?categoryCode=COFFEE` includes legacy default + Green/Roasted/Ground  
- [ ] Create listing without `productCode` still resolves coffee default  
- [ ] Buyer browse/search coffee listings (RC1 path)  
- [ ] Farmer create/edit coffee listing  
- [ ] Admin Catalog: list/toggle verticals; toggle category sell/active; create product/variety  
- [ ] User without `catalog.read` cannot open Catalog nav  
- [ ] Disable `catalog.admin.write.enabled` → writes return 503  
- [ ] `pnpm --filter @nahu-platform/api test:catalog-rules`  

---

## 8. Completion criteria map

| Criterion | Status |
|-----------|--------|
| Coffee marketplace behaves as RC1 | Preserved via default product + dual fields |
| Categories generic | Vertical-owned; agri skeleton present |
| Product types generic | Green/Roasted/Ground + legacy default |
| Agriculture as Marketplace Vertical | Seeded active |
| Future verticals without redesign | Seeded inactive; Admin can activate later |
| Tests | Catalog rules updated |
| Documentation | This guide + pack README |
