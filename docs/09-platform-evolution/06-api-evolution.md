# 06 — API Evolution Plan

**Status:** Planning only  
**Date:** 2026-07-28  
**Parent:** [Platform Evolution index](./README.md)

---

## 1. Compatibility doctrine

Mobile API **v1** remains the contract for RC1 apps:

- Success: direct resource JSON  
- Errors: `{ "error": "message" }`  

Multi-ag changes must be **additive** or **category-gated**. No breaking field removals until a versioned cutover.

---

## 2. Current contract strengths (keep)

| Surface | Keep |
|---------|------|
| Listing responses with `core` + `extensions.coffee` | Yes |
| `qualityGrade` alias of `grade` | Yes |
| Unit-aware quantity/price fields | Yes |
| Order embeds listing snapshot + coffee extension | Yes |
| Category/product codes on listings | Yes |

---

## 3. Target contract shape

```json
{
  "id": "…",
  "listingKind": "PRODUCE",
  "categoryCode": "CEREALS",
  "productCode": "TEFF",
  "quantity": 50,
  "unitCode": "KG",
  "pricePerUnit": 80,
  "qualityGrade": null,
  "attributes": {
    "moisturePct": 12.5,
    "packing": "50KG_BAG"
  },
  "extensions": {
    "cereals": { "moisturePct": 12.5, "packing": "50KG_BAG" }
  }
}
```

**Rules:**

- Coffee listings continue to populate `extensions.coffee` and legacy columns.  
- Prefer **both** `attributes` (flat map from definitions) and `extensions.<family>` during transition.  
- Clients should prefer `attributes` + core once G4 ships.

---

## 4. New / extended endpoints (planned)

| Endpoint | Purpose |
|----------|---------|
| `GET /catalog/categories?sellable=1` | Active sell categories |
| `GET /catalog/products?categoryCode=` | Products for forms |
| `GET /catalog/categories/:code/form-schema` | Mobile form definition |
| `GET /catalog/categories/:code/facets` | Search facet definition |
| `GET /admin/catalog/attribute-definitions` | Admin CRUD |
| Existing listing create/update | Branch validation by category |

Revenue / delivery / pricing endpoints stay as-is.

---

## 5. Validation evolution

| Today | Target |
|-------|--------|
| Hard-required coffee DTO fields | `ValidationPack` resolved by categoryCode |
| `assertCoffeeExtensionRequirements` | Registry: `packs.get('COFFEE')`, `packs.get('CEREALS')`, … |

Unknown category → reject sell. Inactive category → reject sell.

---

## 6. Search evolution

- Accept `categoryCode` as primary filter (default COFFEE for Buna Gebeya client header/config).  
- Facet query params become dynamic; undocumented coffee-only params remain for back-compat.  
- Deprecate `minKg` only after clients use unit-aware filters.

---

## 7. Certificates API

- Response includes `templateCode` + `attributes` / `extensions`.  
- Coffee clients keep reading grade/process at top level until updated.  
- Issue path selects template from listing category.

---

## 8. Versioning strategy

| Approach | Use |
|----------|-----|
| Additive fields | Default for G2–G5 |
| Client capability header optional | e.g. `X-Nahu-Catalog: attributes-v1` |
| URL version bump `/api/v2` | Only if breaking removal of coffee-required bodies |

**Prefer** capability headers + additive JSON over early v2.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Oversized listing payloads | Sparse attributes; omit empty extensions |
| Inconsistent extension vs attributes | Single writer module builds both |
| Admin/mobile skew | Form-schema endpoint is source of truth |
