# 04 — Marketplace Generalization Strategy

**Status:** Planning only  
**Date:** 2026-07-28  
**Parent:** [Platform Evolution index](./README.md)

---

## 1. Goal

One marketplace engine that sells **goods, supplies, and services** across marketplace verticals, with **Agriculture** as the first vertical and coffee as the first complete category configuration.

See [14 — Marketplace Engine](./14-marketplace-engine-design.md) and [17 — Terminology](./17-d3-terminology-guide.md).


---

## 2. Commodity Extension Framework (keep and deepen)

G1 established:

- Listing **core** + `extensions.<FAMILY>`  
- Category-keyed validation  
- Flexible units  

**Next:**

| Layer | Responsibility |
|-------|----------------|
| Extension registry | Which families exist (`coffee`, `cereals`, `livestock`, …) |
| Validation packs | Required/optional attrs per category/product |
| Facet packs | Search filters per category |
| Form packs | Mobile/Admin field groups |
| Certificate packs | Snapshot templates |

Coffee remains the reference implementation of a pack.

---

## 3. Discovery and search

| Today | Target |
|-------|--------|
| Coffee facets (grade, process, kg) | Facets from **facet config** for active category |
| Global “coffee” home narrative | Category hub; coffee default for Buna Gebeya app flavor |
| `minKg` style filters | Unit-aware filters (`minQuantity` + `unitCode`) |

Buyer app may default `categoryCode=COFFEE` via config while Farmer can switch categories when activated.

---

## 4. Listing lifecycle (unchanged shape)

```text
DRAFT / PENDING moderation → ACTIVE → RESERVED → SOLD / … 
```

Moderation stays generic. Reviewer UI shows **attribute panels** for the listing’s category instead of hard-coded coffee rows.

---

## 5. Goods vs supplies vs services

### Goods (agri UI: Produce)

- Optional link to business profile / farm / lot  
- Quality + origin attrs  
- Certificate templates common  
- Delivery: weight/volume from listing  

### Supplies (agri UI: Inputs)

- Often no harvest/offer date  
- Brand, composition, batch/expiry attrs  
- Regulatory flag may block certain categories until compliance workflow exists  
- Delivery: same engine; hazmat rules later as shipment metadata  

### Services

- May not need physical delivery shipment (or uses “site visit” stop type later)  
- Escrow still useful for booking deposits  
- Scheduling attrs deferred; MVP can be “contact / request” fulfilment  

**Do not** invent three order engines. Use listing kind to branch UX and fulfilment policy.

---

## 6. Pricing and promotions

| Concern | Strategy |
|---------|----------|
| Platform fees | Revenue Engine — already goods-based |
| Delivery fees | Quote engine — weight/vehicle; category-agnostic |
| Promotions | Existing promotions module — scope by category/product later |
| Category surcharges | Optional future fee schedule dimensions — not required for multi-ag V1 |

---

## 7. Inventory handoff

Prefer listings that reference `stock_lot_id` for produce. Inputs may use warehouse lots the same way. Services typically have no lot.

Farms module already supports multi-product cycles — marketplace should **consume** catalog products, not redefine them.

---

## 8. Risks specific to marketplace generalization

| Risk | Mitigation |
|------|------------|
| Facet explosion | Limit facets per category; Admin curated |
| Mixed carts across kinds | RC1 is single-listing orders; multi-cart later with kind rules |
| Service + escrow disputes | Policy templates per kind in refund roadmap |
| Inputs counterfeit | Verification / seller KYC stronger for INPUT categories |

---

## 9. Compatibility with G1 clients

- Keep `extensions.coffee` populated for coffee listings.  
- Keep `qualityGrade` / `grade` aliases.  
- Keep kg dual-write while coffee mobile expects it.  
- New categories return empty `extensions.coffee` and populated `extensions.<family>` or attribute maps.
