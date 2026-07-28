# 18 — D4: Attribute & Extension Strategy

**Status:** Design locked — no production code  
**Resolves:** [12 — Design Validation](./12-design-validation.md) § D4  
**Parent:** [Platform Evolution index](./README.md)  
**Aligns with:** Phase 3 catalog attribute tables, G1 extensions  
**Consumed by:** [14 — Marketplace Engine](./14-marketplace-engine-design.md) · [19 — Form Schema](./19-d5-form-schema-specification.md)

---

## 1. Decision

**Product-specific data is configuration**, not special-purpose listing columns.

| Layer | Role | Longevity |
|-------|------|-----------|
| **Listing core** | Quantity, unit, price, location, media, status, kind, seller, product FKs | Permanent |
| **Attribute definitions + values** | Category/product-specific fields | Canonical write path for new categories (G3+) |
| **`extensions.*` JSON (G1)** | Compat read/write for coffee family packs | Sunset as *write* path after G5; may remain read shim |
| **Physical coffee columns** | Dual-write bridge | Until G5; then nullable / unused |

No new coffee-only (or honey-only, etc.) NOT NULL columns on `marketplace.listings`.

---

## 2. Attribute model

### 2.1 Definitions

```text
catalog.attribute_definitions
  id, code, data_type,
  scope: CATEGORY | PRODUCT
  category_id? | product_id?,
  name_en, name_am,
  is_required, is_filterable, is_facetable, is_listed_in_card,
  unit_dimension?,           -- MASS | VOLUME | LENGTH | COUNT | …
  enum_set_id? | enum_values JSONB,
  validation_json JSONB,     -- min/max/regex/ref
  sort_order, is_active
```

### 2.2 Values

```text
marketplace.listing_attribute_values
  listing_id, attribute_definition_id,
  value_text | value_num | value_bool | value_json,
  UNIQUE (listing_id, attribute_definition_id)
```

### 2.3 Enumerations

Prefer `catalog.attribute_enum_values` (code, labels, sort) over ad-hoc JSON when enums are reused (quality grades, species).

Coffee `grade` / `process_method` → attribute defs + enum sets; dual-write to columns while RC1 clients require them.

---

## 3. Category attributes guidance

| Concern | Guidance |
|---------|----------|
| Ownership | Prefer **category-scoped** defs; product-scoped only for exceptions |
| Required | `is_required` enforced at publish/moderation, not always at draft save |
| Inheritance | Product may refine (stricter required) but not redefine incompatible types |
| Vertical | Attributes do not need vertical_id; category already belongs to a vertical |
| Packaging | Core `packaging_*` stays core; “bag type” can be attribute if category-specific |

---

## 4. Validation

```text
validateListing(listing, defs, formSchemaVersion):
  1. Core invariants (qty > 0, unit allowed for category, price, seller)
  2. For each required active def → value present + type ok
  3. Enum membership
  4. validation_json (min/max/regex)
  5. Unit dimension: if def has unit_dimension, value_num pairs with listing unit or attr unit
  6. Legacy pack: if category=COFFEE and dual-write era → also sync columns / extensions.coffee
```

Validation packs are **generated from definitions** where possible; hand-written `assertCoffeeExtensionRequirements` remains until coffee fully on attributes.

---

## 5. Units

| Rule | Detail |
|------|--------|
| Canonical quantity | Listing `quantity` + `unit_code` (G1) |
| Allowed units | Per category (or product) allow-list in catalog config |
| Attribute numeric+unit | Rare; prefer core quantity; attrs for *measurements* (altitude_m, moisture_pct) with fixed unit in def metadata |
| Search | Always filter in canonical unit or store `value_num` already normalized |

---

## 6. Search & filtering

| Mechanism | Source |
|-----------|--------|
| Facets | Defs with `is_facetable` |
| Range filters | Numeric defs (`value_num`) |
| Keyword | Listing title/description + selected text attrs |
| Core filters | vertical, category, kind, price, geo, status |

**Indexing:** start with filtered queries + indexes on `(attribute_definition_id, value_num)` / `(…, value_text)` for hot facets; revisit materialized facet tables if volume demands.

Do **not** query unbounded `extensions` JSON for new categories.

---

## 7. Extension sunset criteria (explicit)

Extensions / coffee columns may be **removed as write paths** when **all** are true:

1. G3 attribute defs cover coffee fields used in create/edit.  
2. Dual-write stable in production ≥ one release.  
3. Buyer/Seller/Admin read attributes (or projection) for coffee detail.  
4. No mobile build in support window requires NOT NULL coffee columns without server fill.  
5. Certificate templates read from attributes or snapshot JSON, not only columns.

Until then: **dual-write**; new categories: **attributes only** (no `extensions.<family>` required).

---

## 8. Anti-patterns

- Adding `listings.honey_moisture` columns  
- Parallel undocumented JSON blobs beside attribute_values  
- Filterable data only inside free-text description  
- Category-specific fee logic in attribute validators (belongs in Pricing)
