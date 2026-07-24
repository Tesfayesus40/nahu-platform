# D2 — Delivery shipment domain schema

**Status:** Approved + refinements applied (`004` guards + aggregate service) — see D3  
**Date:** 2026-07-23  
**Depends on:** D0 SAD v1.2 · Roadmap v1.1 · D1 (identity/config)  
**Repos:** `nahu-platform` only  
**Constraint (original D2):** Schema + domain rules; APIs began in D3 via `ShipmentAggregateService` only.

---

## 1. What shipped

| Artifact | Path |
|----------|------|
| SQL migration | `database/migrations/delivery/003_delivery_shipment_domain.sql` |
| Aggregate guards | `database/migrations/delivery/004_delivery_aggregate_guards.sql` |
| Manifest | `database/migrations/manifest.json` |
| Prisma models | `apps/api/prisma/schema.prisma` |
| Domain rules | `apps/api/src/delivery/shipment.domain.rules.ts` |
| Unit tests | `apps/api/src/delivery/shipment.domain.rules.test.mjs` (`npm run test:shipment-domain-rules`) |
| Architecture notes | this document §4–§6 |

### Tables (schema `delivery`)

| Table | Aggregate role |
|-------|----------------|
| `shipments` | **Aggregate root** — `current_status` + geo summary |
| `shipment_stops` | 1..N stops (PICKUP/DROPOFF/return variants) |
| `shipment_assignments` | Assignment history (reassign supported) |
| `shipment_events` | Immutable lifecycle / domain events |
| `shipment_pods` | POD attempts (photo, OTP, GPS, signature-ready) |
| `shipment_earnings` | Append-only earnings ledger |
| `courier_profiles` | Supporting courier availability (RF-4) |
| `tracking_pings` | Optional geo breadcrumbs |

A10 `fulfillment_cases` / `fulfillment_events` **unchanged** — shipments hang off `fulfillment_id`.

---

## 2. Entity relationship summary

```text
orders.orders 1──1 delivery.fulfillment_cases          (A10 commercial handoff)
                      │
                      │ 1──* delivery.shipments          ★ aggregate root
                      │         │
                      │         ├── parent_shipment_id → shipments (split legs)
                      │         ├── batch_id (batched deliveries)
                      │         │
                      │         ├── * shipment_stops
                      │         │         └── * shipment_pods
                      │         ├── * shipment_assignments
                      │         ├── * shipment_events     (append-only)
                      │         ├── * shipment_earnings   (append-only ledger)
                      │         └── * tracking_pings
                      │
identity.users ◄────── courier_user_id / assigned_by / captured_by / earnings
identity.users 1──1 delivery.courier_profiles
```

**Cardinality (future-proof):**

- 1 fulfillment case → **N** shipments (`OUTBOUND` | `RETURN` | `SPLIT_LEG` | `BATCH_LEG`)
- 1 shipment → **N** stops (RC1 typically 1 pickup + 1 dropoff; multi-dropoff allowed)
- 1 shipment → **N** assignments (one `is_active` at a time)
- 1 stop → **N** POD attempts
- Earnings: N rows per shipment/courier; corrections via `replaces_earning_id`

**RC1 soft constraint:** partial unique index — one active outbound shipment per fulfillment (statuses through `BUYER_CONFIRMED`). Terminal statuses free the slot.

---

## 3. Shipment lifecycle

`shipments.current_status` is the latest projection. Every transition **appends** `shipment_events` (no history overwrite).

| Status | Meaning |
|--------|---------|
| `CREATED` | Aggregate created; stops may still be planned |
| `AWAITING_ASSIGNMENT` | Ready for DispatchService (D4+) |
| `ASSIGNED` | Offered / assigned to a courier |
| `ACCEPTED` | Courier accepted |
| `PICKED_UP` | Pickup stop completed |
| `IN_TRANSIT` | Moving toward dropoff(s) |
| `DELIVERED` | Dropoff POD accepted |
| `BUYER_CONFIRMED` | Buyer confirmed (when AD-1 requires it) |
| `COMPLETED` | Terminal success |
| `CANCELLED` | Terminal cancel |
| `RETURNED` | Return path completed / in return terminal |
| `FAILED` | Terminal or retryable failure (rules allow re-queue) |

Domain event types are namespaced `delivery.*` for notifications, analytics, audit, ETA, and AI consumers (consumers **not** implemented in D2).

---

## 4. Architecture decisions

| Decision | Rationale |
|----------|-----------|
| **Shipment is physical aggregate root**; fulfillment case remains order-linked envelope | Preserves A10 Admin contracts; Orders ≠ Shipments (AD-4) |
| **User status vocabulary** (CREATED…FAILED) instead of SAD DRAFT/OFFERED/IN_PROGRESS | Matches approved D2 objectives; `mapLegacySadStatusToD2()` bridges docs |
| **Stops always collection** (`shipment_stops`) | RF-2; multi-stop / returns via `stop_type` |
| **`parent_shipment_id` + `batch_id` + `shipment_type`** | Split / batch / return without redesign |
| **Assignments are history rows** | RF-1 DispatchService will write here; never assume single row forever |
| **Events + earnings have no `updated_at` / soft-delete** | Immutability (RF-3, RF-7) |
| **POD: OTP + photo + GPS + recipient + signature columns** | RF-6; signature nullable for future |
| **Shipment-level pickup/dropoff lat/lng + distance/duration/zone** | RF-5 routing readiness; stop-level geo also present |
| **Partial unique active outbound** | RC1 product constraint without 1:1 schema forever |
| **No APIs in D2** | Roadmap gate; D4/D5 own behavior |

---

## 5. Staging apply

```sh
# DATABASE_URL = public Railway URL only
node scripts/apply-migrations.mjs
cd apps/api && npx prisma generate
```

Do **not** start D3 until this milestone is architecturally reviewed. *(D2 approved 2026-07-23; D3 implemented.)*

---

## 6. Verification

```sh
cd apps/api
npm run test:shipment-domain-rules
npx prisma validate
```

### Explicitly out of D2

DispatchService automation, inventory DISPATCH, Admin UI, event consumers, routing engine. (Courier APIs began in D3 via aggregate service only.)

---

## 7. Next

D2 approved → **D3** courier foundation (done). Pause before **D4**.
