# D1–D12 — Nahu Delivery Platform Implementation Roadmap

**Status:** RC1 architecturally approved — **feature freeze ACTIVE**; production gated on live staging sign-off  
**Date:** 2026-07-24  
**Version:** 2.3
**Depends on:** D0 SAD v1.2 (Approved architecture + RF-1…RF-8)  
**Repos:** `nahu-platform` (API, Admin, migrations) · `nahu-buna-gebaya` (Courier app + Farmer/Buyer delivery UX)  
**Constraint:** Production frozen unless explicitly requested. Staging-first. Mobile never calls `/admin/*`.  
**Analogy:** Same batch discipline as Admin A2–A14 — one milestone, one shippable slice, then pause when requested.

---

## 0. How to use this roadmap

1. Implement **only** the current milestone (Dn).  
2. Each Dn ends with: migration (if any) · Nest/Admin/mobile slice · smoke · short completion note.  
3. Do **not** start Dn+1 until Dn is accepted (or explicitly parallelized below).  
4. **Current gate:** RC1 approved + freeze — **complete live staging checklist** before production. No Phase 2.

### Approved refinements mapped to milestones

| Refinement | Primary milestones |
|------------|-------------------|
| RF-1 DispatchService | D4 (service), D5/D6 (call sites) |
| RF-2 Shipment = Stop[] | D2 schema, D4 rules, D5/D7 UX |
| RF-3 Lifecycle events | D2 table, D4 publisher on every transition |
| RF-4 Courier availability | D2 column, D3 UX shell, D5 API |
| RF-5 Geospatial fields | D2 schema |
| RF-6 Extended POD | D2 schema, D5/D7 capture |
| RF-7 Immutable earnings ledger | D2 schema (writes from D4/D10; expose D6/D7/D10) |
| RF-8 Delivery analytics | D1 flag + thresholds; D4+ collect from events |

### Parallelism (allowed after D1–D2 land)

| Track | Milestones | Repo |
|-------|------------|------|
| Platform core | D1 → D2 → D4 → D5 → D6 | `nahu-platform` |
| Courier mobile | D3 (scaffold) → D7 | `nahu-buna-gebaya` |
| Seller/Buyer UX | D8 | `nahu-buna-gebaya` |
| Admin polish | D9 | `nahu-platform` |
| Hardening | D10 → D11 → D12 | both |

D3 may start once D1 identity role exists; D7 requires D4–D5 courier APIs.

---

## 1. Milestone map

| ID | Title | Primary outcome | Depends on |
|----|-------|-----------------|------------|
| **D1** | Identity, RBAC, config | `COURIER` role, permissions, flags/settings, OTP, analytics flag | D0 |
| **D2** | Schema & Prisma | Shipments→Stops[], geo, POD ext, availability, immutable earnings, lifecycle_events | D1 |
| **D3** | Courier app scaffold + OTP | `nahu-buna-courier/`, OTP, availability UI shell | D1 |
| **D4** | State machine + Dispatch + sync + events | Rules, DispatchService, order/inventory sync, event publisher + analytics | D2 |
| **D5** | Courier & seller/buyer APIs | Nest routes incl. availability; Dispatch call sites | D4 |
| **D6** | Admin enrichment | A10 + assign/reassign via Dispatch, POD, couriers, earnings read | D4 |
| **D7** | Courier app RC1 flows | Accept → stops → POD (ext) → earnings read | D3, D5 |
| **D8** | Farmer & Buyer delivery UX | Ready/handoff, tracking, confirm policy | D5 |
| **D9** | Admin Portal UI polish | Shipment/stops/POD/earnings screens | D6 |
| **D10** | Proof of Delivery framework | POD service gates ARRIVED→DELIVERED; events; Admin/Courier/party surfaces | D5, D9 |
| **D11** | Courier Earnings & Settlement | SettlementService + immutable ledger; Admin review; Courier read-only | D2, D5, D10 |
| **D12** | Staging E2E + RC1 freeze | Validation matrix + freeze/handoff (former D11+D12) | D7–D11 |

---

## 2. Detailed milestones

### D1 — Identity, RBAC, and delivery config

**Goal:** Platform can recognize couriers and honor AD-1 / RF-8 config before logistics tables.

**Scope**

- Migration: role `COURIER` in `identity.roles`.  
- Permissions: `delivery.earnings.read`, `delivery.earnings.manage`, `delivery.couriers.manage` (+ grants).  
- `ops.feature_flags`: `delivery.buyer_confirm_required` (default on), `delivery.buyer_confirm_from_escrow` (off), `delivery.pickup_pod_required` (off), `delivery.courier_app.enabled` (on for staging), `delivery.analytics.enabled` (on).  
- `ops.system_settings`: `delivery.earning.flat_etb` (string/numeric value).  
- Alert thresholds seeds for `delivery.in_transit`, `delivery.pod_pending` (analytics readiness).  
- OTP: `RegistrationRole.COURIER`; gate COURIER OTP when `delivery.courier_app.enabled` is false.  
- `DeliveryConfigService` to read flags/settings.  
- Completion note: `docs/07-decisions/d1-delivery-identity-rbac-config.md`.

**Out of scope:** Shipments schema, Admin UI, mobile UI, DispatchService.

**Done when:** Migrations apply; OTP as COURIER works when flag on; config readable via service; permissions in Admin catalog.

---

### D2 — Delivery schema (Orders ≠ Shipments)

**Goal:** SQL-first physical model: shipments as stop collections; geo; immutable earnings; lifecycle events table.

**Scope**

- `delivery/003+`: `shipments`, `stops` (1..N, geo RF-5), `proofs_of_delivery` (RF-6), `courier_profiles` (availability RF-4), `courier_assignments`, `courier_earnings` (immutable RF-7 + `replaces_earning_id`), `lifecycle_events` (RF-3), optional `tracking_pings`.  
- Enforce shipment cannot be offered without stops (DB check or app + test).  
- Partial unique one active outbound.  
- Prisma models.  
- Optional backfill: case → shipment **with** stops.

**Out of scope:** State machine HTTP, Dispatch behavior beyond schema.

**Done when:** Staging migrate + Prisma generate clean; A10 intact.

---

### D3 — Courier Expo app scaffold + OTP (AD-2, AD-3, RF-4 shell)

**Goal:** Separate Expo app; OTP login; availability control shell.

**Scope**

- `nahu-buna-courier/` scaffold.  
- OTP COURIER; EAS staging.  
- Screens/shells including **Availability** toggle (OFFLINE/AVAILABLE) — API wired in D5.  
- `shared/delivery/` labels EN/AM.  
- `COURIER_RC1.md` outline.

**Out of scope:** Real job APIs; POD upload.

**Done when:** Staging OTP login on device/emulator; no `/admin/*`.

---

### D4 — State machine + DispatchService + sync + events

**Goal:** Normative §5 rules; RF-1 DispatchService; RF-3 publisher; RF-8 analytics collection starts.

**Scope**

- `delivery-state.machine.ts`, shipment/pod/fulfillment rules + unit tests.  
- `dispatch.service.ts`: offer, assign, reassign, unassign (availability guards).  
- `delivery-sync.service.ts`: order + inventory DISPATCH.  
- `delivery-events.publisher.ts` + write `lifecycle_events`; analytics when flag on.  
- Wire A10 actions through same machine/dispatch.  
- Earnings **accrual write path** (immutable) may stub until D10 if policy incomplete — prefer real ACCRUED on POD if flat fee setting present.

**Out of scope:** Full courier HTTP surface (D5); Admin React (D9).

**Done when:** Rule tests green; event rows created on transition smoke; confirm-delivery honors flags.

---

### D5 — Delivery Execution Engine

**Goal:** Post-accept shipment execution via `DeliveryExecutionService`; courier execution APIs.

**Scope**

- `DeliveryExecutionService`: startPickup, confirmPickup, startTransit, arriveAtDestination, markDelivered, completeDelivery (+ fail/return).  
- Strict lifecycle including `ARRIVED`; all status writes via `ShipmentAggregateService`.  
- Courier-only execution endpoints; assigned-courier authz.  
- `DeliveryEventsPublisher` emit-only (no notification delivery).  
- `DispatchService` remains assignment-only.

**Out of scope:** POD, Maps/ETA/AI, earnings UI, buyer confirm UI, Admin polish (D6).

**Done when:** Unit/integration rules green; happy-path ACCEPTED→COMPLETED; invalid/unauthorized/terminal covered.

**Note:** Original roadmap also listed seller/buyer HTTP surfaces; those remain for D6/D8 as applicable. Availability API shipped in D3.

---

### D6 — Delivery Operations Administration

**Goal:** Admin Portal as operational control center; orchestrate existing services.

**Scope**

- Shipment ops dashboard (buckets, pagination, filter, search, sort).  
- Shipment detail (summary, fulfillment, courier, stops, assignment history, ShipmentEvent timeline).  
- Courier ops (availability, workload, assigned/completed).  
- Manual ops via DispatchService + AdminOpsService cancel/retry.  
- Ops metrics from status + ShipmentEvent.  
- Audit on all admin mutations; RBAC + reauth.

**Out of scope:** AI/Maps/ETA/POD/earnings UI/buyer confirm UI. Courier product flows → D7.

**Done when:** Admin portal + APIs green; rules/permission/audit/metrics tests pass.

---

### D7 — Courier Delivery Experience

**Goal:** Courier app work queue + execution UX consuming D4/D5 APIs.

**Scope**

- Work queue sections (available/accepted/active/completed today/failed/returned) with refresh, pagination, filter.  
- Detail: pickup/delivery, stops navigator, ShipmentEvent timeline.  
- Workflow UI for accept/reject and full execution path (no local validation ownership).  
- Availability ONLINE/OFFLINE/BUSY/BREAK synced to backend.  
- Friendly errors for invalid transition / expired assignment / cancelled / network.

**Out of scope:** POD, offline queue, Maps/ETA/AI, earnings UI, buyer confirm UI → later.

**Done when:** Shared + Nest queue tests green; device smoke of ACCEPTED→COMPLETED path.

---

### D8 — Farmer & Buyer delivery UX

**Goal:** Honest logistics UX (read-only tracking).

**Scope (delivered)**

- Farmer shipment list/detail/timeline + courier summary; OrderDetail tracking panel.  
- Buyer order tracking, delivery history/detail, shared timeline from `ShipmentEvent`.  
- Shared UI: status badge, progress (status-only), timeline, courier card.  
- Party read APIs: `/delivery/seller/*`, `/delivery/buyer/*` via `PartyDeliveryService`.  

**Out of scope (deferred):** POD, new buyer confirmation workflow, offline, Maps/ETA/AI, earnings, push.

**Done when:** Tracking UIs consume party APIs; no local business rules; tests green.  
**Doc:** `d8-farmer-buyer-delivery-experience.md`

---

### D9 — Admin Portal UI polish / operational readiness

**Goal:** Operators use enriched Delivery screens; platform cohesive through D9.

**Scope (delivered)**

- Richer shipment timeline + progress; courier workload capacity; status summaries; ops alerts.  
- Delayed deliveries via configurable SLA hours; assignment backlog; utilization metrics.  
- Improved filters (`status`, courier, fulfillment, `staleHours`); bulk cancel/retry.  
- Event fan-out: Dispatch → DeliveryEventsPublisher; event audit documented.  
- API pagination consistency; Admin web delivery components.  

**Out of scope:** POD capture, buyer confirm workflow, earnings UI, Maps/ETA/AI, push.

**Done when:** Ops dashboard + shipment detail usable for case closure without parallel tools.  
**Doc:** `d9-delivery-operational-readiness.md`

---

### D10 — Proof of Delivery framework

**Goal:** ARRIVED → DELIVERED only with validated POD evidence.

**Scope (delivered)**

- `ProofOfDeliveryService` (create/validate/verify/complete) inside Shipment aggregate.  
- Configurable OTP / photo / GPS / recipient via `DeliveryConfigService`.  
- ShipmentEvents: `delivery.pod.started|verified|failed|captured`.  
- Courier PodCapture UI; Admin read-only POD; party POD status (buyer handoff PIN).  
- Signature columns schema-ready only.  

**Deferred:** signature capture UI, Maps/ETA/AI, push. Earnings/settlement → **D11**.

**Doc:** `d10-proof-of-delivery-framework.md`

---

### D11 — Courier Earnings & Settlement Engine

**Goal:** Accrue courier earnings on the immutable `ShipmentEarnings` ledger after POD → DELIVERED → COMPLETED. Admin review / adjustments / reversals. Courier read-only earnings. No payout rails.

**Scope (delivered)**

- `SettlementService` owns calculation, accrual, approve/paid markers, adjust, reverse.  
- Append-only ledger types: `DELIVERY_EARNING`, `BONUS`, `ADJUSTMENT`, `REVERSAL`, `PENALTY` (future-ready).  
- Statuses: `PENDING` → `ELIGIBLE` → `APPROVED` → `PAID`; `REVERSED`.  
- Accrual wired from `DeliveryExecutionService.completeDelivery` (same TX; fan-out after commit).  
- Courier `GET /delivery/courier/earnings`; Admin `/admin/delivery/earnings/*`.  
- Admin Portal Earnings tab; Courier Earnings tab (read-only).  
- Farmer/Buyer: no new financial UI.  
- Events: `delivery.earning.accrued|adjusted|voided` on existing ShipmentEvent bus.  

**Out of scope:** actual payouts, bank/Stripe/mobile money, tax, invoices, surge/AI pricing, accounting exports.

**Deferred staging E2E** (former D11) → **D12** (or follow-on).

**Docs:** `d11-courier-earnings-settlement.md`, `d11-settlement-completion-report.md`

---

### D12 — Staging E2E / RC1 freeze & handoff

**Goal:** Prove slice + ship-ready docs (absorbs former D11 staging validation + former D12 freeze).

**Scope (delivered)**

- Hardening: accrual uniqueness, settlement/approve idempotency, startPickup idempotency, earnings list query fix, timeline cap, hot indexes (`delivery/007`).  
- Label consistency (ARRIVED/DELIVERED AM; buyer confirmation bucket).  
- Full delivery rules regression (89/89).  
- RC1 architecture report, production readiness, deployment + staging checklists, validation/completion reports.  

**Out of scope:** New features (AI, Maps, ETA, push, offline, payouts, tax).

**Docs:** `d12-delivery-platform-rc1-architecture.md`, `d12-delivery-production-readiness.md`, `d12-rc1-completion-report.md`

**Done when:** Stakeholders accept RC1 architectural approval; staging checklist signed before production.

---

## 3. Cross-cutting standards (every Dn)

| Standard | Rule |
|----------|------|
| SQL-first | Migrations + manifest |
| Authz | Mobile role routes; Admin permissions + reauth |
| Assignment | **Only** via DispatchService (from D4+) |
| Events | Normative transitions publish lifecycle events (from D4+) |
| Earnings | Append-only; never UPDATE amount |
| Audit | Privileged Admin writes |
| Compatibility | A10 additive |
| i18n | EN + AM for user-facing statuses |
| Testing | State machine tests from D4; smoke per Dn |
| No scope creep | Split/returns/invites = backlog unless ADR |

---

## 4. Suggested sequencing

```text
D1 ──► D2 ──► D4 ──► D5 ──► D6 ──► D9 ──► D10 (POD)
 │            │       │       │
 │            │       ├──────► D7 (needs D3)
 │            │       └──────► D8
 │            │
 └──► D3 (after D1; parallel with D2/D4)

D7 + D8 + D9 + D10 ──► D11 (settlement) ──► D12 (E2E + freeze)
```

**Gate:** After D12 completes → **pause for final architectural approval** (RC1 freeze).

---

## 5. Exit criteria for roadmap (met)

1. Boundaries match D0 SAD v1.2 including RF-1…RF-8.  
2. AD-1…AD-3 reflected in D1/D3/D4/D8.  
3. Orders vs Shipments + Dispatch + events land in **D2 + D4** before mobile polish.  
4. Implementation proceeds D1-first with explicit pause.

---

## 6. Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-23 | Initial D1–D12 from D0 v1.1 |
| 1.1 | 2026-07-23 | Approved; RF-1…RF-8 mapped; D1 pause gate |
| 1.2 | 2026-07-23 | D1 complete; D2 schema shipped — pause before D3 |
| 1.3 | 2026-07-23 | D2 refinements + D3 courier foundation — pause before D4 |
| 1.4 | 2026-07-23 | D4 dispatch engine — pause before D5 |
| 1.5 | 2026-07-23 | D5 delivery execution engine — pause before D6 |
| 1.6 | 2026-07-23 | D6 delivery operations administration — pause before D7 |
| 1.7 | 2026-07-23 | D7 courier delivery experience — pause before D8 |
| 1.8 | 2026-07-23 | D8 farmer/buyer delivery experience — pause before D9 |
| 1.9 | 2026-07-23 | D9 operational readiness — pause before D10 |
| 2.0 | 2026-07-23 | D10 POD framework (earnings deferred) — pause before D11 |
| 2.1 | 2026-07-23 | D11 settlement engine (staging E2E → D12) — pause before D12 |
| 2.2 | 2026-07-23 | D12 RC1 freeze & hardening — pause for final architectural approval |
| 2.3 | 2026-07-24 | RC1 architecturally approved; feature freeze + official release summary |

**Related:** `d0-nahu-delivery-platform-architecture.md` · `d10-proof-of-delivery-framework.md` · `d11-courier-earnings-settlement.md` · `d12-delivery-platform-rc1-architecture.md` · **Official RC1 release:** `../08-guides/delivery-platform-rc1-release-summary.md` · **Freeze:** `../08-guides/delivery-rc1-feature-freeze.md`
