# 15 — D1: Marketplace Vertical

**Status:** Design locked — no production code  
**Resolves:** [12 — Design Validation](./12-design-validation.md) § D1  
**Parent:** [Platform Evolution index](./README.md)  
**Consumed by:** [14 — Marketplace Engine](./14-marketplace-engine-design.md)

---

## 1. Decision

**Marketplace Vertical** is a first-class platform concept. Categories belong to a vertical; they are not globally free-floating.

```text
MarketplaceVertical
  └── Category
        └── Product
              └── Variety (optional)
                    └── Listing
```

**Nahu Farms** is an *experience pack* over vertical `AGRICULTURE`.  
**Nahu Buna Gebeya** is a *category experience* (coffee) within that vertical.  
Future brands (e.g. construction marketplace) attach to other verticals without forking the Marketplace Engine.

---

## 2. Seed verticals (codes)

| Code | Name | Initial use |
|------|------|-------------|
| `AGRICULTURE` | Agriculture | Coffee RC1 + multi-ag (Nahu Farms) |
| `CONSTRUCTION` | Construction | Future |
| `MANUFACTURING` | Manufacturing | Future |
| `RETAIL` | Retail | Future |
| `HEALTHCARE` | Healthcare | Future |
| `LOGISTICS` | Logistics | Future (services / capacity — not Delivery module itself) |
| `TOURISM` | Tourism | Future |

Only `AGRICULTURE` is activated for sell-through in near-term waves. Others may be seeded inactive for Admin taxonomy work.

---

## 3. Data model

### 3.1 Table (target)

```text
catalog.marketplace_verticals
  id              UUID PK
  code            VARCHAR UNIQUE NOT NULL   -- AGRICULTURE, …
  name_en         VARCHAR NOT NULL
  name_am         VARCHAR NULL
  description     TEXT NULL
  default_brand   VARCHAR NULL              -- e.g. Nahu Farms
  compliance_profile_code VARCHAR NULL      -- links D6
  is_active       BOOLEAN NOT NULL DEFAULT true
  sort_order      INT NOT NULL DEFAULT 0
  metadata        JSONB NOT NULL DEFAULT '{}'
  created_at / updated_at
```

### 3.2 Category ownership

```text
catalog.categories
  + marketplace_vertical_id  UUID NOT NULL FK → marketplace_verticals
  -- UNIQUE (marketplace_vertical_id, code) preferred over global-only code uniqueness
```

**Rule:** A category code may repeat across verticals only if scoped by vertical (e.g. `SERVICES` under AGRICULTURE vs TOURISM). Prefer globally unique codes when practical (`COFFEE`, `CEMENT`).

### 3.3 Configuration metadata (examples)

```json
{
  "defaultListingKind": "GOODS",
  "requiresBusinessProfile": false,
  "defaultAppFlavor": "nahu-farms",
  "allowedSellerTypes": ["FARMER", "COOPERATIVE", "COMPANY"]
}
```

Stored in `marketplace_verticals.metadata` and/or separate config tables later — not hard-coded in mobile.

---

## 4. Admin management (G2+)

| Capability | Wave | Notes |
|------------|------|-------|
| List / view verticals | G2 | Read-only first if seeded via SQL |
| Create / edit vertical (name, brand, active) | G2 or G2.1 | `catalog.vertical.write` |
| Assign category → vertical | G2 | Required on category create/edit |
| Activate vertical for sell | Config + feature flag | Independent of category `sell_enabled` |
| Compliance profile link | With D6 | Display only until tax/compliance module |

Admin navigation: **Catalog → Verticals → Categories → Products**.

---

## 5. API (additive)

```text
GET  /catalog/verticals
GET  /catalog/verticals/:code
GET  /catalog/verticals/:code/categories

# Category payloads gain:
{
  "verticalCode": "AGRICULTURE",
  "vertical": { "code": "AGRICULTURE", "nameEn": "Agriculture" }
}
```

**Compatibility:** Existing `GET /catalog/categories` continues; response adds `verticalCode`. Clients that ignore unknown fields keep working.

Listing / search may accept optional `verticalCode` filter (default from app config, e.g. Buna Gebeya → AGRICULTURE + COFFEE).

---

## 6. Migration plan

1. **Additive:** create `catalog.marketplace_verticals`; seed rows.  
2. **Additive:** `categories.marketplace_vertical_id` **nullable** initially.  
3. **Backfill:** all existing categories → `AGRICULTURE`.  
4. **Enforce:** NOT NULL + FK; unique `(vertical_id, code)`.  
5. **No** category renames required for coffee.

Do not block G2 category Admin CRUD on vertical UI — seed + FK backfill can land in the same G2 migration wave as `sell_enabled`.

---

## 7. Configuration vs code

| Concern | Config | Code |
|---------|--------|------|
| Which verticals exist | Seed / Admin | — |
| Default vertical per app | App env / remote config | Thin client default |
| Compliance profile | Config (D6) | Enforcement engines later |
| Brand strings | Vertical metadata | Experience packs |

---

## 8. Invariants

1. Every category has exactly one vertical.  
2. Listings inherit vertical via category (no duplicate listing.vertical column required).  
3. Fee schedules / delivery tariffs may optionally key by `vertical_code` later; default remains global + category.  
4. Delivery module is **not** the LOGISTICS vertical — LOGISTICS is a marketplace of logistics *services* if ever sold.
