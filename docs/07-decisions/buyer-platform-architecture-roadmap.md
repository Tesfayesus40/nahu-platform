# Buyer Platform — Architecture & Roadmap

**Status:** Approved 2026-07-17 (with refinements) — B2 validated on staging; B3 next
**Date:** 2026-07-17
**Depends on:** G1 marketplace contract (`milestone-g1-marketplace-contract`)  
**Related:** `commodity-generalization-architecture-review.md`, `g1-marketplace-contract-generalization.md`  
**Constraint:** Production unchanged until explicitly approved  
**Out of scope for this document:** Implementation details of later phases (see B1+ workflow)

---

## 1. Purpose

Define the **Buyer platform architecture and phased roadmap** so Buyer can be rebuilt (or evolved) as a **Nahu Farms** purchasing experience that:

1. Consumes the **G1 marketplace contract** (product/category, unit-aware price/qty, packaging, `qualityGrade`, `extensions.*`).
2. Delivers a **fully polished coffee buying path** first (Nahu Buna Gebeya experience inside Nahu Farms Buyer).
3. Remains extensible for cereals, honey, livestock, and other commodities **without redesigning** browse → detail → checkout → order → certificate.

Coffee remains the only activated sellable category until a later commodity activation phase.

### Approved refinements (2026-07-17)

1. **Browse** is a generic **Category → Product → Variety → Listing** discovery flow (not coffee-first IA). Coffee is simply the first activated category/products.
2. **First-class search** in the architecture: keyword, category, product, and seller — with room for future AI-assisted discovery.
3. **Seller Profile** is a first-class Buyer destination: farm, cooperative, certificates, ratings (future), and active listings.
4. **Order lifecycle** accommodates future logistics states (`CONFIRMED`, `SHIPPED`, `DELIVERED`, etc.) even if MVP collapses some transitions.
5. **AI extension points** reserved for recommendations, price insights, and similar products (no implementation in MVP).

---

## 2. Product positioning

| Layer | Name | Role |
|-------|------|------|
| Platform | **Nahu Farms** | Multi-commodity agricultural marketplace umbrella |
| Buyer app | **Nahu Farms Buyer** (working title) | Buyer-facing client |
| Coffee experience | **Nahu Buna Gebeya** | First commodity UX / brand cues until broader cutover |

UI copy may retain coffee warmth in coffee contexts; shell chrome (app name, home empty states, category picker) should read as Nahu Farms.

---

## 3. Current baseline (what exists)

The Expo Buyer app already implements an end-to-end **coffee + kg** path:

```
Login (OTP BUYER) → Tabs(Home, Browse, Orders, Settings)
  → ListingDetail → Checkout → Payment (simulated PIN) → Orders → Certificate
```

**Strengths to keep:** OTP auth, browse/list/detail/checkout/orders/certificate stack, escrow payment placeholder, bilingual scaffolding, shared payment/address components.

**Must change for G1:** hard-coded `pricePerKg` / `quantityKg`, region+grade-only filters, coffee-only copy and detail fields, certificates as coffee-only, no category/product/unit awareness, order create still kg-only on both mobile and API.

---

## 4. Target Buyer application architecture

### 4.1 Client layers

```
nahu-buna-buyer/
  src/
    navigation/          # Auth stack + Tabs + commerce stack
    screens/             # Thin screens; compose feature modules
    features/
      catalog/           # Browse, filters, listing cards, detail shells
      checkout/          # Cart-less single-listing checkout
      orders/            # List, detail actions, escrow states
      certificates/      # Origin/traceability presentation + share
      account/           # Settings, language, profile names
    services/api.js      # Platform REST client
    components/
      listing/           # Generic ListingCard, UnitPrice, PackagingBadge
      extensions/        # CoffeeExtensionPanel (pluggable)
    utils/
      listingDisplay.js  # Map G1 listing → display model
      filters.js         # Facet builders from category
```

Shared repo pieces (`shared/`) continue for brand assets, API error helpers, and bilingual utilities. Buyer-specific commodity UI stays in the Buyer app (or a future `shared/marketplace/` package if Farmer also needs the same card).

### 4.2 Platform dependencies (existing + thin follow-ons)

| Capability | Status | Buyer need |
|------------|--------|------------|
| `GET /categories`, `GET /products` | Exists | Category/product-aware browse |
| `GET /listings`, `GET /listings/:id` (G1 fields) | Exists | Core commerce |
| `POST /orders` + escrow patches | Exists (kg) | **Buyer Phase B1:** additive unit-aware order fields (dual-write like G1 listings) |
| Certificates | Exists (coffee-shaped) | **Buyer Phase B1:** response shaping — generic product cert + `extensions.coffee` |
| Buyer profile | `/auth/me` only | Sufficient for MVP; optional later `/buyers/profile` |
| Payments | Simulated confirm | Keep placeholder; real Telebirr/etc. later |

**SQL for Buyer MVP:** only if order/certificate dual-write requires additive columns (recommended mirror of G1: `quantity`/`unit_code`/`price_per_unit` on orders, or compute from listing unit at order time and store both). No new Buyer schema beyond that for MVP.

---

## 5. Navigation structure

### 5.1 Auth stack

| Route | Purpose |
|-------|---------|
| `Login` | OTP request/verify with role `BUYER` |

### 5.2 Main tabs (authenticated)

| Tab | Route | Purpose |
|-----|-------|---------|
| Home | `HomeTab` | Dashboard: featured listings, active orders snapshot, continue shopping |
| Browse | `Browse` | Commodity-aware catalog search & filters |
| Orders | `Orders` | Buyer order list & status actions |
| Account | `Settings` | Language, profile name, logout, about |

### 5.3 Commerce stack (pushed over tabs)

| Route | Purpose |
|-------|---------|
| `ListingDetail` | Generic core + extension panel |
| `Checkout` | Unit-aware qty, address, payment method |
| `Payment` | Escrow confirmation (simulated until provider) |
| `OrderDetail` *(new recommended)* | Single-order status, address edit, confirm delivery, open certificate |
| `Certificate` | Product origin / traceability certificate |
| `SellerProfile` *(first-class)* | Farm/cooperative summary, certificates, ratings (future), active listings |
| `Search` *(first-class entry)* | Keyword + scoped search (category, product, seller); AI-assisted discovery later |

Optional later: `SavedAddresses`, `Notifications`, `Recommendations`.

### 5.4 Information architecture (screen hierarchy)

```
Login
└── Tabs
    ├── Home
    │     └── → ListingDetail → Checkout → Payment → OrderDetail
    ├── Browse   (Category → Product → Variety → Listing)
    │     ├── Search (keyword / category / product / seller)
    │     ├── Filters + facets (category-driven)
    │     └── → ListingDetail → … → SellerProfile
    ├── Orders
    │     └── → OrderDetail → Certificate
    └── Account
```

### 5.5 Browse & search model

Discovery is **generic**, not coffee-first:

```
Category → Product → (optional) Variety → Listing
```

| Capability | MVP | Later |
|------------|-----|-------|
| Category browse | Active categories only (COFFEE live) | Activate more categories |
| Product within category | From `GET /products` | Merchandising rails |
| Variety | Show when product has varieties | Filter by variety |
| Keyword search | Client and/or `q=` on listings | Full-text + typo tolerance |
| Seller search | By farmer/coop name → SellerProfile | Ranking |
| AI-assisted discovery | Extension point only | Recommendations, “similar”, price insights |

Search module interface (design):

```ts
SearchQuery = {
  q?: string,                 // keyword
  scope?: 'ALL'|'CATEGORY'|'PRODUCT'|'SELLER',
  categoryCode?, productCode?, varietyCode?,
  facets?: Record<string, string|string[]>,
}
SearchResult = { listings[], sellers[], products[], categories[] }
```

AI hooks (no MVP implementation): `recommendListings(buyerCtx)`, `priceInsight(listingId)`, `similarListings(listingId)`.

### 5.6 Seller Profile

First-class Buyer destination (from listing card, detail, or search):

| Section | Source (MVP / later) |
|---------|----------------------|
| Seller identity | Public farmer profile (`GET` farmer public) |
| Farm summary | Farms the seller owns (public-safe fields) |
| Cooperative | Profile cooperative name/union |
| Certificates | Completed-order certificates visible to counterparties; public verify later |
| Ratings / reviews | **Future** — placeholder section in IA |
| Active listings | `GET /listings?farmerId=` or equivalent filter |

### 5.7 Order lifecycle (logistics-ready)

Platform enum already includes logistics-capable states. MVP uses a subset; unused states remain valid for future without migration:

```
PENDING_PAYMENT
  → PAID_ESCROW          (MVP)
  → CONFIRMED            (future: farmer/ops confirm)
  → SHIPPED              (future: logistics)
  → DELIVERED            (future: carrier / buyer)
  → COMPLETED            (MVP today: often combined with delivery confirm)
CANCELLED | DISPUTED     (as today)
```

MVP may continue **PAID_ESCROW → COMPLETED** on buyer confirm-delivery, but UI/state machine must not assume those are the only statuses.

---

## 6. Integration with G1 marketplace contract

### 6.1 Listing display model (client)

Normalize every listing API payload into:

```ts
ListingView = {
  id, status,
  categoryCode, categoryName,
  productCode, productName,
  // Commerce core
  quantityAvailable, unitCode, pricePerUnit,
  packagingLabel?, packagingQuantity?,
  qualityGrade?,
  region, regionEn, woreda?,
  photos[],
  harvestDate?,
  // Extension bag (opaque to generic UI)
  extensions: { coffee?: CoffeeExtension, … }
}
```

Mapping rules:
- Prefer `quantity` / `unitCode` / `pricePerUnit`; fall back to `quantityKg` / `KG` / `pricePerKg`.
- Prefer `qualityGrade`; fall back to `grade`.
- Prefer `extensions.coffee.*`; fall back to root coffee fields during transition.
- Never hard-code “kg” in labels — use unit catalog names (`nameEn`/`nameAm`) when available.

### 6.2 Browse query mapping

| UI control | API query |
|------------|-----------|
| Category chip | `categoryCode` |
| Product chip | `productCode` |
| Region / origin | `region` / `regions` |
| Quality grade | `grade` / `grades` (coffee facet today) |
| Process (coffee only) | `processMethod` |
| Max price | `maxPrice` (document unit: per listing `unitCode`) |
| Sort | `sort=newest\|price_asc\|price_desc` |
| Pagination | `page`, `limit` |

Facet visibility is **category-driven**: coffee shows grade + process; future cereals show moisture/packing facets when defined.

### 6.3 Checkout / order contract (required platform thin slice)

Buyer MVP should not invent a second pricing model.

**Proposed order create (additive, dual-write):**

```json
{
  "listingId": "…",
  "quantity": 10,
  "unitCode": "KG",
  "quantityKg": 10,
  "deliveryAddress": { … },
  "paymentMethod": "TELEBIRR"
}
```

Rules:
1. Resolve listing unit; reject mismatched `unitCode`.
2. For KG coffee listings, accept legacy `{ quantityKg }` only and fill `quantity`/`unitCode`.
3. Price = `listing.pricePerUnit * quantity` (not a separate client commission inventing unit).
4. Inventory reservation uses listing/lot unit consistency (already unit-coded on lots).

Certificate responses should include product/category names, unit-aware quantity, `qualityGrade`, and `extensions.coffee` for coffee orders.

---

## 7. Generic vs commodity-specific UI

### 7.1 Always generic (all commodities)

| Surface | Content |
|---------|---------|
| Listing card | Photo, product name, region, **price/unit**, available qty/unit, quality badge if present, packaging chip |
| Browse shell | Category → product → search → sort |
| Listing detail header | Product, farmer summary, location, photos, price/unit, buy CTA |
| Checkout | Qty stepper in listing unit, address, payment method, order summary |
| Orders list | Product, status, total, date |
| Order detail | Timeline, address, pay/confirm/cancel actions |
| Certificate shell | Title “Product Origin Certificate” / Amharic equivalent, parties, qty/unit, date |
| Account | Language toggle (`አማ` / `EN`), profile names |

### 7.2 Coffee extension UI (first plug-in)

Rendered **only when** `categoryCode === 'COFFEE'` (or `extensions.coffee` present):

| Section | Fields |
|---------|--------|
| Coffee quality | Process method, cup score, variety |
| Coffee provenance | Washing station, cooperative, altitude (as quality signal) |
| Coffee filters | Process method facet; coffee grade options |
| Coffee cert extras | Process, altitude, cooperative lines under generic cert |

### 7.3 Extension framework (UI)

```
ListingDetail
  ├── ListingCoreSections      // generic
  └── ExtensionHost
        └── registry[categoryCode] → CoffeeExtensionPanel | null
```

Adding honey later = register `HoneyExtensionPanel`, not fork Browse/Checkout.

---

## 8. Feature design by area

### 8.1 Search & filtering

**MVP (coffee-first, commodity-ready shell):**
1. Category selector (COFFEE active; others disabled/“coming soon”).
2. Optional product filter within category.
3. Text search on region / product name (client filter OK initially; server search later).
4. Facets: region, quality grade, process (coffee), price sort.
5. Empty/error states with retry.

**Later:** server full-text, saved filters, map/region picker, multi-category home rails.

### 8.2 Product / listing details

1. Hero photos + product/category title.  
2. Unit price + packaging.  
3. Availability.  
4. Origin (region/woreda) + farmer verification badge.  
5. Extension panel (coffee).  
6. Primary CTA → Checkout.

### 8.3 Orders

States already on platform: pending payment → escrow → delivery → completed (+ certificate) / cancelled / dispute paths as supported today.

Buyer MVP polish:
- Dedicated `OrderDetail` screen (avoid overloading list rows).
- Unit-aware line items.
- Clear escrow messaging (generic, not coffee-only).

### 8.4 Buyer dashboard (Home)

| Block | Content |
|-------|---------|
| Greeting | Name + language |
| Active orders | Up to N open orders |
| Featured / latest | G1 listings (coffee) |
| Shortcuts | Browse, Orders |

No multi-commodity merchandising until second category activates.

### 8.5 Certificates

Generic shell + coffee extension fields. Public verify endpoint can remain unused in MVP or get a simple “Verify” deep link later.

### 8.6 Payments

Keep simulated PIN → `confirm-payment` for staging/APK validation. Architecture treats Payment as a provider adapter interface (`SimulatedProvider` now; Telebirr later) without changing order state machine.

---

## 9. Roadmap (phased)

### Phase B0 — Architecture (this document)
Approve IA, G1 integration, extension UI pattern, order dual-write need.

### Phase B1 — Platform buyer contract (thin)
**Goal:** Orders & certificates speak G1 units without breaking kg clients.

- Additive order quantity/unit fields (or equivalent dual-write strategy)  
- Certificate response shaping (product + unit + extensions)  
- Listing facet docs for Buyer  
- Tests + staging  
- **No production**

*SQL/Prisma only if additive order columns are chosen.*

### Phase B2 — Buyer mobile MVP (coffee on G1)
**Goal:** Ship staging APK of commodity-aware Buyer with coffee as sole live category.

- Listing display model + generic cards/detail  
- Browse filters (category shell + coffee facets)  
- Checkout/orders/certificate consume unit fields  
- Branding: Nahu Farms shell + coffee experience copy where appropriate  
- Localization polish (toggle, Amharic labels)  
- Staging APK validation  

### Phase B3 — Buyer hardening
- OrderDetail UX, error/empty states, pagination  
- Address book (optional)  
- Certificate share/verify polish  
- Performance & analytics hooks  

### Phase B4 — Real payments (separate approval)
Provider webhooks, replace simulation.

### Phase B5 — Next commodity activation (not Buyer redesign)
Activate category (e.g. cereals/teff): products, facets, extension panel, Farmer listing section — Buyer shell already ready.

### Suggested milestones

| Tag (proposed) | Meaning |
|----------------|---------|
| `milestone-buyer-b1-contract` | Unit-aware orders/certs on staging |
| `milestone-buyer-mvp-mobile` | Buyer APK coffee MVP on G1 |
| `milestone-buyer-payments-v1` | Real payment provider |

---

## 10. Explicit non-goals (Buyer MVP)

- Activating non-coffee sell-through  
- Full attribute DDL (G3)  
- Buyer social features, multi-item cart, auctions  
- Replacing Farmer app  
- Production deploy / store release  
- Immediate drop of `quantityKg` fields  

---

## 11. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Order API still kg-only blocks non-KG UX honesty | B1 dual-write before or with B2 checkout |
| Coffee copy leaks into shell | Extension panels + category gates |
| Facet hardcoding returns | Category facet config module |
| Simulated payment mistaken for live | Explicit staging banners; B4 gated |

---

## 12. Approval checklist

Please confirm:

- [ ] Buyer is **Nahu Farms Buyer** consuming G1; coffee is first experience (Nahu Buna Gebeya cues OK)  
- [ ] Navigation: Tabs Home / Browse / Orders / Account + ListingDetail / Checkout / Payment / OrderDetail / Certificate  
- [ ] Generic listing UI + **CoffeeExtensionPanel** pattern  
- [ ] Phase **B1** thin order/certificate unit dual-write before or alongside mobile MVP  
- [ ] Payment stays simulated until a later approved phase  
- [ ] Non-coffee activation deferred to B5  
- [ ] Production frozen until explicit approval  

After approval, normal workflow starts at **SQL (if required for B1) → Prisma → API → …** or at **Mobile** if B1 is deferred and coffee remains KG-only temporarily (not recommended).

**Recommendation:** Approve this architecture, then execute **B1 then B2** so Buyer never re-learns kg-only habits.
