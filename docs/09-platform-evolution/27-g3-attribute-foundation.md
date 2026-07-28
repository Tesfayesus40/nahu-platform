# 27 — G3 Attribute Foundation

**Status:** Implemented  
**Date:** 2026-07-28  
**Baseline:** G2.5 freeze · Docs [14](./14-marketplace-engine-design.md), [18](./18-d4-attribute-extension-strategy.md)  
**Out of scope:** Schema-driven forms (G4), SellerParty, tax, payments, non-agri sell activation

---

## 1. What shipped

| Capability | Implementation |
|------------|----------------|
| Attribute definitions | `catalog.attribute_definitions` (CATEGORY/PRODUCT scope) |
| Enumerations | `catalog.attribute_enum_sets` + `attribute_enum_values` |
| Listing values | `marketplace.listing_attribute_values` (text/num/bool/date/json + enum FK) |
| Validation | Pure rules: required, min/max, regex, enum, maxLength |
| Units | Existing `catalog.units` + G3 seeds (G, ML, TONNE, SACK) |
| Coffee dual-write | Columns ↔ attribute values via `legacy_column` |
| Additive APIs | `attributes[]` on listings; definition/unit GETs |
| Sample vertical attrs | Honey, Livestock, Cement, Steel, Electronics, Furniture defs (inactive categories) |

Coffee columns remain the RC1 write/read path. Grade/process softened to **nullable** so future categories need not invent coffee values.

---

## 2. Coffee attribute pack (seeded)

| Code | Type | Required | Legacy column |
|------|------|----------|---------------|
| `quality_grade` | ENUM (COFFEE_GRADE) | Yes | `grade` |
| `process_method` | ENUM (COFFEE_PROCESS) | Yes | `process_method` |
| `variety` | TEXT | No | `variety` |
| `origin_region` | TEXT | Yes* | `region` |
| `washing_station` | TEXT | No | `washing_station` |
| `moisture_pct` | DECIMAL | No | — |
| `screen_size` | TEXT | No | — |
| `altitude_m` | DECIMAL | No | `altitude_m` |
| `cup_score` | DECIMAL | No | `cup_score` |

\*Required in attribute metadata; RC1 clients satisfy via `region` dual-write.

---

## 3. Migrations

| File | Role |
|------|------|
| `catalog/015_catalog_attribute_enum_sets.sql` | Enum sets/values tables |
| `catalog/016_catalog_attribute_definitions.sql` | Definitions |
| `catalog/017_catalog_seed_g3_units.sql` | Extra units |
| `marketplace/019_marketplace_listing_attribute_values.sql` | Values + nullable grade/process |
| `catalog/018_catalog_seed_coffee_attributes.sql` | Coffee enums + defs |
| `catalog/019_catalog_seed_sample_category_attributes.sql` | Inactive category defs |
| `marketplace/020_marketplace_backfill_coffee_attribute_values.sql` | Backfill from columns |

---

## 4. Success criteria map

| Criterion | Met |
|-----------|-----|
| Generic attribute definitions | Yes |
| Generic listing values | Yes |
| Coffee unchanged for mobile | Yes (legacy fields + dual-write) |
| Existing APIs compatible | Yes (additive only) |
| `attributes: []` exposed | Yes |
| No mobile UI redesign | Yes |
| Honey/Livestock/Construction/Retail can define attrs without DDL | Yes (seeded) |

See [28](./28-g3-migration-strategy.md) and [29](./29-g3-api-contract.md).
