# Backend ↔ Mobile Feature Mapping

**Status:** Working agreement (active mobile track)  
**Date:** 2026-07-15  
**Purpose:** Keep `nahu-platform` (Nest API) and primary Expo clients synchronized. Avoid duplicating backend work or shipping mobile screens before the API is ready.

### Agreed execution track (2026-07-15)

Expose completed Nest capabilities in the **Farmer** app first, then resume backend 4.3:

| Step | Status |
|------|--------|
| **M0** Nest-only mobile integration (staging default) | **Done** (Farmer + Buyer `config.js` / `.env.example`) |
| **M1** Marketplace improvements | **Done** (verified existing Farmer edit/withdraw/photos) |
| **M2** Product picker | **Done** (New / Edit listing → `GET /products`) |
| **M3** Farm management screens | **Done** (Settings → My Farms) |
| **M4** Inventory screens | **Done** (Settings → Inventory / receive / lot movements) |
| Phase **4.3 Warehouse** | **Complete** — staging + Farmer M7 on-device; production still held |
| Phase **4.4 Listing ↔ stock** | **Staging smoked** — Farmer M8 wired; production held |
| Phase **4.5 Production planning** | **Closed** — staging + Farmer M10 on-device; Amharic packaged; production held |
| Phase **4.6 Dashboards** | **Closed** — Nest `GET /farms/dashboard` + Farmer M11 on-device; production held |
| Phase **4.7 Harvest management** | **Closed** — Nest harvest sessions + Farmer M12 on-device; production held |

**Production:** Nest production URL and EAS `production` profile stay unchanged until new mobile functionality is validated on **staging**. Canonical Farmer notes: `nahu-buna-farmer/MOBILE_NEST.md`.

**Architecture reference:** [Nahu Farm V1 Architecture Overview](02-architecture/nahu-farm-v1-architecture-overview.md) — modules, entities, API boundaries, Farmer screen hierarchy, and plan→harvest→inventory→listing→order flow.

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
| Create listing (`POST /listings`) | Done | ✅ | — | Product chips; still coffee-heavy grade/process fields |
| Update / withdraw listing (`PATCH`/`DELETE`) | Done | ✅ | — | EditListingScreen |
| Listing photo upload (`POST /uploads/listing-photo`) | Done | ✅ | — | ListingPhotoPicker |
| Category / product on listing body | Done | ✅ | 🟡 | Farmer sends codes; Buyer does not filter by product yet |

### Product Catalog

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| `GET /categories` | Done | 🟡 | 🟡 | Client helper exists on Farmer; little UI |
| `GET /products` | Done | ✅ | 🟡 | Farmer product chips (often Coffee only today) |
| Multi-commodity sell/browse UX | Catalog ready | 🔵 | 🔵 | Needs more ACTIVE products + Buyer filters |

### Farm Management (Phase 4.1)

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Farms CRUD + `GET /farms/mine` | Done (staging) | ✅ | — | Settings → My Farms |
| Plots under farm | Done (staging) | ✅ | — | Farm detail / plot form |
| Hierarchy Field / PU / full GeoJSON UX | Partial API | 🔵 | — | Deferred |

### Inventory (Phase 4.2)

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Receive / movements / lots / balances | Done (staging) | ✅ | — | Settings → Inventory |
| `storageSiteId` + `RELOCATE` | Done (staging + M7) | ✅ | — | Site chips + lot relocate |
| Reservations wired to listings | Done (staging) | 🔵 M8 | — | Optional `stockLotId`; Option B order holds |

### Orders

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Create order | Done | — | ✅ | Checkout |
| List my orders / get by id | Done | ✅ | ✅ | |
| Confirm payment (escrow simulation) | Done | — | ✅ | Payment screens |
| Confirm delivery | Done | — | ✅ | |
| Cancel / decline / dispute / update address | Done | 🟡 | 🟡 | APIs + partial client helpers |

### Payments

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Escrow confirm via order endpoint | Done (simulated) | — | ✅ | |
| `GET /payments/methods` | Done | — | 🟡 | Client helper exists; UI may still hardcode |
| Live Telebirr / CBE / webhooks | Not built | 🔵 | 🔵 | |

### Certificates

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| Certificate by order / public verify | Done | 🟡 | ✅ | Buyer Certificate screen |

### AI Advisory

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| `POST /advisory/ask` | Done | ✅ | — | |
| `GET /advisory/price-alert/:region` | Done | ✅ | — | |
| Services / weather / disease / harvest tips | Done | 🟡 | — | Helpers exist; limited UI |
| Farm/inventory-aware advisory | Future | 🔵 | — | |

### Warehouse (Phase 4.3)

| Backend | Maturity | Farmer | Buyer | Notes |
|---------|----------|--------|-------|-------|
| `GET/POST/PATCH /warehouse/sites*` | Done (staging) | ✅ | — | Settings → Storage sites (ON_FARM) |
| Inventory `storageSiteId` + `RELOCATE` | Done (staging) | ✅ | — | Receive picker, lot relocate, inventory filter |
| Zones / bins / coop sites | Deferred | 🔵 | — | Schema stub only |

---

## 2. Summary matrix (current apps)

| Backend module | Nest status | Farmer app | Buyer app | Planned role of each app |
|----------------|-------------|------------|-----------|---------------------------|
| **Identity** | Done | ✅ Login (+ `/me` refresh) | ✅ Login (+ `/me` refresh) | Auth for both roles |
| **Marketplace** | Done | ✅ Sell: profile, list, edit, photos | ✅ Buy: browse, detail | Farmer = offer; Buyer = discover |
| **Product Catalog** | Done | ✅ Product picker on listing | 🟡 No product filter yet | Farmer selects what they sell; Buyer will filter later |
| **Farm Management** | Done (staging) | ✅ My Farms / plots | — | **Farmer-only** production place |
| **Inventory** | Done (staging) | ✅ Stock receive / balances / lots | — | **Farmer-only** stock ops |
| **Warehouse** | Done (staging) | ✅ Storage sites / relocate | — | Farmer M7; production held |
| **Orders** | Done | ✅ See sales / some actions | ✅ Create, pay, delivery | Farmer fulfills; Buyer purchases |
| **Payments** | Partial (sim) | — | ✅ Simulated escrow pay | **Buyer-led**; live rails later |
| **Certificates** | Done | 🟡 | ✅ Origin cert after order | **Buyer-facing** proof; Farmer optional later |
| **AI Advisory** | Done | ✅ Ask + prices | — | **Farmer-facing** agronomy / market advice |
| **Uploads** | Done | ✅ Listing photos | — | Farmer media |

Legend: ✅ exposed in UI · 🟡 API/helpers only or partial · 🔵 planned · — not for that role

---

## 3. Recommended implementation order

Principles:

1. **Do not duplicate backend** — if Nest already exposes the capability, prefer mobile/client work.
2. **Do not build mobile screens** for APIs that are still 🔵 (especially live payments, **4.4 stock↔listing until approved + staging smoke**).
3. **Prefer additive UI** that keeps coffee MVP working when fields are omitted.
4. **Phase 4.7 Harvest management** is **Closed** on staging + Farmer M12; production still explicit. Amharic UI cleanup remains a separate follow-up.

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
| **M7** | Warehouse / storage-site UI | Farmer | **Done** against staging 4.3 API |
| **M8** | Sell-from-stock / reservation UX | Farmer | **Done** against staging 4.4 (optional lot on New Listing) |
| **M10** | Seasons / production plans UX | Farmer | **Done** — staging on-device + Amharic closeout APK |
| **M11** | Farmer Home dashboard sections (`GET /farms/dashboard`) | Farmer | **Done** — staging on-device + APK |
| **M12** | Harvest sessions UX (Session→Lines→Post) | Farmer | **Done** — staging on-device + APK |
| **M9** | Live payments UX | Buyer | **After** real provider integration (not `GET /methods` alone) |

### Backend track (stay synchronized)

| Order | Item | Relation to mobile |
|------:|------|--------------------|
| **B0** | Keep staging Nest as mobile validation target | Supports M0 |
| **B1** | Phase **4.3 Warehouse** — complete (M7 on-device) | Done; production still explicit |
| **B2** | Promote 4.2/4.3 (+ later 4.4) to production when smoke-ready | Independent of Expo UI; explicit gate |
| **B3** | Phase **4.4** listing↔stock | Done on staging (enables M8) |
| **B4** | Phase **4.5** production planning — **closed** on staging + M10 | Done; production still explicit |
| **B5** | Phase **4.6** dashboards — **closed** on staging + M11 | Done; production still explicit |
| **B7** | Phase **4.7** harvest management — **closed** on staging + M12 | Done; production still explicit |
| **B6** | Live payments / SMS production cutover | Ops + M9; separate gate |

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
