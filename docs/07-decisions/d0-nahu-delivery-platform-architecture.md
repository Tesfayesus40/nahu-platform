# D0 — Nahu Delivery Platform Software Architecture Document (SAD)

**Status:** Approved (architecture) — D1–D12 roadmap approved; implement milestone-by-milestone  
**Date:** 2026-07-23  
**Version:** 1.2  
**Audience:** Product · Operations · Engineering · Security · Mobile  
**Depends on:** Backend RC2 · Admin Portal RC1 (A0–A14) · Farmer RC1 · Buyer RC1 · A9 Orders · A10 Fulfillment handoff · Phase 4 Inventory/Warehouse designs  
**Constraint:** Implement only the approved milestone (pause after each Dn for review when requested). Mobile never calls `/admin/*`.

---

## 0. Approved decisions

### 0.1 Core (2026-07-23)

| ID | Decision | Phase 1 implication |
|----|----------|---------------------|
| **AD-1** | Buyer confirmation after delivery is **configurable**, not mandatory | System setting / flag `delivery.buyer_confirm_required` (default **true**). When **false**, successful DROPOFF POD may advance order to `COMPLETED` + certificate. When **true**, POD → `DELIVERED` only; buyer (or Admin) completes. |
| **AD-2** | Courier onboarding is **OTP-based** for RC1 | Same identity OTP pattern as Farmer/Buyer. Invitation / password-invite workflows **deferred**. |
| **AD-3** | Courier App is a **separate Expo application** in the existing gebaya monorepo | `nahu-buna-courier/` beside farmer/buyer; `shared/delivery/`. Never `/admin/*`. |
| **AD-4** | Explicit **Delivery State Machine** + **Orders vs Shipments** | Orders = commercial SoR; Shipments = physical SoR. One active shipment in RC1; schema allows N. |

### 0.2 Refinements (2026-07-23 — pre-implementation)

| ID | Decision | Phase 1 implication |
|----|----------|---------------------|
| **RF-1** | Dedicated **Dispatch Service** | Nest `DispatchService` owns offer / assign / reassign / unassign. Controllers and Admin actions call it; no inline assignment logic in courier or Admin controllers. |
| **RF-2** | Shipments are **collections of Stops** from day one | Schema and APIs always model `Shipment → Stop[]`. RC1 may create a single DROPOFF (plus PICKUP) but never collapse shipment≡stop. |
| **RF-3** | Publish **delivery lifecycle events** | Every normative state transition emits a domain event (`delivery.*`) for notifications, audit enrichment, analytics, and future AI. Events are append-only; consumers are non-blocking. |
| **RF-4** | **Courier availability states** | `CourierProfile.availability` (`OFFLINE \| AVAILABLE \| BUSY \| ON_BREAK`) from D3 UX / D5 APIs. Dispatch only offers to `AVAILABLE` (Admin override allowed + audit). |
| **RF-5** | **Geospatial fields** in schema | Stops, pings, and POD store `lat`/`lng`/`accuracy_m`; optional stop `geofence_radius_m`. Ready for future routing without migrations. |
| **RF-6** | Extended **POD** model | Optional signature (media or stroke payload URL), GPS, recipient name, and captured timestamp — in addition to photo method. |
| **RF-7** | **Immutable earnings ledger** from initial schema | `courier_earnings` is append-only accruals; corrections are new `ADJUSTED`/`VOID` rows referencing originals — never UPDATE amount in place. Admin/courier read APIs may land in later Dn; table exists from D2. |
| **RF-8** | **Delivery analytics from first implementation** | Lifecycle events feed analytics counters/series from D4 onward; D1 seeds `delivery.analytics.enabled` and metric thresholds. No separate analytics rewrite later. |

Deferred (defaults locked for Phase 1):

| ID | Default |
|----|---------|
| OD-4 Multi-shipment | Phase 1: **one active outbound** shipment per case; schema allows many |
| OD-5 Earnings payout | Manual `PAID` marker only; no wallet rails |
| OD-6 Live map | Abstract geo; Phase 1 list + OS maps deep-link |

---

## 1. Executive decision

Build **Nahu Delivery** as a first-class domain module inside the existing `nahu-platform` modular monolith — not a separate microservice and not a rewrite of Orders or Admin A10.

```text
nahu-buna-farmer/          nahu-buna-buyer/          nahu-buna-courier/  ★ NEW
        │                        │                           │
        │  Nest /api/v1/*        │  Nest /api/v1/*           │  Nest /api/v1/delivery/courier/*
        │  (never /admin/*)      │  (never /admin/*)         │  OTP + COURIER role (never /admin/*)
        ▼                        ▼                           ▼
                     apps/api  (NestJS modular monolith)
        ┌────────────┬───────────────┬──────────────┬────────────────┐
        │ Orders ★   │ Delivery ★    │ Inventory    │ Identity/Audit │
        │ (commerce) │ Shipments ★   │ DISPATCH ★   │ Notifications  │
        │ Escrow     │ Stops / POD   │ Reservations │ Reporting      │
        │ Disputes   │ State machine │              │                │
        └────────────┴───────────────┴──────────────┴────────────────┘
                              │
                              ▼
                     PostgreSQL schema `delivery`
                     (extends A10 fulfillment_cases)
                              │
                              ▼
                     Admin Portal (RC1) — Delivery ops + exceptions
```

★ = owned or substantially extended by this phase.

### Why this shape

1. **A10 already exists** as a thin handoff surface. Phase 1 **extends** that contract.
2. **Orders** remain the commercial system of record. **Shipments** are the physical system of record. Sync is one-way policy-driven (Delivery → Orders), never the reverse inventing logistics state.
3. **Mobile apps never call `/admin/*`**.
4. **Inventory DISPATCH** becomes real on successful dropoff path.
5. Domain separation enables **split shipments, returns, and multiple couriers** later without re-architecture (see §4).

### Recommended foundations

1. Keep **one fulfillment case per order** (A10). Introduce **shipments** as collections of **stops** (RF-2; 1..N stops, 1..N shipments).
2. Role `COURIER` distinct from Farmer/Buyer/Admin workforce; **availability** states for dispatch (RF-4).
3. **DispatchService** is the only assignment authority (RF-1).
4. **POD** is first-class evidence (photo, optional signature/GPS/recipient/timestamp — RF-6).
5. **Earnings** are an **immutable** ledger from day one (RF-7).
6. **Lifecycle events** + analytics from first logistics implementation (RF-3, RF-8).
7. **AI** is suggestion-only extension host (consumes events; never SoR).

---

## 2. Goals and non-goals

### 2.1 Goals (Phase 1 Delivery)

| Goal | Outcome |
|------|---------|
| Close escrow ↔ logistics gap | Path: handoff → transit → POD → configurable completion |
| Courier operations | OTP onboard, accept jobs, stops, POD, exceptions, earnings |
| Farmer / Buyer visibility | Honest tracking; configurable confirm |
| Preserve Admin RC1 | A10 compatible; richer shipment/POD detail |
| Inventory integrity | `DISPATCH` on successful dropoff |
| Future-proof domain | Orders ≠ Shipments; multi-shipment-ready schema |
| Security & audit | AdminAuth/RBAC/reauth; append-only audit |

### 2.2 Non-goals (Phase 1)

- Full TMS / dynamic VRP at scale  
- Carrier EDI / live Telebirr courier payroll  
- Courier invitation workflows (deferred)  
- Mandatory buyer confirm (configurable instead)  
- Cross-border / customs  
- Live map vendor as core SoR  
- Split shipments / returns UX (schema-ready only)

---

## 3. Current-state integration baseline (must not break)

| Surface | Today | Delivery Phase 1 rule |
|---------|-------|------------------------|
| A10 Admin fulfillments | Case statuses + actions | Keep endpoints; enrich; add shipment actions |
| Buyer `confirm-delivery` | Escrow → COMPLETED; no fulfillment sync | Honor AD-1 config; sync case when applicable |
| Farmer ship | Support-managed copy | Seller ready/handoff APIs |
| Inventory `DISPATCH` | Unused | Wire on dropoff success |
| RC2 | Moderation ↔ order gate | Delivery must not bypass |

---

## 4. Domain model — Orders vs Shipments

### 4.1 Separation principle (normative)

| Concern | **Orders** domain | **Delivery / Shipments** domain |
|---------|-------------------|----------------------------------|
| Purpose | Commercial agreement, money, escrow, dispute, certificate | Physical movement, evidence, courier work |
| Aggregate root | `orders.orders` | `delivery.shipments` (under `fulfillment_cases`) |
| Status meaning | Buyer/seller commercial lifecycle | Logistics lifecycle |
| Actors | Buyer, Farmer, Admin (commerce) | Courier, Seller handoff, Admin (ops) |
| Money | Escrow, payment, settlement | Courier **earnings** ledger only |
| Evidence | Dispute evidence, certificates | POD, tracking events, exceptions |
| Cardinality | **1 order** | **1 fulfillment case** ↔ **1..N shipments** (Phase 1: 1 active) |

**Invariant:** An order never “is” a shipment. A shipment never owns escrow. Status sync is explicit (Delivery State Machine → Order sync policy).

### 4.2 Why this enables future features without redesign

| Future need | How the model absorbs it |
|-------------|--------------------------|
| **Split shipments** | Multiple `shipments` on one `fulfillment_case`; each with own stops/courier; order stays `SHIPPED`/`PARTIALLY_DELIVERED` (future order status) until all required shipments complete |
| **Returns** | New shipment with `kind=RETURN` (or `shipment_type`) and reverse stop sequence; new case linkage optional; order dispute/return commercial states stay in Orders |
| **Multiple couriers** | Assignments per shipment (or per stop); history table; one courier active per shipment in Phase 1 |
| **Re-delivery** | New shipment or new stop attempt on same dropoff; prior FAILED stops retained |

Phase 1 **product** uses single active outbound shipment; Phase 1 **schema/rules** must not hard-code 1:1 shipment↔order uniqueness beyond a soft “one ACTIVE” constraint.

### 4.3 Ubiquitous language

| Term | Meaning |
|------|---------|
| **Order** | Commercial SoR (payment, escrow, dispute, certificate). |
| **Fulfillment case** | 1:1 ops envelope for an order (A10). Parent of shipments. |
| **Shipment** | One planned physical movement; **always** a collection of stops (RF-2). Physical SoR. |
| **Stop** | Pickup or drop-off on a shipment (never equated to the shipment). |
| **Assignment** | Courier bound to a shipment via **DispatchService** (history allowed). |
| **POD** | Proof for a stop attempt (photo + optional signature, GPS, recipient, timestamp). |
| **Exception** | Ops failure; may freeze commercial completion. |
| **Courier availability** | `OFFLINE \| AVAILABLE \| BUSY \| ON_BREAK` — input to dispatch. |
| **Courier earning** | Immutable ledger accrual/adjustment for billable work. |
| **Lifecycle event** | Published domain event on normative transitions (`delivery.*`). |
| **Tracking event** | Immutable case timeline (extends A10 `fulfillment_events`; may mirror lifecycle). |

### 4.4 Aggregate map

```text
Order (orders)  ←── commercial SoR
  │
  └── FulfillmentCase (delivery) ──── 1:1 with order
        │
        ├── Shipment[] (delivery) ──── 1..N  ←── physical SoR
        │     ├── type: OUTBOUND | RETURN (Phase 1: OUTBOUND only)
        │     ├── Stop[] (1..N) ──────── RF-2: collection required (RC1: typically PICKUP+DROPOFF)
        │     │     ├── geo (lat/lng/accuracy_m, geofence_radius_m?)
        │     │     ├── attempt_count
        │     │     └── ProofOfDelivery[] (attempts; 0..1 success)
        │     └── Assignment[] ← owned by DispatchService (0..1 active)
        ├── TrackingEvent[]
        ├── LifecycleEvent[] (published; feeds notifications/audit/analytics/AI)
        └── ExceptionRecord[] (optional normalized)

CourierProfile (delivery) ── userId → identity.users (role COURIER)
  └── availability: OFFLINE | AVAILABLE | BUSY | ON_BREAK
CourierEarningLedger (delivery) ── immutable append-only (RF-7)
```

### 4.5 Core entities (logical)

**FulfillmentCase** (existing + extensions)  
Status: `PENDING_HANDOFF | READY | IN_TRANSIT | DELIVERED | EXCEPTION | CLOSED`  
Extensions: windows, service level, last tracking summary.  
**Roll-up rule:** Case status is a **projection** of active shipment(s) + policy — never independently invent logistics without a shipment event (Admin override allowed with audit).

**Shipment**  
`id`, `fulfillment_id`, `shipment_type` (`OUTBOUND` | `RETURN`), `status`, `courier_user_id?` (denormalized active assignee), `vehicle_type?`, `sequence`, timestamps.  
**Invariant:** every shipment has **≥1 stop** before `OFFERED` (RF-2). RC1 typically seeds PICKUP + DROPOFF even when product UX emphasizes one customer stop.  
Phase 1 constraint: at most **one** outbound shipment in `{OFFERED, ACCEPTED, IN_PROGRESS}` per case.

**Stop**  
`id`, `shipment_id`, `sequence`, `kind` (`PICKUP` | `DROPOFF`), `status`, address snapshot, contact,  
`lat`/`lng`/`accuracy_m` (target), `geofence_radius_m?` (RF-5), windows, `attempt_count`, timestamps.

**ProofOfDelivery** (RF-6)  
`id`, `stop_id`, `attempt_no`, `method` (`PHOTO` | `SIGNATURE` | `PIN` | `GPS_ONLY` | `PHOTO_AND_SIGNATURE`),  
`media_urls[]` (photos), `signature_url?`, `lat?`, `lng?`, `accuracy_m?`, `captured_at` (required),  
`captured_by_user_id`, `recipient_name?`, `notes?`.

**CourierProfile**  
`user_id`, display/phone, `vehicle_type`, `active`, `verified`, `service_regions[]`,  
`availability` (`OFFLINE` | `AVAILABLE` | `BUSY` | `ON_BREAK`) (RF-4),  
optional last-known `lat`/`lng`/`accuracy_m`/`location_at` (RF-5).

**CourierEarning** (RF-7 — immutable)  
Append-only row: `id`, courier, shipment/stop, `amount_etb`, `status` (`ACCRUED` | `ADJUSTED` | `PAID` | `VOID`),  
`policy_code`, `replaces_earning_id?` (for adjustments/voids), `metadata_json`, `created_at`.  
**Never** UPDATE `amount_etb` on an existing row.

**LifecycleEvent** (RF-3)  
`id`, `event_type`, `occurred_at`, `actor_user_id?`, `fulfillment_id?`, `shipment_id?`, `stop_id?`, `order_id?`, `payload_json`, `correlation_id?`.

---

## 5. Delivery State Machine (explicit)

This section is normative for Phase 1 implementation (D2/D4).

### 5.1 Shipment state machine (physical SoR)

```text
                    ┌──────────┐
                    │  DRAFT   │
                    └────┬─────┘
                         │ create / plan stops
                         ▼
                    ┌──────────┐
           ┌───────│  OFFERED  │◄──── re-offer (Admin)
           │       └────┬─────┘
           │            │ courier accept
           │            ▼
           │       ┌──────────┐
           │       │ ACCEPTED │
           │       └────┬─────┘
           │            │ first stop arrive / start
           │            ▼
           │       ┌────────────┐
           │       │ IN_PROGRESS│──────► EXCEPTION path (case)
           │       └────┬───────┘
           │            │ all required stops COMPLETED
           │            ▼
           │       ┌──────────┐
           │       │COMPLETED │
           │       └──────────┘
           │
           └──► CANCELLED  (only before IN_PROGRESS, or Admin override + audit)
```

| From | To | Trigger | Guards |
|------|----|---------|--------|
| — | `DRAFT` | Create shipment | Case not CLOSED; order not terminal without ops override |
| `DRAFT` | `OFFERED` | **DispatchService** assign / offer | ≥1 stop (RC1: ≥1 PICKUP + ≥1 DROPOFF); courier `AVAILABLE`+active(+verified) or Admin force + audit |
| `OFFERED` | `ACCEPTED` | Courier accept | Actor = offered courier |
| `ACCEPTED` | `IN_PROGRESS` | Arrive first stop or explicit start | — |
| `IN_PROGRESS` | `COMPLETED` | All required stops COMPLETED | DROPOFF has successful POD |
| `DRAFT`/`OFFERED`/`ACCEPTED` | `CANCELLED` | Admin/seller cancel | Audit if Admin |
| `IN_PROGRESS` | `CANCELLED` | Admin only + reauth | Exception recorded |
| any open | (case `EXCEPTION`) | Stop FAIL / dispute | Shipment may stay `IN_PROGRESS` or pause |

### 5.2 Stop state machine

```text
PENDING ──arrive──► ARRIVED ──complete+POD──► COMPLETED
                       │
                       └──fail──► FAILED ──(retry)──► PENDING (attempt_count++)
```

| Transition | Rules |
|------------|-------|
| → `COMPLETED` (DROPOFF) | Valid POD required (photo and/or signature; GPS recommended) |
| → `COMPLETED` (PICKUP) | POD optional in Phase 1 (config `delivery.pickup_pod_required`) |
| → `FAILED` | Exception code + notes; does **not** complete shipment |
| Retry | Increment `attempt_count`; prior POD attempts retained |

### 5.3 Fulfillment case roll-up (A10-compatible)

| Case status | When |
|-------------|------|
| `PENDING_HANDOFF` | No READY shipment; awaiting seller/Admin ready |
| `READY` | Seller/Admin marked ready; shipment may be DRAFT/OFFERED |
| `IN_TRANSIT` | Active shipment `IN_PROGRESS` (or ACCEPTED after pickup) |
| `DELIVERED` | Active outbound shipment `COMPLETED` with successful DROPOFF |
| `EXCEPTION` | Open exception / order `DISPUTED` / failed terminal attempt pending ops |
| `CLOSED` | Ops closed; no further courier work |

Side path: open → `EXCEPTION` → resolve to prior or `CLOSED`.

### 5.4 Order sync policy (commercial) — AD-1

Delivery **proposes** order transitions; Orders service **applies** them under guards (dispute freeze, payment state).

| Delivery event | Order transition | Notes |
|----------------|------------------|-------|
| Seller ready / Admin `MARK_READY` | → `CONFIRMED` (from `PAID_ESCROW` / already `CONFIRMED`) | Case → `READY` |
| Shipment in transit (pickup done or IN_PROGRESS) | → `SHIPPED` | Case → `IN_TRANSIT` |
| DROPOFF POD accepted | → `DELIVERED` | Case → `DELIVERED`; inventory DISPATCH |
| After `DELIVERED`, if `delivery.buyer_confirm_required=true` | Wait | Buyer `confirm-delivery` or Admin `COMPLETE_ORDER` → `COMPLETED` + certificate |
| After `DELIVERED`, if `delivery.buyer_confirm_required=false` | → `COMPLETED` | Same transaction as POD success path (or immediate follow-up); certificate issued |
| Config legacy: `delivery.buyer_confirm_from_escrow` | `PAID_ESCROW` → `COMPLETED` | **Only if no active shipment**; default **false** when Delivery enabled |
| Dispute opened | → `DISPUTED` | Case → `EXCEPTION`; **block** COMPLETED |

**Invariants:**

1. Certificate issuance stays Orders/Certificates ownership on `COMPLETED`.  
2. Delivery never sets `COMPLETED` when buyer confirm is required.  
3. Delivery never advances commercial state while order is `DISPUTED` (except evidence recording).

### 5.5 Config keys (Phase 1)

| Key | Default | Meaning |
|-----|---------|---------|
| `delivery.buyer_confirm_required` | `true` (feature flag) | AD-1 |
| `delivery.buyer_confirm_from_escrow` | `false` (feature flag) | Legacy shortcut when no shipment |
| `delivery.pickup_pod_required` | `false` (feature flag) | Require POD on PICKUP |
| `delivery.courier_app.enabled` | `true` staging / ops-set (feature flag) | Gate COURIER OTP + courier APIs |
| `delivery.analytics.enabled` | `true` (feature flag) | RF-8: emit/collect analytics from lifecycle events |
| `delivery.earning.flat_etb` | `"0"` (system setting value) | Flat fee per completed DROPOFF |

Boolean gates live in `ops.feature_flags`. Non-boolean values live in `ops.system_settings` (D1).

---

## 5.5 Lifecycle events catalog (RF-3)

Published on normative transitions (non-exhaustive; extend in D4):

| Event type | Typical trigger |
|------------|-----------------|
| `delivery.shipment.created` | Create shipment + stops |
| `delivery.shipment.offered` | DispatchService offer/assign |
| `delivery.shipment.reassigned` | DispatchService reassign |
| `delivery.shipment.accepted` | Courier accept |
| `delivery.shipment.started` | IN_PROGRESS |
| `delivery.shipment.completed` | COMPLETED |
| `delivery.shipment.cancelled` | CANCELLED |
| `delivery.stop.arrived` | Arrive |
| `delivery.stop.completed` | Complete + POD |
| `delivery.stop.failed` | Fail |
| `delivery.pod.captured` | POD persisted |
| `delivery.case.exception` | Case → EXCEPTION |
| `delivery.earning.accrued` | Ledger ACCRUED |
| `delivery.courier.availability_changed` | Availability patch |

Consumers: Admin notifications, audit enrichment, analytics aggregates (RF-8), future AI. Publishers must not fail the business transaction if a consumer errors (outbox or try/catch + log).

---

## 6. Database schema (target)

**Module:** PostgreSQL schema `delivery` (existing).  
**Style:** SQL-first `delivery/003+`; Prisma updated to match.

### 6.1 Retain

- `delivery.fulfillment_cases`
- `delivery.fulfillment_events`

### 6.2 Add (Phase 1 / D2+)

```text
delivery.shipments              -- 1..N per fulfillment; soft unique active
delivery.stops                  -- 1..N per shipment (RF-2); geo columns (RF-5)
delivery.proofs_of_delivery     -- extended POD (RF-6)
delivery.courier_profiles       -- availability (RF-4); optional last geo
delivery.courier_assignments    -- history; written only via DispatchService
delivery.courier_earnings       -- immutable ledger (RF-7)
delivery.lifecycle_events       -- published domain events (RF-3 / RF-8)
delivery.tracking_pings         -- optional breadcrumbs (geo)
```

D1 also seeds: `ops.feature_flags` (delivery.*), `ops.system_settings` (`delivery.earning.flat_etb`), identity `COURIER` + permissions, analytics-related alert thresholds.

### 6.3 Normative constraints (future-proof)

- **No** forever 1:1 unique on `fulfillment_id` → shipment.  
- Partial unique / app rule: one active outbound in `{OFFERED, ACCEPTED, IN_PROGRESS}`.  
- `shipment_type` from day one.  
- Shipment cannot leave `DRAFT` without ≥1 stop.  
- Earnings: no in-place amount updates; adjustments reference `replaces_earning_id`.  
- Geo columns nullable but present (RF-5).

### 6.4 Cross-schema references

| From | To |
|------|----|
| `fulfillment_cases.order_id` | `orders.orders` |
| `courier_profiles.user_id` | `identity.users` |
| DISPATCH | `inventory` movements |
| Media | existing uploads |
| Config | `ops.feature_flags`, `ops.system_settings` |

### 6.5 Migration strategy

1. Additive only.  
2. Optional backfill: one shipment **with stops** from existing case status.  
3. Seed config keys in D1.

---

## 7. API contracts

Base: `/api/v1`  
Auth: Bearer JWT. Couriers: **OTP** + `COURIER` role (AD-2). Admin: AdminAuth + MFA + permissions.

### 7.1 Admin (extend A10)

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/admin/delivery/fulfillments` | `delivery.read` | Queue + shipment summary |
| GET | `/admin/delivery/fulfillments/:id` | `delivery.read` | Detail + stops + POD |
| POST | `/admin/delivery/fulfillments/:id/actions` | `delivery.manage` | Existing + `CREATE_SHIPMENT`, `ASSIGN_COURIER` / `REASSIGN_COURIER`, `CANCEL_SHIPMENT` (assign via DispatchService) |
| GET | `/admin/delivery/couriers` | `delivery.read` | Directory |
| POST | `/admin/delivery/couriers/:userId/verify` | `delivery.couriers.manage` | Verify (reauth) |
| GET | `/admin/delivery/earnings` | `delivery.earnings.read` | Ledger |
| POST | `/admin/delivery/earnings/:id/adjust` | `delivery.earnings.manage` | Adjust/void (reauth) |

### 7.2 Courier (new)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/delivery/courier/me` | Profile + **availability** |
| PATCH | `/delivery/courier/me` | Vehicle / regions |
| PATCH | `/delivery/courier/me/availability` | Set OFFLINE/AVAILABLE/BUSY/ON_BREAK (RF-4) |
| GET | `/delivery/courier/shipments` | Offered / active / history |
| GET | `/delivery/courier/shipments/:id` | Stops |
| POST | `/delivery/courier/shipments/:id/accept` | Accept |
| POST | `/delivery/courier/stops/:id/arrive` | Arrive |
| POST | `/delivery/courier/stops/:id/complete` | POD |
| POST | `/delivery/courier/stops/:id/fail` | Exception |
| POST | `/delivery/courier/shipments/:id/location` | Optional ping |
| GET | `/delivery/courier/earnings` | Own ledger |

Onboarding: existing identity OTP endpoints with audience/role `COURIER` (exact path aligned in D3; no invite API in Phase 1).

### 7.3 Seller / Buyer

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/delivery/seller/orders/:orderId/...` | Fulfillment read, ready, optional handoff confirm |
| GET | `/delivery/buyer/orders/:orderId/tracking` | Sanitized tracking |
| PATCH | `/orders/:id/confirm-delivery` | Honors AD-1 + escrow flag |

### 7.4 Conventions

- Mobile errors `{ error }`; Admin list `{ page, limit, total, items }`.  
- Idempotency-Key on accept + POD complete.  
- Admin mutations: `reauthPassword` + audit `delivery.*`.

---

## 8. Mobile application architecture

### 8.1 Apps (AD-3)

| App | Path | Phase 1 |
|-----|------|---------|
| Farmer | `nahu-buna-farmer/` | Ready / handoff / status |
| Buyer | `nahu-buna-buyer/` | Tracking + confirm when required |
| **Courier** | **`nahu-buna-courier/`** | OTP login, jobs, stops, POD, earnings |

Shared: `shared/delivery/` status labels EN/AM + view mappers.

### 8.2 Courier app structure

```text
nahu-buna-courier/
  app.json / eas.json
  src/
    context/AuthContext.js       # OTP COURIER; RC1 tokenStorage pattern
    services/api.js              # /delivery/courier/* only
    screens/ Home, JobDetail, StopFlow, PodCapture, Earnings, Settings
    navigation/AppNavigator.js
```

Copy Farmer/Buyer RC1: fail-closed OTP, `__DEV__` hints only, AsyncStorage tokens, `getFriendlyError`, Nest staging EAS.

### 8.3 Offline / media

- Queue POD upload when offline; block accept offline.  
- POD via existing upload pipeline → `media_urls`.

---

## 9. Backend modules

```text
apps/api/src/delivery/
  delivery.module.ts
  admin-delivery.*                 # enrich
  courier-delivery.*               # new
  seller-delivery.* / buyer-delivery.*
  dispatch.service.ts              # RF-1: assign / reassign / unassign only
  delivery-state.machine.ts        # §5 normative transitions
  delivery-sync.service.ts         # order + inventory
  delivery-events.publisher.ts     # RF-3: lifecycle events
  delivery-analytics.service.ts    # RF-8: consume/aggregate when enabled
  earnings.service.ts              # RF-7: append-only ledger writes
  shipment.rules.ts / pod.rules.ts / fulfillment.rules.ts
  delivery-config.service.ts       # feature flags + system_settings
  dto/
```

**Transaction:** POD success + order DELIVERED (+ COMPLETED if confirm not required) + DISPATCH + earning accrual + lifecycle event persist in one transaction where possible; async consumers after commit.

---

## 10. Admin Portal

- Keep A10 IA; enrich shipment/POD/earnings.  
- Courier verify + earnings adjust with ConfirmActionModal.  
- BFF proxies Admin only; courier APIs are mobile Nest-direct.  
- Metrics: exceptions, in_transit, pod_pending.

---

## 11. Security & RBAC

| Concern | Approach |
|---------|----------|
| Courier auth | OTP + `COURIER` role (AD-2); no `/admin/*` |
| Admin | Existing MFA + permissions + reauth |
| PII | Address to assigned courier after accept |
| Location | Retention 30–90 days; not public |
| Rate limits | accept / POD / location |

Permissions: existing `delivery.read` / `delivery.manage` + `delivery.earnings.read|manage` + `delivery.couriers.manage`.  
Seed role `COURIER` + permission migration.

---

## 12. Notifications & tracking

- Phase 1: in-app poll for courier; Admin notice on EXCEPTION.  
- Push inbox not blocking.  
- Buyer/Farmer: sanitized projection (no raw GPS stream).  
- Event types: extend A10 with `ASSIGNED`, `ACCEPTED`, `ARRIVED_*`, `POD_CAPTURED`, etc.

---

## 13. POD, earnings, inventory

- DROPOFF COMPLETED requires POD: photo and/or signature; GPS + `recipient_name` + `captured_at` strongly recommended / required fields per RF-6 (`captured_at` always set server-side if client omits).  
- Earnings: flat fee from `delivery.earning.flat_etb`; ACCRUED append-only; adjustments/voids are new rows; Admin adjust; PAID = ops marker (read APIs may lag schema — RF-7).  
- Inventory DISPATCH on successful DROPOFF; missing reservation → warn, don’t fail POD.

---

## 14. AI extensibility

Suggestion-only: route order, ETA, exception classify, POD anomaly. Consumes lifecycle events (RF-3). Never mutates money/order without deterministic rule or human confirm.

---

## 15. Cross-app UX contracts

| App | Must | Must not |
|-----|------|----------|
| Buyer | Tracking; confirm **when config requires** | Fake transit without shipment |
| Farmer | Ready/handoff APIs | Ship without ready |
| Courier | Own jobs only | Admin routes |
| Admin | Exceptions, assign, POD | Replace courier app |

---

## 16. NFRs

POD p95 < 3s (ex-upload); tracking read < 500ms; full Admin audit; Idempotency on accept/POD; structured logs + metrics.

---

## 17. Risks (post-approval)

| Risk | Mitigation |
|------|------------|
| Dual paths during migration | Feature flags; escrow confirm only if no shipment |
| Farmer/Buyer apps lag courier | Seller/buyer APIs + honest copy first; polish in D-milestones |
| Multi-shipment premature complexity | One active shipment enforced; schema still 1..N |
| Auto-complete disputes | Dispute freeze always wins over AD-1 auto-complete |

---

## 18. Success criteria (architecture)

1. AD-1…AD-4 and RF-1…RF-8 accepted (this version).  
2. A10 backward compatible.  
3. Never `/admin/*` from mobile.  
4. Orders ≠ Shipments; shipments always stop collections.  
5. DispatchService is sole assignment authority.  
6. Delivery State Machine §5 implementable as pure rules module.

**Next:** implement **D1** only; pause for review before D2.

---

## 19. Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-23 | Initial SAD (proposed) |
| 1.1 | 2026-07-23 | Approved decisions AD-1…AD-4; explicit Delivery SM; Orders vs Shipments |
| 1.2 | 2026-07-23 | RF-1…RF-8: DispatchService, stops collection, lifecycle events, availability, geo, POD extensions, immutable earnings, analytics |

**Related:** `d1-d12-delivery-implementation-roadmap.md`, `a10-delivery-logistics-administration-design.md`, `a0-admin-portal-architecture.md`, `phase-4.4-listing-stock-design.md`, Farmer/Buyer RC1 docs
