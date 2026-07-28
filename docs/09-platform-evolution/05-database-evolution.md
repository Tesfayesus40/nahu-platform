# 05 — Database Evolution Plan

**Status:** Planning only  
**Date:** 2026-07-28  
**Parent:** [Platform Evolution index](./README.md)

---

## 1. Guiding rules

1. **Additive migrations first** — never drop coffee columns in the same release that activates cereals.  
2. **Dual-write** until all readers migrate.  
3. **Checksum / manifest** discipline — no editing applied SQL.  
4. Preserve RC1 coffee rows readable by old and new code.

---

## 2. Current state (relevant)

| Object | Coffee bias |
|--------|-------------|
| `marketplace.listings.process_method` | NOT NULL enum |
| `marketplace.listings.grade` | NOT NULL coffee_grade |
| `quantity_kg`, `price_per_kg` | NOT NULL legacy |
| G1 `quantity`, `unit_code`, `price_per_unit` | Present |
| `catalog.categories` | Many sectors seeded **inactive** |
| `catalog.products.attributes_schema` | JSON placeholder — not long-term system |
| Certificates | grade + process_method required |

Delivery / pricing / orders money columns: **leave alone** for multi-ag.

---

## 3. Target schema additions (G2–G3)

### 3.1 Category / product metadata

```text
catalog.marketplace_verticals   -- D1; see doc 15
catalog.categories
  + marketplace_vertical_id UUID FK  -- backfill AGRICULTURE
  + listing_kind VARCHAR  -- GOODS | SUPPLIES | SERVICE
  + sell_enabled BOOLEAN  -- or use feature flags + is_active
  + regulatory_flags JSONB optional
  + tax_class VARCHAR optional  -- D6 metadata only; no tax math in G2

catalog.products
  + keep attributes_schema only as draft aid until G3 live
```

### 3.2 Attribute system (Phase 3 / G3 north star)

```text
catalog.attribute_definitions
  id, category_id?, product_id?, code, data_type,
  is_required, enum_values JSONB, sort_order, is_active, …

marketplace.listing_attribute_values
  listing_id, attribute_definition_id,
  value_text | value_num | value_bool | value_json
```

Optional: `quality_grade_vocabularies` if grade enums proliferate beyond a simple definition row.

### 3.3 Listing softening

| Step | Change |
|------|--------|
| A | Make `process_method`, `grade` **NULLABLE** |
| B | Coffee create path still writes them; cereals leave NULL |
| C | Dual-write coffee attrs into `listing_attribute_values` |
| D | Later: stop requiring physical coffee columns for coffee (read from attrs or keep as generated) |

### 3.4 Variety FK

Add optional `product_variety_id` on listings; keep free-text `variety` dual-write for coffee until clients move.

### 3.5 Certificates

```text
orders.certificate_templates (code, category_id, field_schema JSONB)
orders.origin_certificates
  + template_code
  + attributes_json  -- template snapshot
  -- soften NOT NULL on grade/process when template allows
```

---

## 4. Seed strategy

| Action | When |
|--------|------|
| Keep inactive category seeds | Now |
| Add products for illustrative cereals (TEFF, MAIZE, …) | G2/G5 prep — still inactive sell |
| Attribute definitions for COFFEE mirroring columns | G3 |
| Attribute definitions for CEREALS | Before G5 activation |
| Flip `is_active` / sell flag | G5 only after Admin + mobile ready |

---

## 5. What not to do

- Do not create `coffee_listings` / `cereal_listings` tables.  
- Do not put category-specific columns on `orders.orders` money tables.  
- Do not couple `delivery.shipments` to coffee enums.  
- Do not delete kg columns until mobile + reports confirmed.

---

## 6. Migration risk register

| Risk | Mitigation |
|------|------------|
| NULL coffee cols break old NOT NULL assumptions in code | Ship API validation before DDL soften |
| Attribute backfill incomplete | Batch job from coffee columns → attribute values |
| Enum type removal | Leave PG enums; stop using for new categories |
| Large EAV tables | Partial indexes on (listing_id), (definition_id) |

---

## 7. Suggested migration waves

1. **Wave A (G2):** listing_kind + sell metadata; no behaviour change.  
2. **Wave B (G3):** attribute tables; backfill coffee; dual-write writers.  
3. **Wave C:** nullable coffee cols; category validation only.  
4. **Wave D (post multi-ag):** deprecate unused coffee-only constraints; optional view for coffee reports.
