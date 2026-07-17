# B1 — Buyer order & certificate contract (unit-aware)

**Status:** Implemented & validated on staging (2026-07-17) — production unchanged  
**Date:** 2026-07-17  
**Parent:** `buyer-platform-architecture-roadmap.md`  
**Depends on:** G1 listing contract  
**Constraint:** Production unchanged until explicitly approved

## Goal

Make **orders** and **origin certificates** speak the same unit-aware language as G1 listings, with dual-write compatibility for legacy `quantityKg` clients.

## DDL (additive)

### `orders.orders`

| Column | Type | Notes |
|--------|------|-------|
| `quantity` | `NUMERIC(12,3) NULL` | Canonical ordered qty |
| `unit_code` | `VARCHAR(20) NULL` → `catalog.units` | Must match listing unit |
| `price_per_unit` | `NUMERIC(12,2) NULL` | Snapshot of listing unit price at order time |

Backfill: `quantity = quantity_kg`, `unit_code = 'KG'`, `price_per_unit = total_etb / quantity_kg` (safe when qty > 0).

### `orders.origin_certificates`

| Column | Type | Notes |
|--------|------|-------|
| `quantity` | `NUMERIC(12,3) NULL` | Dual-write with `quantity_kg` |
| `unit_code` | `VARCHAR(20) NULL` | From order |

Backfill from order rows after order columns exist.

## API

### Create order

Accept either:
- Legacy: `{ listingId, quantityKg, paymentMethod, deliveryAddress }`
- Modern: `{ listingId, quantity, unitCode?, paymentMethod, deliveryAddress }`

Rules:
1. Resolve qty/unit from modern or legacy input.
2. Default `unitCode` to listing `unit_code` / `KG`.
3. Reject if `unitCode` ≠ listing unit.
4. Reject if qty > listing available (`quantity` preferred, else `quantityKg`).
5. `totalEtb = pricePerUnit * quantity` (price from listing `price_per_unit` ?? `price_per_kg`).
6. Persist dual-written order fields; decrement listing **both** `quantity` and `quantity_kg` (and unit fields stay consistent).
7. Reservation qty uses resolved quantity.

### Order response (additive)

```
quantity, unitCode, pricePerUnit,
quantityKg, totalEtb, …,
qualityGrade, productCode, categoryCode (from listing when included),
extensions.coffee (when coffee listing)
```

### Certificate response (additive)

```
quantity, unitCode, quantityKg,
qualityGrade (alias of grade),
productNameEn/Am, categoryCode (when order/listing joined),
extensions.coffee: { processMethod, altitudeM, cooperative, … }
```

Keep legacy `grade`, `processMethod`, `quantityKg` fields.

## Out of scope for B1

- Buyer mobile screens  
- Search / Seller Profile APIs beyond existing public farmer profile  
- Activating logistics transitions (`CONFIRMED`/`SHIPPED`)  
- AI features  
- Production deploy  
