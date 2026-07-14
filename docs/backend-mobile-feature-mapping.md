# Backend ↔ Mobile Feature Mapping

**Status:** Working agreement (active mobile track)  
**Date:** 2026-07-15  
**Purpose:** Keep `nahu-platform` (Nest API) and primary Expo clients synchronized before Phase 4.3 Warehouse. Avoid duplicating backend work or shipping mobile screens before the API is ready.

### Agreed execution track (2026-07-15)

Expose completed Nest capabilities in the **Farmer** app first, then resume backend 4.3:

| Step | Status |
|------|--------|
| **M0** Nest-only mobile integration (staging default) | **Done** (Farmer + Buyer `config.js` / `.env.example`) |
| **M1** Marketplace improvements | **Done** (verified existing Farmer edit/withdraw/photos) |
| **M2** Product picker | **Done** (New / Edit listing → `GET /products`) |
| **M3** Farm management screens | **Done** (Settings → My Farms) |
| **M4** Inventory screens | **Done** (Settings → Inventory / receive / lot movements) |
| Phase **4.3 Warehouse** (architecture-first) | **Next** after staging validation of M0–M4 |

**Production:** Nest production URL and EAS `production` profile stay unchanged until new mobile functionality is validated on **staging**. Canonical Farmer notes: `nahu-buna-farmer/MOBILE_NEST.md`.

---

## Working model (confirmed)

| Layer | Repository / system | Role |
|-------|---------------------|------|
| Backend | `nahu-platform` | NestJS API, database, business logic |
| Primary mobile | `nahu-buna-farmer`, `nahu-buna-buyer` (Expo; typically under `nahu-buna-gebaya`) | Farmer and Buyer production clients |
| Legacy demos | `nahu_coffee_farmer`, `nahu_coffee_buyer` | Reference only — no new features |

**Contract:** Mobile apps consume `/api/v1` with camelCase JSON, uppercase roles, and `{ error: "…" }` errors — see [Engineering Playbook](engineering-playbook.md#mobile-compatibility).

**Evidence for this mapping**

| Source | Use |
|--------|-----|
| Nest modules under `apps/api/src/*` | Backend capability truth |
| Phase 3 / 4.1 / 4.2 design docs | Maturity and deferred slices |
| Expo Farmer/Buyer app screens + `services/api.js` (local checkout inspected 2026-07-15) | Mobile UI / client coverage |
| Staging on-device validation (Phase 2–4.1) | Confirms coffee marketplace still works against Nest without new UIs for catalog/farms |

> **M0 (done for defaults):** Canonical apps under `NAHU_GEBEYA_FOLDERS/nahu-buna-gebaya`. Default `API_BASE_URL` + `.env.example` → Nest staging. EAS `preview`/`apk` → Nest staging; EAS `production` remains on legacy Express until cutover. See Farmer `MOBILE_NEST.md`.

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Already implemented in the mobile app (screen + API calls for the core flow) |
| 🟡 | Backend complete (or sufficiently complete on staging) — mobile UI / client not yet implemented or only partial |
| 🔵 | Planned — backend incomplete or intentionally deferred; do not build mobile UI yet |
| — | Not applicable to that role |

---

## 1. Capability map

### Identity

| Backend (`nahu-platform`) | Maturity | Farmer | Buyer | Notes |
|---------------------------|----------|--------|-------|-------|
| `POST /auth/request-otp`, `POST /auth/verify-otp` | Done | ✅ | ✅ | Login screens |
| `GET /auth/me`, `PATCH /auth/me` | Done | 🟡 | 🟡 | Not surfaced as dedicated identity screens |
| SMS OTP (production AT) | Ops blocked | 🔵 | 🔵 | Staging uses bypass; production cutover holds for SMS |

### Marketplace

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Farmer profile CRUD (`/farmers/profile`) | Done | ✅ | — | Profile setup when missing |
| Public farmer profile / cooperatives list | Done | 🟡 | 🟡 | Cooperatives rarely used in UI |
| Browse listings (`GET /listings`, `GET /listings/:id`) | Done | ✅ (mine/home) | ✅ | Coffee-first UX |
| Create listing (`POST /listings`) | Done | ✅ | — | Defaults `product`/`category` to coffee when omitted |
| Update / withdraw listing (`PATCH`/`DELETE`) | Done | 🟡 | — | Edit/delete historically incomplete in app clients |
| Listing photo upload (`POST /uploads/listing-photo`) | Done | 🟡 | — | No upload client in inspected apps |
| Category / product on listing (optional body fields) | Done | 🟡 | 🟡 | Additive fields; apps do not pick products yet |

### Product Catalog

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| `GET /categories` | Done (Phase 2/3) | 🟡 | 🟡 | Apps do not call categories; coffee constants in UI |
| `GET /products`, `GET /products/:codeOrId` | Done (Phase 3) | 🟡 | 🟡 | Backend defaults listing product when mobile omits `productCode` |
| Multi-commodity sell/browse UX | Catalog ready | 🔵 | 🔵 | Wait for product picker + buyer filters when business needs a second category |

### Farm Management (Phase 4.1)

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Farms CRUD + `GET /farms/mine` | Done (staging) | 🟡 | — | Design explicitly API-first; no farm screens yet |
| Plots under farm | Done (staging) | 🟡 | — | Same |
| Hierarchy Field / PU / full GeoJSON UX | Partial API | 🔵 | — | Do not over-build UI beyond what operators need |

### Inventory (Phase 4.2)

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Receive / movements / lots / balances | Done (staging; not production-promoted) | 🟡 | — | No inventory screens; listing↔stock bind is Phase **4.4** |
| Reservations wired to listings | Schema stub | 🔵 | 🔵 | Wait for 4.4 before mobile “sell from lot” |

### Orders

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Create order | Done | — | ✅ | Checkout |
| List my orders / get by id | Done | ✅ | ✅ | Farmer: mostly read-only list |
| Confirm payment (escrow simulation) | Done | — | ✅ | Telebirr PIN screen → `PATCH …/confirm-payment` |
| Confirm delivery | Done | — | ✅ | Buyer orders UI |
| Cancel / decline / dispute / update address | Done | 🟡 | 🟡 | APIs exist; limited or no mobile actions |

### Payments

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Escrow confirm via order endpoint | Done (simulated) | — | ✅ | Demo Telebirr flow |
| `GET /payments/methods` | Done (static catalog) | — | 🟡 | Checkout hardcodes methods; does not load catalog |
| Live Telebirr / CBE / webhooks | Not built | 🔵 | 🔵 | Do not design production payment UI until provider integration land |

### Certificates

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Certificate by order / public verify | Done | 🟡 | ✅ | Buyer certificate screen; farmer rarely surfaces certs |

### AI Advisory

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| `POST /advisory/ask` | Done | ✅ | — | Chat UI |
| `GET /advisory/price-alert/:region` | Done | ✅ | — | Used from advisory screen |
| Services / weather / disease / harvest tips | Done | 🟡 | — | Not wired in inspected UI |
| Farm/inventory-aware advisory | Future | 🔵 | — | Better after farms + stock are used in mobile |

---

## 2. Summary matrix

| Capability | Backend | Farmer app | Buyer app |
|------------|---------|------------|-----------|
| Identity | Done | ✅ OTP login · 🟡 `/me` | ✅ OTP login · 🟡 `/me` |
| Marketplace | Done | ✅ core sell flow · 🟡 edit/upload/product pick | ✅ browse + detail |
| Product Catalog | Done (staging) | 🟡 | 🟡 |
| Farm Management | Done (staging) | 🟡 | — |
| Inventory | Done (staging) | 🟡 | — |
| Orders | Done | ✅ list · 🟡 actions | ✅ create/pay/delivery · 🟡 cancel/dispute |
| Payments | Partial (catalog + sim) | — | ✅ sim · 🔵 live |
| Certificates | Done | 🟡 | ✅ |
| AI Advisory | Done | ✅ ask/prices · 🟡 extras | — |

---

## 3. Recommended implementation order

Principles:

1. **Do not duplicate backend** — if Nest already exposes the capability, prefer mobile/client work.
2. **Do not build mobile screens** for APIs that are still 🔵 (especially live payments, 4.4 stock↔listing, 4.3 warehouse until designed).
3. **Prefer additive UI** that keeps coffee MVP working when fields are omitted.
4. **Backend Phase 4.3 Warehouse** can proceed in parallel with early Farmer mobile for 4.1/4.2 **after** M0–M1 hygiene.

### Mobile track (Farmer / Buyer Expo)

| Order | Item | Apps | Why now |
|------:|------|------|---------|
| **M0** | Point all builds at Nest staging; remove legacy Express hardcoding; uppercase roles; camelCase payloads | Both | Without this, new screens test the wrong backend |
| **M1** | Marketplace gap fill: listing edit/withdraw; optional listing photo; status enums aligned with Nest | Farmer | Completes MVP using APIs that already exist |
| **M2** | Lightweight catalog awareness: load `GET /products` (coffee) for listing create; optional buyer filter later | Farmer first · Buyer optional | Unlocks multi-product without waiting on Warehouse |
| **M3** | Farm management screens (`/farms`, plots) | Farmer | Backend 4.1 ready; needed before inventory UX makes sense |
| **M4** | Inventory screens (receive, balances, lot history) | Farmer | Backend 4.2 ready on staging; **do not** bind listings until 4.4 |
| **M5** | Order action gaps (farmer decline; buyer cancel/dispute/address) | Both | Improves ops; independent of Nahu Farm |
| **M6** | Advisory extras + certificates for farmer (optional) | Farmer | Nice-to-have after M3–M4 |
| **M7** | Warehouse / storage-site UI | Farmer | **After** 4.3 API is designed, approved, and on staging |
| **M8** | Sell-from-stock / reservation UX | Farmer | **After** Phase 4.4 backend |
| **M9** | Live payments UX | Buyer | **After** real provider integration (not `GET /methods` alone) |

### Backend track (stay synchronized)

| Order | Item | Relation to mobile |
|------:|------|--------------------|
| **B0** | Keep staging Nest as mobile validation target | Supports M0 |
| **B1** | Phase **4.3 Warehouse** design → approve → implement (API-first) | Enables M7; do not start warehouse mobile earlier |
| **B2** | Promote 4.2 (+ later 4.3) to production when smoke-ready | Independent of Expo UI, but coordinate release notes |
| **B3** | Phase **4.4** listing↔stock | Enables M8 |
| **B4** | Phase 4.5 / 4.6 planning & dashboards | Mobile dashboards after data exists |
| **B5** | Live payments / SMS production cutover | Ops + M9; separate gate |

### Explicit “do not do yet”

| Temptation | Why wait |
|------------|----------|
| Buyer “multi-warehouse” or logistics screens | Phase 5 Delivery |
| Farmer “sell from lot” before 4.4 | Reservations not wired |
| Rich warehouse WMS UI before 4.3 design | Premature |
| Live Telebirr production screens on simulated confirm | Misleading UX |
| New features in coffee demo apps | Legacy / reference only |

---

## 4. Sync rule before Phase 4.3

Agreed checkpoint:

1. Review this map (this document).
2. Start **Phase 4.3 Warehouse** as **backend design-first** (same process as 4.1 / 4.2).
3. In parallel (optional, mobile repo): execute **M0 → M3** so Farmer app gains farms (and later inventory) without blocking warehouse design.
4. Do **not** schedule warehouse mobile (M7) until 4.3 staging APIs exist.

---

## Related documents

- [Documentation index](README.md)
- [Engineering Playbook — mobile compatibility](engineering-playbook.md#mobile-compatibility)
- [Phase 3 — Product Catalog](07-decisions/phase-3-product-catalog-design.md)
- [Phase 4 — Farmer Platform](07-decisions/phase-4-farmer-platform-design.md)
- [Phase 4.1 — Farm management](07-decisions/phase-4.1-farm-management-design.md)
- [Phase 4.2 — Inventory](07-decisions/phase-4.2-inventory-design.md)
- [API README](../apps/api/README.md)
