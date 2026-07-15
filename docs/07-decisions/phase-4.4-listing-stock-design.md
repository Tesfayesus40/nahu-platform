# Phase 4.4 — Listing ↔ Stock Binding Architecture

**Status:** **Approved** — implementation authorized  
**Date:** 2026-07-15 (approved same day)  
**Version:** 1.1  
**Parent:** [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (Approved)  
**Depends on:** Phase 3 Catalog · Phase 4.1 Farms · Phase 4.2 Inventory · Phase 4.3 Warehouse (**complete**)  
**Next after approval:** SQL → Prisma → API → Tests → Docs → Staging → Mobile (M8) → Production (explicit)

**Implementation gate:** **Authorized** — SQL → Prisma → API → Tests → Docs → Staging → Mobile → Production (explicit).

**Production:** Remains unchanged until staging implementation and mobile validation are complete and a production promotion is explicitly approved.

---

## 0. Purpose and review goals

Connect **Marketplace listings** (offers) to **Inventory lots** (physical stock) via soft **reservations**, without breaking today’s coffee offer-first flows.

This review package is intended so product/engineering can verify:

1. Binding model (optional vs required)  
2. Relationship among Listing, Lot, Reservation, Order  
3. Quantity truth: `listing.quantityKg` vs `lot.quantity_on_hand` / `quantity_reserved`  
4. Movement ledger events (`RESERVE` / `RELEASE` / consume path)  
5. Withdraw / edit / partial-order behaviour  
6. Warehouse site role (filter only vs hard bind)  
7. Backward compatibility with unstaged mobile / offer-only listings  
8. Long-term extensibility (multi-lot listings, Delivery DISPATCH, analytics)

---

## 1. Business objectives and scope

### 1.1 Objectives

1. Let a Farmer optionally **sell from a stock lot** when creating or updating a listing.  
2. Soft-hold lot quantity so the same kilos cannot be oversold across listings.  
3. Keep **Buyer checkout unchanged** — Buyer still sees `quantityKg` / `pricePerKg` on the listing.  
4. On order (and cancel/decline restore), keep listing offer qty and lot reservation consistent.  
5. Preserve **offer-only** listings (no lot) for farmers who have not received inventory yet.  
6. Leave clean hooks for Delivery `DISPATCH` (Phase 5) and dashboards (4.6).

### 1.2 In scope (build after approval)

| Area | Proposal |
|------|----------|
| Reservation API | Create / release / list reservations against lots |
| Listing create/update | Optional `stockLotId` (+ implied qty = listing `quantityKg`) |
| Movements | Use existing enum values `RESERVE` / `RELEASE` (already in DDL) |
| Order path | Consume reservation qty when order deducts listing qty; release on cancel/decline restore |
| Auth | Farm party write access on the lot’s farm; listing owned by same farmer |
| Mobile (M8) | Additive “sell from stock” UI after staging API smoke |

### 1.3 Out of scope

| Deferred | When |
|----------|------|
| Hard-require stock for every listing | Product flag later; not 4.4 default |
| Multi-lot allocation per single listing | Later (reservation stays 1 lot ↔ 1 listing in MVP) |
| Auto-dispatch / full WMS pick | Phase 5 Delivery |
| Changing Buyer app contracts | Not in 4.4 |
| Live payments / production Nest cutover | Explicit gates |
| Production planning (4.5) / dashboards (4.6) | Separate slices |

---

## 2. Domain separation (invariants)

```
catalog.products     →  WHAT is sold / stocked
farms.farms          →  WHERE produced
warehouse.storage_sites →  WHERE held (optional on lot)
inventory.stock_lots →  HOW MUCH physical exists
marketplace.listings →  WHAT is OFFERED for sale (may reference stock)
inventory.reservations →  soft hold linking lot qty ↔ listing (and later order)
orders.orders        →  purchase against listing offer qty
```

**Rules**

| Rule | Meaning |
|------|---------|
| Listing ≠ Lot | Listing is a commercial offer; lot is operational stock |
| Reservation ≠ Order | Reservation is a soft hold; order is buyer commitment |
| Offer-first stays valid | Listing without reservation continues to work exactly as today |
| Product alignment | Bound listing’s `product_id` must match lot’s `product_id` |
| Farm ownership | Lot’s farm must be accessible by the listing farmer (party write) |
| Append-only truth | Qty holds go through stock movements (`RESERVE`/`RELEASE`); no silent UPDATEs of on_hand for holds |

---

## 3. Current state (what already exists)

| Artifact | Status |
|----------|--------|
| `inventory.reservations` table | DDL present (Phase 4.2); no Nest service API |
| Movement types `RESERVE` / `RELEASE` | Enum present; not exposed in Phase 4.2/4.3 service allow-list |
| `stock_lots.quantity_reserved` | Column present; unused by API paths today |
| `stock_movements.listing_id` / `order_id` | Columns present; unused |
| Listing create | Offer-first: `quantityKg` only; no `stockLotId` |
| Order create | Decrements `listing.quantityKg` only; no lot impact |

**4.4 goal:** wire these without redesigning marketplace or buyer checkout.

---

## 4. Binding model (decision)

### 4.1 Recommended default: **optional bind**

```
Create listing
  ├── without stockLotId  →  unchanged offer-only behaviour
  └── with stockLotId     →  validate lot → create reservation → RESERVE movement
```

Rationale (already accepted in Phase 4 parent design):

- Coffee MVP and existing Farmer screens keep working.  
- Farmers who completed M3–M7 can opt into sell-from-stock.  
- Avoids forcing inventory before listing (onboarding friction).

### 4.2 Alternatives (reject unless product insists)

| Alternative | Why not default |
|-------------|-----------------|
| Always require lot | Breaks current create-listing UX; needs coordinated app release |
| Hard deduct on listing create (no reservation) | Loses withdraw/cancel restore clarity; harder analytics |
| Only bind at order time | Overbooking across concurrent listings until checkout |

---

## 5. Quantity truth model

For a **bound** listing:

| Quantity | Source of truth |
|----------|-----------------|
| Physical available to sell from lot | `quantity_on_hand - quantity_reserved` |
| Soft-held for this listing | `reservations.qty` where `status = ACTIVE` and `listing_id = …` |
| Buyer-visible offer | `listings.quantity_kg` (**must equal** active reservation qty for that listing in MVP) |
| Order fill | Decrements listing `quantity_kg` **and** reduces reservation / reserved pool |

**MVP invariant:** one ACTIVE reservation per bound listing; `reservation.qty == listing.quantityKg` (same unit; coffee = KG).

For an **offer-only** listing: only `listings.quantity_kg` matters (today’s behaviour).

---

## 6. Lifecycle

### 6.1 Create listing with stock

```
1. Validate farmer owns listing.
2. Load lot; assert farm write access; status ∈ {AVAILABLE, QUARANTINE? → reject quarantine}.
3. Assert product_id match (listing resolved product == lot.product_id).
4. Convert listing quantityKg into lot unit if needed (same path as inventory convertQty).
5. Assert available = on_hand - reserved >= qty.
6. In one DB transaction:
   a. Create listing (as today).
   b. Insert reservation (ACTIVE, listing_id, lot_id, qty, unit).
   c. Insert movement RESERVE (qty+, qty_in_lot_unit signed policy — see §7).
   d. Update lot.quantity_reserved += qty; status may become RESERVED if fully held.
7. Return listing + reservation summary.
```

**Recommended lot status rule:** keep status `AVAILABLE` while any free qty remains; set `RESERVED` only when `quantity_reserved == quantity_on_hand` and on_hand > 0. Do not use `RESERVED` status to mean “has any reservation”.

### 6.2 Withdraw / cancel listing with reservation

```
1. Release ACTIVE reservation(s) for listing.
2. Movement RELEASE; decrease quantity_reserved.
3. Withdraw listing as today (status WITHDRAWN / inactive).
```

### 6.3 Edit listing quantity (bound)

| Change | Behaviour |
|--------|-----------|
| Increase qty | Require additional available on same lot; grow reservation + RESERVE movement |
| Decrease qty | Shrink reservation + RELEASE movement; listing qty down |
| Change product | **Disallow** while reserved (force withdraw + new listing) |
| Change lot | **Disallow** in MVP (withdraw + recreate) |

### 6.4 Order create (Buyer — existing endpoint)

```
Today: listing.quantityKg -= orderQty; maybe status RESERVED when 0.

4.4 additive (only if listing has ACTIVE reservation):
  - Decrease reservation.qty by orderQty (or split CONSUMED child — MVP: mutate qty).
  - When reservation.qty hits 0 → status CONSUMED.
  - Optionally attach order_id on reservation / movements.
  - Do NOT reduce quantity_on_hand yet (stock still at farm until dispatch).
  - Keep quantity_reserved decreased so free capacity returns? 
```

**Important product decision (see checklist):**

When an order is placed against a reserved listing:

- **Option A (recommended):** Convert soft hold → order hold: keep `quantity_reserved` the same but re-attribute reservation from `listing_id` to `order_id` (status stays ACTIVE or becomes `ORDER_HELD`). Physical still held.  
- **Option B:** Release listing reservation (RELEASE) then create new reservation with `order_id`. Two movements. Clearer ledger.  
- **Option C:** Immediately `DISPATCH` / reduce `quantity_on_hand` on order create. **Rejected for 4.4** — belongs with Delivery.

**Recommend Option B** for ledger clarity in 4.4 MVP.

**Approved (2026-07-15):** Option B — listing reservation releases into an **order reservation**; `quantity_on_hand` does **not** decrease on order create; physical deduction waits for successful delivery / fulfillment (`DISPATCH` in Phase 5).

### 6.5 Order cancel / decline / restore listing stock

Existing `restoreListingStock` increases listing `quantityKg`.

4.4 additive: if order had an `ORDER_HELD` reservation, RELEASE it and (when listing still ACTIVE) recreate/grow a listing `ACTIVE` reservation for the restored qty. If listing was withdrawn, only RELEASE to free the lot.

### 6.6 Delivery / fulfillment (Phase 5 hook — not implemented in 4.4)

On successful delivery (or equivalent):

1. Transition order reservation `ORDER_HELD` → `DISPATCHED` (or via intermediate `ALLOCATED`).  
2. Append `DISPATCH` movement; decrease `quantity_on_hand` (and clear reserved for that qty).  

4.4 **pre-creates** status enum values `ALLOCATED` and `DISPATCHED` so Phase 5 needs no schema redesign — only API usage.

---

## 7. Movement semantics

Existing check: `stock_movements.qty >= 0` (Phase 4.3). `qty_in_lot_unit` remains signed in app for ledger math where needed.

| Type | Effect on lot | Notes |
|------|---------------|-------|
| `RESERVE` | `quantity_reserved += qty` | Does **not** change `quantity_on_hand` |
| `RELEASE` | `quantity_reserved -= qty` | Compensating; never negative reserved |
| `DISPATCH` | Decrease on_hand (and reserved if still held) | **Not in 4.4** — Phase 5 |

Expose `RESERVE` / `RELEASE` via Inventory service only through reservation APIs (not free-form farmer chips), to avoid inconsistent reserved totals.

---

## 8. Data model changes (SQL-first, additive)

Reservations table already exists. Proposed **small** hardening migrations:

### 8.1 Reservation status enum (extensible)

Replace bare `VARCHAR` with an enum that already includes Phase 5 placeholders:

```sql
CREATE TYPE inventory.reservation_status AS ENUM (
  'ACTIVE',      -- soft hold for a listing
  'ORDER_HELD',  -- soft hold attributed to an order (Option B)
  'RELEASED',    -- fully released
  'CONSUMED',    -- qty exhausted (no remaining hold)
  'ALLOCATED',   -- reserved for future WMS/pick (unused in 4.4 APIs)
  'DISPATCHED'   -- fulfilled / left warehouse (unused until Phase 5)
);
```

New fulfillment states later use `ALTER TYPE ... ADD VALUE` only if needed — **no table redesign**. 4.4 APIs only write `ACTIVE` / `ORDER_HELD` / `RELEASED` / `CONSUMED`.

### 8.2 Indexes / constraints

```sql
CREATE INDEX idx_reservations_listing_id ON inventory.reservations (listing_id);
CREATE INDEX idx_reservations_order_id ON inventory.reservations (order_id);
CREATE UNIQUE INDEX uq_reservations_one_active_listing
  ON inventory.reservations (listing_id)
  WHERE status = 'ACTIVE' AND listing_id IS NOT NULL;
```

### 8.3 Optional listing columns (nullable)

```sql
ALTER TABLE marketplace.listings
  ADD COLUMN IF NOT EXISTS stock_lot_id UUID
    REFERENCES inventory.stock_lots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS farm_id UUID
    REFERENCES farms.farms(id) ON DELETE SET NULL;
```

`stock_lot_id` is a denormalized convenience for queries; **authoritative hold** remains `inventory.reservations`.  
`farm_id` helps filters / advisory / analytics without joining lots.

### 8.4 FK for reservation.listing_id / order_id

Add FKs:

- `listing_id` → `marketplace.listings(id)` ON DELETE SET NULL  
- `order_id` → `orders.orders(id)` ON DELETE SET NULL  

---

## 9. API design (`/api/v1`)

Auth: JWT. Farmer mutations require farm write party on the lot’s farm + ownership of listing.

### 9.1 Inventory / reservation

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/inventory/reservations` | Create reservation `{ lotId, listingId?, qty, unitCode? }` |
| `POST` | `/inventory/reservations/:id/release` | Release remaining ACTIVE qty |
| `GET` | `/inventory/lots/:id/reservations` | List reservations for a lot |
| `GET` | `/inventory/reservations?listingId=` | Lookup by listing |

### 9.2 Marketplace (additive)

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/listings` | Optional `stockLotId`; if set, server creates reservation atomically |
| `PATCH` | `/listings/:id` | Bound qty adjust grows/shrinks reservation; no lot swap |
| `POST` | `/listings/:id/withdraw` | Releases reservation then withdraws |

Response additive fields (safe for old clients):

```json
{
  "id": "…",
  "quantityKg": 50,
  "stockLotId": "…",
  "farmId": "…",
  "reservation": {
    "id": "…",
    "status": "ACTIVE",
    "qty": 50,
    "unitCode": "KG"
  }
}
```

Omit `reservation` when offer-only.

### 9.3 Orders (additive, server-side only)

No new Buyer endpoints. On create / cancel / decline / dispute restore paths:

- If listing has/was bound → apply Option B release/re-hold as in §6.4–6.5.  
- Buyer payloads unchanged.

---

## 10. Warehouse interaction

- Prefer lots with `storage_site_id` for picker UX (Farmer M8).  
- Reservation does **not** require a site.  
- Relocate of a reserved lot: allowed if qty math unchanged; document that Delivery later ships from current site.  
- No new warehouse schema in 4.4.

---

## 11. Mobile (Farmer M8) — after staging API smoke

Additive only:

1. New Listing: chip “From stock” → pick ACTIVE farm lot with free qty → prefill `quantityKg` + product.  
2. Listing detail: show reservation / lot code if bound.  
3. Withdraw: confirmation that stock hold will release.  
4. Offer-only path remains default if no lot selected.

Buyer app: **no changes**.

---

## 12. Backward compatibility

| Client | Behaviour |
|--------|-----------|
| Old Farmer APK (no `stockLotId`) | Unchanged create listing |
| New Farmer with omit field | Offer-only |
| Buyer | Unchanged order APIs |
| Staging data | Existing listings remain offer-only (`stock_lot_id` null) |

---

## 13. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Double-sell offer qty vs lot | Single ACTIVE reservation per listing + availability check |
| Reserved drift | Only reservation service mutates `quantity_reserved` |
| Partial orders | Shrink reservation with Option B; listing qty already handled |
| Quarantine / damaged lots | Disallow reserve unless status AVAILABLE |
| Unit mismatch | Reuse inventory `convertQty`; coffee MVP stays KG |

---

## 14. Implementation plan (after approval)

| Step | Work |
|------|------|
| 1 | SQL: listing nullable columns, reservation indexes/FKs/status enum |
| 2 | Prisma map + generate |
| 3 | Nest: ReservationService; extend Inventory allow-list; Marketplace create/update/withdraw; Orders hooks |
| 4 | Rule tests (reserve/release/order) |
| 5 | Docs: API README, data dictionary, feature mapping |
| 6 | Staging migrate + deploy + API smoke |
| 7 | Farmer M8 UI → EAS staging APK → on-device |
| 8 | Production only when explicitly approved |

---

## 15. Success criteria

- Offer-only listing create still works.  
- Bound listing creates ACTIVE reservation and increases `quantity_reserved`.  
- Cannot reserve more than available.  
- Withdraw releases hold.  
- Order against bound listing maintains lot reserved/on-hand invariants under Option B.  
- Buyer flow unchanged.  
- Staging smoke + Farmer M8 validation before Warehouse/4.4 production promotion.

---

## 16. Approval checklist

- [x] **Optional bind** accepted (offer-first remains default)  
- [x] **1 listing ↔ 1 lot** MVP accepted (no multi-lot split yet)  
- [x] **Quantity truth** (`listing.quantityKg` == ACTIVE reservation qty) accepted  
- [x] **RESERVE/RELEASE** do not change `quantity_on_hand` accepted  
- [x] **Order path Option B** accepted (listing → order reservation; on-hand unchanged until delivery)  
- [x] **Extensible reservation statuses** (`ALLOCATED` / `DISPATCHED` reserved for Phase 5) accepted  
- [x] **DISPATCH / on_hand reduction** deferred to Phase 5 accepted  
- [x] **Nullable `listings.stock_lot_id` / `farm_id`** accepted  
- [x] **Buyer API unchanged** accepted  
- [x] **M8 after staging smoke** accepted  
- [x] Out-of-scope (hard-require stock, multi-lot, production cutover) accepted  
- [x] **Implementation authorized** (explicit — unlocks SQL)

**Approver:** Product owner **Date:** 2026-07-15

---

## 17. References

- [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md)  
- [Phase 4.2 — Inventory](phase-4.2-inventory-design.md) (**closed**)  
- [Phase 4.3 — Warehouse](phase-4.3-warehouse-design.md) (**closed**)  
- [Backend ↔ Mobile feature mapping](../backend-mobile-feature-mapping.md)  
- DDL: `database/migrations/inventory/005_inventory_reservations.sql`
