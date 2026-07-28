# Revenue Engine — Follow-up Roadmap

**Parent design:** [revenue-engine-tdd.md](./revenue-engine-tdd.md)  
**Status:** Architecture approved; implementation paused pending prioritisation  
**Created:** 2026-07-27  

> GitHub CLI was not available in the authoring environment. Track these as GitHub issues when convenient (suggested titles/bodies below). Until then, this file is the roadmap of record.

---

## Production gates (do not lift casually)

| Gate | Flag / rule | Lift when |
|------|-------------|-----------|
| Dynamic delivery fees | `delivery.dynamic_fee.enabled` = **FALSE** | Issues #1 and #2 done |
| Pricing rates | Admin Portal / `pricing.*` only | Always |
| Payment rails | Stub intents only | Issue #5 done for a provider |

---

## Issue 1 — Real routing and distance calculation

**Suggested title:** `feat(pricing): real delivery distance from routing for quotes`

**Body:**

```markdown
## Context
Revenue engine TDD requires `delivery.dynamic_fee.enabled` to stay OFF until checkout uses real distance (not a hardcoded 10 km estimate).

## Goal
Compute `distanceKm` for delivery quotes from pickup → dropoff using platform maps/routing (saved pickup locations + buyer addresses / place IDs).

## Acceptance
- [ ] Quote API (or order create) receives distance derived from geo, not a client constant
- [ ] Fail closed or fall back to admin-defined default with audit when routing fails
- [ ] Documented units (km) and rounding
- [ ] Can enable dynamic delivery fees only after this + vehicle selection

## Refs
docs/08-guides/revenue-engine-tdd.md §4, §8
```

---

## Issue 2 — Vehicle selection in the Buyer App

**Suggested title:** `feat(buyer): vehicle type selection for delivery quotes`

**Body:**

```markdown
## Context
Tariffs are per vehicle type in `pricing.delivery_tariffs`, but checkout currently hardcodes MOTORBIKE when quotes are requested.

## Goal
Buyer selects (or system recommends) a vehicle type at checkout; pass `vehicleType` into `POST /pricing/delivery-quotes`.

## Acceptance
- [ ] UI lists active tariff vehicle types from API (or catalog)
- [ ] Quote and order bind use selected vehicle
- [ ] No hardcoded MOTORBIKE in production path
- [ ] Works with real distance (Issue 1)

## Refs
docs/08-guides/revenue-engine-tdd.md §4, §7
```

---

## Issue 3 — Finance / Revenue Ledger module

**Suggested title:** `feat(finance): revenue ledger for platform fee streams`

**Body:**

```markdown
## Context
Orders snapshot buyer fee, farmer fee, and delivery commission, but there is no first-class ledger for platform revenue or reconciliation reports.

## Goal
Append-only finance/revenue ledger (or report model) for:
- Buyer platform fee
- Farmer platform fee
- Delivery commission
Tied to order id / fee_schedule_id / timestamps.

## Acceptance
- [ ] Accrue on commercial milestones (pay / complete) without recomputing from live rates
- [ ] Admin reporting for three streams
- [ ] Compatible with refunds (reverse / adjust entries)
- [ ] Does not require live payment rails

## Refs
docs/08-guides/revenue-engine-tdd.md §5, §11
```

---

## Issue 4 — Automated refund policy engine

**Suggested title:** `feat(orders): automated refund policy matrix`

**Body:**

```markdown
## Context
Disputes support manual multi-stream refund allocation. Design lock defines cancel / fail / return policies that are not automated.

## Goal
Configurable policy engine mapping scenarios → stream refunds + courier earning reverse/adjust rules.

## Scenarios (minimum)
- Cancel after pay, before pickup
- Courier-fault failed delivery
- Buyer-unavailable failed delivery
- Return after delivery
- Partial goods-only / delivery-only

## Acceptance
- [ ] Policies stored admin-editably (not only code)
- [ ] Still snapshot-based (never recompute from live rates)
- [ ] Integrates with dispute REFUND + shipment earnings reverse
- [ ] Payment intent remains stub until Issue 5

## Refs
docs/08-guides/revenue-engine-tdd.md §6
docs/08-guides/revenue-engine-design-lock.md
```

---

## Issue 5 — Payment provider integrations

**Suggested title:** `feat(payments): live provider adapters for capture and disbursement`

**Body:**

```markdown
## Context
`pricing.payment_intents` records BUYER_CAPTURE / FARMER_DISBURSEMENT / COURIER_DISBURSEMENT / BUYER_REFUND with status RECORDED_PENDING_PROVIDER. No live money movement.

## Goal
Integrate providers (Telebirr, Chapa, CBE, others as needed) for:
- Buyer capture of `buyer_charge_etb`
- Farmer disbursement of `farmer_payout_etb`
- Courier disbursement from approved earnings
- Buyer refunds from dispute allocations

## Acceptance
- [ ] Provider adapters behind PaymentRailsService
- [ ] Intent status machine: SUBMITTED / SUCCEEDED / FAILED
- [ ] Idempotency and reconciliation hooks
- [ ] Feature-flagged rollout per provider
- [ ] Explicitly supersedes “stubs only” production gate

## Refs
docs/08-guides/revenue-engine-tdd.md §5, §9
```

---

## Suggested create commands (when `gh` is available)

```bash
cd nahu-platform

gh issue create --title "feat(pricing): real delivery distance from routing for quotes" --body-file - <<'EOF'
...paste Issue 1 body...
EOF

gh issue create --title "feat(buyer): vehicle type selection for delivery quotes" --body-file - <<'EOF'
...paste Issue 2 body...
EOF

gh issue create --title "feat(finance): revenue ledger for platform fee streams" --body-file - <<'EOF'
...paste Issue 3 body...
EOF

gh issue create --title "feat(orders): automated refund policy matrix" --body-file - <<'EOF'
...paste Issue 4 body...
EOF

gh issue create --title "feat(payments): live provider adapters for capture and disbursement" --body-file - <<'EOF'
...paste Issue 5 body...
EOF
```

---

## Priority sketch (non-binding)

1. Issues **1 + 2** (unblock dynamic delivery fees)  
2. Issue **5** when going live with real money  
3. Issue **4** before high-volume disputes  
4. Issue **3** when finance/ops needs reconciliation reports  
