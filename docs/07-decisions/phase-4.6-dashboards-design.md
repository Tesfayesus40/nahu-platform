# Phase 4.6 — Farmer Dashboards & Analytics Architecture

**Status:** **Closed** — Nest aggregation on staging + Farmer M11 on-device; production held  
**Date:** 2026-07-15 (approved, implemented, and closed same day; v1.3)  
**Version:** 1.3  
**Parent:** [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (Approved)  
**Depends on:** Phase 4.1 Farms · 4.2 Inventory · 4.3 Warehouse · 4.4 Listing ↔ Stock · 4.5 Production Planning (**Closed** on staging + M10)  
**Next:** Optional Amharic copy polish; production Nest cutover only when explicitly approved

**Implementation gate:** **Closed on staging** — Nest `GET /farms/dashboard` → Tests → Docs → Staging smoke → Farmer M11 APK. Production promotion remains explicit.

**Production:** Remains unchanged until a future production promotion is explicitly approved.

**v1.3 review refinements (approved):** modular section envelope for future AI Insights / Weather; MVP alert rule set; Marketplace parent for listings + orders; single aggregated API response optimized for mobile loading.

---

## 0. Purpose and review goals

Define a **Farmer home / operations dashboard** as a **read / aggregation layer** over existing Nahu Farm + Marketplace + Orders + Planning data — **one** mobile-friendly API payload — **without new transactional tables**.

This review package is intended so product/engineering can verify:

1. Logical section model (Farm, Inventory, Marketplace, Production, Alerts)  
2. Modular growth path (new sections without redesign)  
3. Aggregation-only approach (no second ledger)  
4. Time windows and farm scoping  
5. Integration with Farms, Inventory, Warehouse, Listings/Orders, Plans (4.5)  
6. MVP alert rules  
7. Backward compatibility with today’s Home / Earnings screens  
8. Explicit out-of-scope (analytics warehouse, Buyer dashboard, Delivery KPIs, escrow on Home)

---

## 1. Business objectives and scope

### 1.1 Objectives

1. Give the Farmer a **single glance** at farm ops: holdings, stock, offers, sales pipeline, plan attainment, and lightweight alerts.  
2. Power Expo **Home** via **one** call: **`GET /farms/dashboard`**.  
3. Aggregate from **existing modules only** — no duplicate qty / finance tables.  
4. Stay coffee-first, multi-commodity via `catalog.products`.  
5. Remain additive for Farmers; **Buyer app unchanged**.  
6. Keep the contract **modular** so additional top-level sections (e.g. AI Insights, Weather) can ship later without redesigning existing sections.

### 1.2 In scope

| Area | Decision |
|------|----------|
| API | **`GET /api/v1/farms/dashboard`** — sole primary endpoint; **single aggregated response** |
| Shape | Named sections: **Farm · Inventory · Marketplace · Production · Alerts** (+ reserved room for future sections) |
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
| AI Insights / Weather section payloads | Later additive sections (contract reserved) |
| Buyer / coop / MoA portal dashboards | Later products |
| Delivery / dispatch fulfillment KPIs | Phase 5 |
| Production Nest cutover | Explicit gate |

---

## 2. Domain separation (invariants)

```
Transactional truth          → Farms, Stock lots/movements, Reservations, Listings, Orders, Cropping cycles
Dashboard API                → Read-only aggregation / projection (single response)
No dashboard writes          → Never UPDATE lot qty / order status / plan qty / escrow
No new transactional tables  → MVP computes live from source modules
```

| Rule | Meaning |
|------|---------|
| Dashboard ≠ inventory | Reuses balance / lot semantics |
| Dashboard ≠ planning | Attainment uses same rules as 4.5 `…/performance` |
| Dashboard ≠ ledger | No escrow / payout math on this endpoint for MVP |
| Reserved ≠ sold | Show reserved (4.4) and on_hand separately |
| One response | Client loads Home from **one** HTTP call (see §7.5) |

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

## 5. Modular section model

Payload is a **stable envelope** of named sections. MVP ships five sections. Later sections are added as **new top-level keys** (or an optional `extras` map) without renaming or breaking existing ones.

### 5.1 Extensibility (locked)

| Principle | Rule |
|-----------|------|
| Named sections | Each domain owns a top-level object key (`farm`, `inventory`, …) |
| Additive growth | Future **`aiInsights`**, **`weather`**, etc. appear as new keys; clients ignore unknown keys |
| No redesign | Existing section shapes remain backward-compatible when new fields are added (append-only preferred) |
| Optional omit | Servers may omit future sections until implemented; MVP always returns the five core sections |

### 5.2 Core sections (MVP)

| Section | Role | MVP contents |
|---------|------|----------------|
| **farm** | Holdings scope | Farm counts (total / active); optional selected `farmId` echo |
| **inventory** | Stock glance | Top products: on_hand / reserved / available; lot count; sites with stock (warehouse) |
| **marketplace** | Offers + sales pipeline (**parent**) | Active listings (offer-only vs stock-bound); reserved qty; nested **`orders`** (open seller counts/qty by status) — **no money** |
| **production** | Plan attainment | In-scope cycles for `seasonYear` (+ optional `seasonCode`); lines with planned/actual/attainment |
| **alerts** | Actionable signals | Array of typed alerts (see §5.6); may be empty |

**Marketplace parent (locked):** listings and seller orders stay under **`marketplace`** (orders nested). Do not promote orders to a sibling top-level section in MVP.

### 5.3 Recommended payload shape

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
      "messageAm": "ለዚህ ወቅት የምርት ዕቅድ የለም።"
    }
  },
  "alerts": []
}
```

Future (not returned in MVP):

```json
{
  "aiInsights": { "items": [] },
  "weather": { "items": [] }
}
```

### 5.4 Production empty-state (locked)

| Case | Behaviour |
|------|-----------|
| No in-flight cycles for selected `seasonYear` (and `seasonCode` if set) | Return `activeCycles: 0`, `lines: []`, and **`emptyState`** with `NO_CURRENT_PLAN` |
| Prior seasons have data | **Do not** auto-fallback or substitute another year |
| Client | Show the empty-state message; optional CTA → M10 create plan |

### 5.5 Defaults

| Field | Default |
|-------|---------|
| `farmId` | omit → all farms farmer can access |
| `seasonYear` | current calendar year |
| `seasonCode` | omit → all codes |
| Product list | Top N by `quantityOnHand` (N=5; query `productLimit`, max 20) |
| Production lines | Statuses `PLANNED`, `IN_PROGRESS`, `HARVESTED` for selected year only |
| Money fields | **Omitted** from dashboard MVP |

### 5.6 Quantity definitions

| Metric | Definition |
|--------|------------|
| `quantityOnHand` | Sum of lot on_hand (scoped) |
| `quantityReserved` | Sum of lot reserved |
| `quantityAvailable` | `on_hand - reserved` (floor at 0) |
| Plan `actualQty` | Same RECEIVE attribution as 4.5 performance (Tier A preferred) |

### 5.7 MVP alert rule set (locked)

Each alert: `{ "code", "severity", "section", "messageEn", "messageAm", "ref" }`  
`severity`: `INFO` | `WARNING` | `ACTION`. Cap at **20** alerts per response (priority: ACTION → WARNING → INFO).

| Code | When | Severity | Section hint |
|------|------|----------|--------------|
| `LOW_INVENTORY` | Any scoped product with `quantityAvailable ≤ 0` and (`quantityOnHand > 0` or `quantityReserved > 0`), **or** top stocked product available &lt; 10% of on_hand when on_hand &gt; 0 | `WARNING` | `inventory` |
| `OVERDUE_PRODUCTION_PLAN` | Cycle status ∈ `PLANNED` \| `IN_PROGRESS` with `plannedEndDate` (or equivalent end) **&lt; today** and attainment &lt; 100% | `ACTION` | `production` |
| `UPCOMING_HARVEST` | Cycle status ∈ `PLANNED` \| `IN_PROGRESS` with planned end within the next **14 days** (inclusive) | `INFO` | `production` |
| `OPEN_ORDERS_AWAITING_ACTION` | Seller has ≥1 order in `PENDING_PAYMENT` or `PAID_ESCROW` | `ACTION` | `marketplace` |

Rules use the same dashboard scope (`farmId` / season filters where applicable). No alert text includes money / escrow amounts.

---

## 6. Read-model strategy (locked)

### 6.1 MVP: Nest aggregation — **no new transactional tables**

- Service composes existing Prisma / small SQL against live modules.  
- **SQL migrations / Prisma models:** not required for MVP (optional read-only views later for clarity).  
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

### 7.5 Mobile loading (locked)

| Constraint | Rule |
|------------|------|
| Single response | Dashboard is **one** aggregated JSON body — Home must not require N section endpoints for MVP |
| Size discipline | Top-N products; alert cap; no lot-level dump; no earnings/ledger payloads |
| Soft-fail client | If the call fails, Home soft-fails dashboard cards; rest of app continues |
| Future sections | Additional keys may grow the payload; still one endpoint |

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
| Future AI / Weather services | New top-level sections when authorized |

---

## 9. Mobile (Farmer M11) — after staging API smoke

1. Fetch **`GET /farms/dashboard` once** on Home focus.  
2. Render section cards: Farm · Inventory · Marketplace · Production · Alerts.  
3. Production empty-state copy when `emptyState` present.  
4. Link earnings only via existing Earnings navigation — no escrow totals on Home.  
5. Bilingual labels (same pattern as M10 i18n).  
6. Ignore unknown top-level keys (forward-compatible with AI Insights / Weather).

Buyer: **no changes**.

---

## 10. Backward compatibility

| Client | Behaviour |
|--------|-----------|
| Old Farmer APK | Unchanged; ignores new endpoint |
| New Home with failure | Soft-fail sections; rest of app works |
| Buyer | Unchanged |
| Existing REST | Additive endpoint only |
| Future section keys | Old clients ignore; no breaking rename of MVP sections |

---

## 11. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Slow multi-join aggregate | Product limit; alert cap; indexes; materialize later if needed |
| Plan attribution ambiguity | Reuse 4.5 performance service |
| Double-count reserved | Lot `quantity_reserved`, not listing qty alone |
| Accidental money on dashboard | Explicit MVP exclusion; Earnings remains canonical |
| Confusing prior-season data | Locked empty-state; no auto-fallback |
| Client fan-out | Single aggregated response (§7.5) |

---

## 12. Implementation plan (authorized)

| Step | Work |
|------|------|
| 0 | Phase 4.5 closed ✓ |
| 1 | SQL — skip unless needed (MVP: Nest aggregation) |
| 2 | Prisma — skip unless needed |
| 3 | Nest `DashboardService` + `GET /farms/dashboard` |
| 4 | Unit/rule tests for section math, empty-state, alerts |
| 5 | Docs + feature mapping |
| 6 | Staging deploy + smoke |
| 7 | Farmer M11 Home UI + APK |
| 8 | Validation → Commit → PR → Merge → Tag |
| 9 | Production only when explicitly approved |

---

## 13. Success criteria

- One call returns **farm / inventory / marketplace / production / alerts**.  
- No new transactional tables for MVP.  
- Stock available = on_hand − reserved.  
- No current plan → empty-state, not prior season.  
- MVP alerts cover low inventory, overdue plans, upcoming harvest, open orders awaiting action.  
- Marketplace remains parent of listings + orders.  
- No escrow / settlement totals on dashboard MVP.  
- Buyer unaffected.  
- Staging smoke + M11 before production promotion.

---

## 14. Design decisions locked (product)

- [x] Aggregation layer over existing modules; **no new transactional tables** for MVP  
- [x] Primary endpoint: **`GET /farms/dashboard`**  
- [x] **Single aggregated API response** optimized for mobile loading  
- [x] Aggregate Farms, Inventory, Warehouse, Listings, Orders, Production Planning  
- [x] Financial / escrow remains in **Earnings** for MVP  
- [x] No current production plan → **empty-state** (no prior-season fallback)  
- [x] Sections: **Farm · Inventory · Marketplace · Production · Alerts**  
- [x] Modular envelope — future sections (AI Insights, Weather) additive without redesign  
- [x] Marketplace parent for listings + nested orders  
- [x] MVP alert rule set (§5.7)  
- [x] Phase 4.5 officially closed before 4.6 build  
- [x] Formal design **Approved**  
- [x] **Implementation authorized** (this document v1.3)

**Approver:** Product / program (chat) **Date:** 2026-07-15

---

## 15. References

- [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (§5.5)  
- [Phase 4.5 — Production planning](phase-4.5-production-planning-design.md)  
- [Phase 4.4 — Listing ↔ stock](phase-4.4-listing-stock-design.md)  
- [Backend ↔ Mobile feature mapping](../backend-mobile-feature-mapping.md)
