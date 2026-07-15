# Phase 4.6 — Farmer Dashboards & Analytics Architecture

**Status:** **Draft (review in progress)** — product decisions in §14 locked; **implementation not authorized**  
**Date:** 2026-07-15  
**Version:** 1.2  
**Program gate:** Phase 4.5 must be **officially closed** (on-device validation → commits → PRs → merge → milestone tags → docs → Amharic APK packaging) **before** this design is marked **Approved** and before any 4.6 implementation.  
**Parent:** [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (Approved)  
**Depends on:** Phase 4.1 Farms · 4.2 Inventory · 4.3 Warehouse · 4.4 Listing ↔ Stock · 4.5 Production Planning (**Closed** on staging + M10)  
**Next after approval:** Optional SQL views → Nest aggregation API → Tests → Docs → Staging → Mobile (M11) → Production (explicit)

**Implementation gate:** **Closed until design review is complete and implementation is explicitly authorized.**

**Production:** Remains unchanged until staging + mobile validation and an explicit production promotion.

---

## 0. Purpose and review goals

Define a **Farmer home / operations dashboard** as a **read / aggregation layer** over existing Nahu Farm + Marketplace + Orders + Planning data — one mobile-friendly API payload — **without new transactional tables**.

This review package is intended so product/engineering can verify:

1. Logical section model (Farm, Inventory, Marketplace, Production, Alerts)  
2. Aggregation-only approach (no second ledger)  
3. Time windows and farm scoping  
4. Integration with Farms, Inventory, Warehouse, Listings/Orders, Plans (4.5)  
5. Multi-commodity readiness  
6. Future AI / MoA / exporter reporting without redesign  
7. Backward compatibility with today’s Home / Earnings screens  
8. Explicit out-of-scope (analytics warehouse, Buyer dashboard, Delivery KPIs, escrow on Home)

---

## 1. Business objectives and scope

### 1.1 Objectives

1. Give the Farmer a **single glance** at farm ops: holdings, stock, offers, sales pipeline, plan attainment, and lightweight alerts.  
2. Power Expo **Home** via **`GET /farms/dashboard`**.  
3. Aggregate from **existing modules only** — no duplicate qty / finance tables.  
4. Stay coffee-first, multi-commodity via `catalog.products`.  
5. Remain additive for Farmers; **Buyer app unchanged**.  
6. Structure the payload so new KPI cards can land in named sections as the platform grows.

### 1.2 In scope (build after approval + explicit auth)

| Area | Decision |
|------|----------|
| API | **`GET /api/v1/farms/dashboard`** — sole primary endpoint |
| Shape | Logical sections: **Farm · Inventory · Marketplace · Production · Alerts** |
| Sources | Farms, Inventory, Warehouse, Listings/Reservations, Orders, Cropping cycles (4.5) |
| Money | **Not in MVP dashboard** — financial / escrow stays on existing **Earnings** surfaces |
| Auth | JWT + FARMER; farm-party scoped |
| Mobile (M11) | Additive Home after staging API smoke |
| Docs | Feature mapping + API README |

### 1.3 Out of scope

| Deferred | When |
|----------|------|
| New transactional / rollup tables for MVP | Later only if query lag proven |
| Escrow / settlement totals on Home | Earnings area (existing) |
| Auto-fallback to prior season when no current plan | Never in MVP — use empty-state |
| Buyer / coop / MoA portal dashboards | Later products |
| Delivery / dispatch fulfillment KPIs | Phase 5 |
| Weather / AI forecast widgets | Advisory future |
| Production Nest cutover | Explicit gate |

---

## 2. Domain separation (invariants)

```
Transactional truth          → Farms, Stock lots/movements, Reservations, Listings, Orders, Cropping cycles
Dashboard API                → Read-only aggregation / projection
No dashboard writes          → Never UPDATE lot qty / order status / plan qty / escrow
No new transactional tables  → MVP computes live from source modules
```

| Rule | Meaning |
|------|---------|
| Dashboard ≠ inventory | Reuses balance / lot semantics |
| Dashboard ≠ planning | Attainment uses same rules as 4.5 `…/performance` |
| Dashboard ≠ ledger | No escrow / payout math on this endpoint for MVP |
| Reserved ≠ sold | Show reserved (4.4) and on_hand separately |

---

## 3. Positioning

```
Identity
  ↓
Farms / Plots / Cycles / Inventory / Warehouse / Listings / Orders
  ↓
Farmer Dashboard API (aggregation layer)     ← 4.6
  ↓
Farmer Home (M11) + future analytics consumers
```

---

## 4. Current state

| Source | Already available |
|--------|-------------------|
| Farms / parties | `GET /farms/mine` |
| Stock balances / lots | Inventory APIs |
| Storage sites | Warehouse APIs |
| Listings + reservations | Marketplace + Inventory reservations |
| Seller orders | Orders module (ops counts/qty — not Earnings) |
| Cycle performance | 4.5 performance / production history |
| Farmer Home (Expo) | No unified Nest dashboard yet |
| Earnings | Existing screens — **remain source of financial truth for MVP** |

---

## 5. Section model (MVP)

Payload is organized so Home (and later analytics) can grow by section without reshaping the whole contract.

### 5.1 Sections

| Section | Role | MVP contents |
|---------|------|----------------|
| **farm** | Holdings scope | Farm counts (total / active); optional selected `farmId` echo |
| **inventory** | Stock glance | Top products: on_hand / reserved / available; lot count; sites with stock (warehouse) |
| **marketplace** | Offers + pipeline | Active listings (offer-only vs stock-bound); reserved qty; open seller order counts/qty by status — **no money** |
| **production** | Plan attainment | In-scope cycles for `seasonYear` (+ optional `seasonCode`); lines with planned/actual/attainment |
| **alerts** | Actionable signals | Empty array OK; examples: low available stock vs reserved pressure; plans with 0% attainment late in window; cycles stuck `DRAFT` — rules refined at implement time |

### 5.2 Recommended payload shape

```json
{
  "asOf": "ISO-8601",
  "scope": { "farmId": null, "seasonYear": 2026, "seasonCode": null },
  "farm": {
    "total": 2,
    "active": 2
  },
  "inventory": {
    "products": [
      {
        "productId": "…",
        "productCode": "ETHIOPIAN_ARABICA_COFFEE",
        "productNameEn": "…",
        "unitCode": "KG",
        "quantityOnHand": 120.5,
        "quantityReserved": 40,
        "quantityAvailable": 80.5
      }
    ],
    "lotCount": 6,
    "sitesWithStock": 2
  },
  "marketplace": {
    "activeListings": 3,
    "offerOnlyListings": 1,
    "stockBoundListings": 2,
    "totalOfferQty": 85,
    "totalReservedQty": 40,
    "orders": {
      "openAsSeller": 2,
      "byStatus": { "PENDING_PAYMENT": 1, "PAID_ESCROW": 1 },
      "openQuantity": 25,
      "unitCode": "KG"
    }
  },
  "production": {
    "activeCycles": 0,
    "lines": [],
    "emptyState": {
      "code": "NO_CURRENT_PLAN",
      "messageEn": "No production plan for this season yet.",
      "messageAm": "…"
    }
  },
  "alerts": []
}
```

### 5.3 Production empty-state (locked)

| Case | Behaviour |
|------|-----------|
| No in-flight cycles for selected `seasonYear` (and `seasonCode` if set) | Return `activeCycles: 0`, `lines: []`, and **`emptyState`** with `NO_CURRENT_PLAN` |
| Prior seasons have data | **Do not** auto-fallback or substitute another year |
| Client | Show the empty-state message; optional CTA → M10 create plan |

### 5.4 Defaults

| Field | Default |
|-------|---------|
| `farmId` | omit → all farms farmer can access |
| `seasonYear` | current calendar year |
| `seasonCode` | omit → all codes |
| Product list | Top N by `quantityOnHand` (N=5; query `productLimit`, max 20) |
| Production lines | Statuses `PLANNED`, `IN_PROGRESS`, `HARVESTED` for selected year only |
| Money fields | **Omitted** from dashboard MVP |

### 5.5 Quantity definitions

| Metric | Definition |
|--------|------------|
| `quantityOnHand` | Sum of lot on_hand (scoped) |
| `quantityReserved` | Sum of lot reserved |
| `quantityAvailable` | `on_hand - reserved` (floor at 0) |
| Plan `actualQty` | Same RECEIVE attribution as 4.5 performance (Tier A preferred) |

---

## 6. Read-model strategy (locked)

### 6.1 MVP: Nest aggregation — **no new transactional tables**

- Service composes existing Prisma / small SQL CTEs against live modules.  
- Optional **read-only SQL views** for documentation / query clarity — allowed; not a second ledger.  
- Cache optional (`Cache-Control: private, max-age=30`); no Redis required.

### 6.2 Later materialization

Rollup tables / jobs only if staging p95 for dashboard exceeds ~1–2s with real data — **additive**, not a redesign of this contract.

---

## 7. API design (locked)

### 7.1 Primary

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/farms/dashboard` | Farmer ops summary (sole primary URL) |

`/farmers/me/dashboard` is **not** implemented for MVP.

### 7.2 Query params

| Param | Type | Notes |
|-------|------|-------|
| `farmId` | UUID | Optional filter |
| `seasonYear` | int | Default current year |
| `seasonCode` | string | Optional FK to `season_codes` |
| `productLimit` | int | Default 5, max 20 |

### 7.3 Auth

JWT + `FARMER`. If `farmId` set → party access required. If omitted → aggregate all farms with active party.

### 7.4 Errors

- Unknown farm → 404  
- Inactive season code filter → 400  

---

## 8. Integration map

| Module | Section use |
|--------|-------------|
| Farms | **farm** |
| Inventory | **inventory** |
| Warehouse | **inventory** (`sitesWithStock` etc.) |
| Marketplace listings + reservations | **marketplace** |
| Orders | **marketplace.orders** (counts/qty only) |
| Cropping cycles (4.5) | **production** |
| Catalog | Names/codes inside inventory/production |
| Earnings / payments | **Not aggregated here** (MVP) |
| Derived signals | **alerts** |

---

## 9. Mobile (Farmer M11) — after staging API smoke

1. Fetch `GET /farms/dashboard` on Home focus.  
2. Render section cards: Farm · Inventory · Marketplace · Production · Alerts.  
3. Production empty-state copy when `emptyState` present.  
4. Link earnings only via existing Earnings navigation — no escrow totals on Home.  
5. Bilingual labels (same pattern as M10 i18n).  

Buyer: **no changes**.

---

## 10. Backward compatibility

| Client | Behaviour |
|--------|-----------|
| Old Farmer APK | Unchanged; ignores new endpoint |
| New Home with failure | Soft-fail sections; rest of app works |
| Buyer | Unchanged |
| Existing REST | Additive endpoint only |

---

## 11. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Slow multi-join aggregate | Product limit; indexes; materialize later if needed |
| Plan attribution ambiguity | Reuse 4.5 performance service |
| Double-count reserved | Lot `quantity_reserved`, not listing qty alone |
| Accidental money on dashboard | Explicit MVP exclusion; Earnings remains canonical |
| Confusing prior-season data | Locked empty-state; no auto-fallback |

---

## 12. Implementation plan (after approval **and** explicit authorization only)

| Step | Work |
|------|------|
| 0 | Confirm Phase 4.5 officially closed |
| 1 | Optional read-only SQL views |
| 2 | Nest `DashboardService` + `GET /farms/dashboard` |
| 3 | Unit/rule tests for section math + empty-state |
| 4 | Docs + feature mapping |
| 5 | Staging deploy + smoke |
| 6 | Farmer M11 Home UI |
| 7 | Production only when explicitly approved |

---

## 13. Success criteria

- One call returns **farm / inventory / marketplace / production / alerts**.  
- No new transactional tables for MVP.  
- Stock available = on_hand − reserved.  
- No current plan → empty-state, not prior season.  
- No escrow / settlement totals on dashboard MVP.  
- Buyer unaffected.  
- Staging smoke + M11 before production promotion.

---

## 14. Design decisions locked (product)

- [x] Aggregation layer over existing modules; **no new transactional tables** for MVP  
- [x] Primary endpoint: **`GET /farms/dashboard`**  
- [x] Aggregate Farms, Inventory, Warehouse, Listings, Orders, Production Planning  
- [x] Financial / escrow remains in **Earnings** for MVP  
- [x] No current production plan → **empty-state** (no prior-season fallback)  
- [x] Sections: **Farm · Inventory · Marketplace · Production · Alerts**  
- [x] Phase 4.5 official closeout **before** 4.6 Approved / build  
- [ ] Formal design **Approved** (after 4.5 closeout + any remaining review)  
- [ ] **Implementation authorized** (explicit — later)

**Approver:** _________________ **Date:** _______________

---

## 15. Remaining review items (non-blocking for product shape)

1. Initial **alerts** rule set for MVP (vs empty `alerts: []` first shipping version).  
2. Whether `marketplace.orders` stays nested under Marketplace or becomes a sibling later (MVP: nested).  
3. Exact Amharic strings for `emptyState` (align with M10 i18n at implement time).

---

## 16. References

- [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (§5.5)  
- [Phase 4.5 — Production planning](phase-4.5-production-planning-design.md)  
- [Phase 4.4 — Listing ↔ stock](phase-4.4-listing-stock-design.md)  
- [Backend ↔ Mobile feature mapping](../backend-mobile-feature-mapping.md)
