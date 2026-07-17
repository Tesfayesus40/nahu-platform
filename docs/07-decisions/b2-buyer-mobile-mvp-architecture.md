# B2 — Buyer Mobile MVP Architecture

**Status:** Approved 2026-07-17 (with refinements) — thin API on staging; mobile implementing  
**Date:** 2026-07-17  
**Parent:** `buyer-platform-architecture-roadmap.md`  
**Depends on:** G1 listing contract · B1 order/certificate contract (`milestone-buyer-b1-contract`)  
**Constraint:** Production unchanged until explicitly approved  
**Proposed tag:** `milestone-buyer-mvp-mobile`

## Approved refinements (2026-07-17)

1. **Seller Profile** — reusable seller page (not merely “listing owner”): seller info, farms, cooperative, active listings, location, certificates; extension points for ratings, reviews, verified badges, response metrics.
2. **Search** — server-side where practical (`q=` + filters); product, listing title/fields, seller, category, region; extensible for future filters.
3. **Browse** — generic Category → Product → Variety → Listing; coffee is first populated category only.
4. **Listing Detail** — generic block + commodity extension panel (Coffee first).
5. **Shared components** — reuse Farmer/shared design system, i18n, theme, navigation, common UI.
6. **Payments** — simulated only for this milestone.
7. **Focus** — polished MVP; defer favorites, reviews, chat, AI, price analytics, seller ratings.

## 1. Goal

Ship a **staging APK** of the Buyer app that delivers a clean MVP commerce path on the **generalized marketplace contract** (G1/B1), with **coffee as the first live commodity** — without baking coffee-only assumptions into shell screens.

## 2. Approved product scope (this phase)

| Surface | MVP responsibility |
|---------|-------------------|
| **Home** | Commodity-neutral summary: open orders, featured/recent listings, shortcuts to Browse / Search / Orders |
| **Browse** | Generic **Category → Product → Variety → Listing** shell; coffee facets when category is coffee |
| **Search** | First-class entry: keyword + scoped (category / product / seller name); client-side OK for MVP |
| **Listing Detail** | Generic product facts + unit price/qty + **CoffeeExtensionPanel** when coffee |
| **Seller Profile** | Farm/coop/location/verified + active listings (ratings/certs future) |
| **Checkout** | Unit-aware order create (B1 modern fields preferred; kg fallback) |
| **Orders** | List + **OrderDetail**; cancel / pay / confirm delivery / certificate |
| **Account** | Language, name, logout (Settings tab → Account branding) |

**Out of scope for B2:** real payments (B4), non-coffee sell-through (B5), ratings, multi-item cart, production/store release.

## 3. Design principles

1. **Contract-first:** Prefer G1/B1 fields (`quantity`, `unitCode`, `pricePerUnit`, `qualityGrade`, `categoryCode`, `productCode`, `extensions.*`). Fall back to legacy kg/root coffee fields only in the display/order adapters.
2. **Coffee first, not coffee-only:** No screen assumes coffee is the sole commodity. Coffee UI lives in **extension panels** and **category facet config**.
3. **Reuse Farmer patterns:** React Navigation tabs/stack, shared `tabBar`, `NahuLogo`, `PaymentMethodPicker`, `COLORS`, bilingual `{am,en}` + `language` toggle, staging API config.
4. **Modular activation:** Next commodity = register facet config + extension panel — not a Browse redesign.
5. **Simulated payment stays:** Payment screen remains PIN simulation until B4 approval.

## 4. Information architecture

```
Login (OTP BUYER)
  └── Tabs
        ├── Home
        ├── Browse  (Category → Product → Variety → Listing feed)
        ├── Orders
        └── Account (Settings)
  └── Stack
        ├── Search
        ├── ListingDetail
        ├── SellerProfile
        ├── Checkout → Payment
        ├── OrderDetail
        └── Certificate
```

Browse tab icon/copy should be marketplace-neutral (not a coffee emoji as the only cue). Home header: **Nahu Farms** / Buyer badge (coffee marketing may appear in coffee category experience only).

## 5. Client architecture

### 5.1 Shared marketplace adapters (new — prefer `shared/marketplace/`)

| Module | Responsibility |
|--------|----------------|
| `listingDisplay.js` | Normalize listing → `{ qty, unitCode, unitLabel, pricePerUnit, qualityGrade, categoryCode, productName, packaging, coffee? }` |
| `orderDisplay.js` | Normalize order/cert for UI (B1 dual-write) |
| `categoryFacets.js` | Facet config by `categoryCode` (coffee: region, grade, process; default: region/price only) |
| `extensions/CoffeeExtensionPanel` pattern | Presentational block for `extensions.coffee` |

Buyer screens **must not** read `pricePerKg` / `quantityKg` directly except inside adapters.

### 5.2 API client additions (`nahu-buna-buyer/src/services/api.js`)

Wire (already exist on platform):

- `GET /categories`, `GET /products?categoryCode=`
- `GET /listings` with `categoryCode`, `productCode`, region/grade/process, sort, page
- `GET /listings/:id`
- `GET /farmers/:id` (Seller Profile)
- Orders/certs already present — switch create to `{ quantity, unitCode }` when listing unit known

### 5.3 Thin platform polish (API-only, **no SQL**)

Required for Seller Profile deep-links and seller browse:

| Change | Why |
|--------|-----|
| Expose `farmerId` on listing list/detail shapes | Cards → Seller Profile |
| `GET /listings?farmerId=` | Seller’s active listings |
| Optional: `q=` keyword on listings | Server assist for Search; else client filter in MVP |

These are additive response/query fields only — **no migration**. Apply on staging before or with APK validation.

## 6. Screen contracts (MVP)

### Home
- Counts: listings available (or recent), open orders  
- CTAs: Browse, Search, Orders  
- Optional “coffee picks” only if `categoryCode=COFFEE` (or equivalent) — labeled as category, not platform identity  

### Browse
1. Load categories → chip row (only active; coffee preselected if sole live category with inventory)  
2. Load products for selected category → chip row  
3. Optional variety chip from `product.varieties` (client filter on listing `variety` text if no server param)  
4. Facets from `categoryFacets[categoryCode]`  
5. Listing cards via `listingDisplay` (unit price + quality + photo)  

### Search
- Query field + scope chips: All / Category / Product / Seller  
- MVP: fetch listings (and categories/products as needed); filter client-side by keyword on product name, region, farmer name, coop  
- Room for future AI discovery (no UI implementation beyond placeholder hook comment / no-op)

### Listing Detail
- Generic: product name, category, qty available, unit price, packaging, region, seller summary  
- `CoffeeExtensionPanel` if `extensions.coffee` present  
- Actions: Buy → Checkout; Seller → SellerProfile  

### Seller Profile
- `GET /farmers/:id` + `GET /listings?farmerId=`  
- Show: name, location, altitude, farm size, verified, cooperative  
- Active listing cards  
- Future: ratings, public certificates (stubs not required)

### Checkout / Payment
- Qty stepper in listing `unitCode`  
- `POST /orders` with modern `{ quantity, unitCode }`  
- Address + payment method picker (shared)  
- Simulated payment → confirm-payment  

### Orders / OrderDetail
- List statuses (including awareness that logistics states exist for future)  
- Detail: B1 fields, listing product/category, coffee extension when present  
- Actions by status: cancel, pay, confirm delivery, open certificate, edit address  

### Account
- Language toggle, name edit (`PATCH /auth/me`), logout  
- Soft branding: Account (keep Settings route name internally if needed)

## 7. Localization & design system

- Continue `{ am, en }` maps + AuthContext language (buyer default `en`)  
- Reuse Farmer/shared `COLORS`; Buyer chrome `#185FA5`  
- Prefer Amharic catalog labels (`nameAm`) when language is `am`  
- Avoid hard-coded English-only coffee strings in shell chrome  

## 8. Workflow for B2 execution

| Step | B2 action |
|------|-----------|
| Architecture | This document |
| Review / Approval | Stakeholder sign-off |
| SQL | **None** |
| Prisma / API | Thin: `farmerId` on listing shape + `?farmerId=` (+ optional `q=`) |
| Tests | Listing query/shape unit or smoke; adapter unit tests if extracted |
| Docs | This file + roadmap B2 checkbox + buyer README notes |
| Staging | Deploy thin API; smoke Seller Profile + order path |
| Mobile | Implement screens/adapters as above |
| APK | EAS staging profile |
| Validation | OTP → Browse → Search → Detail → Seller → Checkout → Pay → OrderDetail → Cert |
| Commit → PR → Merge → Tag | `milestone-buyer-mvp-mobile` |

## 9. Explicit non-goals

- Production deploy  
- Real Telebirr/CBE integration  
- Activating honey/teff/etc.  
- expo-router migration  
- Full-text search engine / AI recommendations implementation  

## 10. Approval checklist

Please confirm:

- [ ] B2 scope: Home, Browse, Search, Listing Detail, Seller Profile, Checkout, Orders (+ OrderDetail), Account  
- [ ] Generic shell + Coffee extension/facet pattern (no coffee-only screen assumptions)  
- [ ] Shared `listingDisplay` / facet config in `shared/` (or buyer-local first, promote if clean)  
- [ ] Thin API: expose `farmerId` + `listings?farmerId=` (optional `q=`) — no SQL  
- [ ] Payment remains simulated  
- [ ] Staging APK only; production frozen  
- [ ] Milestone tag `milestone-buyer-mvp-mobile` after validation  

**After approval:** execute thin API → staging → mobile → APK → PR/tag.
