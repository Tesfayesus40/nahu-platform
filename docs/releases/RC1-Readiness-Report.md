# RC1 Readiness Report — Project Health Review

**Date:** 2026-07-28  
**Audience:** Product, engineering leads, deployment  
**Scope:** Platform + mobile after Revenue Engine architecture approval  
**Constraint:** Read-only assessment — **no application code modified** during this review  

**Companion docs**

| Doc | Purpose |
|-----|---------|
| [technical-debt.md](../technical-debt.md) | Debt register (impact / priority / effort) |
| [releases/RC1-Revenue-Engine.md](./RC1-Revenue-Engine.md) | Revenue Engine release / deploy notes |
| [08-guides/revenue-engine-tdd.md](../08-guides/revenue-engine-tdd.md) | Approved design |
| [08-guides/revenue-engine-roadmap.md](../08-guides/revenue-engine-roadmap.md) | Explicit deferrals |

---

## Executive verdict

| Question | Answer |
|----------|--------|
| **Is RC1 internally stable?** | **Conditionally yes** for delivery ops + marketplace fee accounting **if** migrations/flags are applied and dynamic delivery fees stay **OFF**. Not yet “release-stable” for public testing without the P0 items below. |
| **Architecture (Revenue Engine)** | **Approved and complete** as designed (accounting-first; stubs gated). |
| **Biggest residual risks** | Doc drift, mirrored unit tests, checkout preview vs server totals, staging migration/flag hygiene, dual Express legacy stack, courier flat-earning under fee-off. |

---

## 1. Architecture review (summary)

### 1.1 Safe to remove

| Finding | Location |
|---------|----------|
| Expo export scratch trees | `nahu-buna-courier/.tmp-rc1-export*` |
| Accidental package.json backups | buyer/courier `package.json.*` |
| Unused Telebirr screen shim | `nahu-buna-buyer/.../TelebirrPaymentScreen.js` |
| Deprecated unused token helper | `nahu-buna-buyer/src/utils/token.js` (no imports found) |
| Deprecated reset script | `apps/api/scripts/reset-test-data.mjs` |

### 1.2 Needs review

| Finding | Why |
|---------|-----|
| Gebaya root Express API + `COMMISSION_RATE = 0.02` | Still runnable; wrong commercial model if used |
| Buyer checkout `useState(2)` fee defaults + client math | Preview can diverge from Nest |
| `MOTORBIKE` / `distanceKm: 10` in checkout | Safe while flag off; dangerous if flag on |
| Mirrored `*.rules.test.mjs` (esp. pricing) | Drift vs production TS |
| Dual delivery timeline implementations | Courier local vs `shared/components/delivery` |
| Legacy dual-write columns (`quantity_kg`, `commission_etb`, …) | Compat vs clarity |
| Admin Pricing without server-side reauth enforcement | Weaker than other admin money actions |
| Prisma soft IDs for schedule/quote | Under-modeled relations |
| Flat earning when `courier_payout_etb = 0` | Ops must set intentional flat rate |
| Unrelated WIP mixed in working trees | Stabilisation needs branch discipline |

### 1.3 Keep

| Finding | Why |
|---------|-----|
| `pricing.*` schedules + Admin CRUD | Source of truth for rates |
| Order fee snapshots + dual-write aliases | Audit + legacy clients |
| `delivery.dynamic_fee.enabled = FALSE` | Approved production gate |
| `payment_intents` stubs | Intentional Phase-5 scaffold |
| Settlement snapshot → earning (with flat fallback) | Correct for gated mode |
| Feature flags for pricing v1 / dynamic fee | Rollout control |
| Shared marketplace helpers on Buyer | Prefer over app-local money math |

### 1.4 Unused / deferred (not dead)

- `POST /pricing/delivery-quotes` — **keep**, gated by flag  
- Delivery tariff / volume fields — **keep**, unused volume at checkout is OK  
- Payment intent status machine beyond `RECORDED_PENDING_PROVIDER` — **keep** for providers later  

No evidence of large unused Nest pricing controllers. No recommendation to drop fee snapshot columns.

---

## 2. Documentation audit

| Document | Status |
|----------|--------|
| `docs/08-guides/revenue-engine-tdd.md` | **Current** — approved design |
| `docs/08-guides/revenue-engine-design-lock.md` | **Current** — gates recorded |
| `docs/08-guides/revenue-engine-roadmap.md` | **Current** — deferrals |
| `docs/releases/RC1-Revenue-Engine.md` | **Current** — deploy/rollback |
| `docs/technical-debt.md` | **New** — this review |
| Root `README.md` | **Outdated** — repo map omits admin-web, pricing, releases; migration quick-start still “manual order” era |
| `docs/README.md` | **Outdated** — no Revenue Engine / `releases/` / technical-debt links; still “planned 05-api” |
| `apps/api/README.md` | **Outdated** — still “2% commission math” verification narrative |
| `apps/admin-web/README.md` | **Missing** Pricing / revenue ops |
| Delivery RC1 guides (`delivery-platform-rc1-*`, D12, courier RC1) | **Mostly current** for delivery; do not describe marketplace fees |
| Mobile `BUYER_RC1.md` / `FARMER_RC1.md` / `COURIER_RC1.md` | **Outdated** vs tracking/POD/earnings/fees |
| Mobile `AGENTS.md` (buyer/farmer) | **Outdated** Expo version |
| `MOBILE_NEST.md` | **OK** for Nest staging pointing |
| Dedicated OpenAPI / Admin ops guide for Pricing | **Missing** |

### Missing (recommended before public UAT)

1. Staging checklist checkbox: migrations through `ops/011` + flag values  
2. Short “Commercial money RC1” section in API README  
3. Updated mobile RC1 device test scripts including buyer charge vs goods subtotal  

---

## 3. Testing audit

### 3.1 Unit tests (API)

- **~34** `*.rules.test.mjs` files under `apps/api`  
- **Strength:** delivery domain rules (shipment, execution, POD, settlement, dispatch, …)  
- **Revenue:** `pricing.rules.test.mjs` exists but **mirrors** source (does not import `pricing.rules.ts`)  
- **Orders:** contract / admin / dispute / buyer-confirm rules — **not** full fee snapshot create path  
- **Admin-web / Nest e2e:** essentially absent for Pricing UI  

### 3.2 Unit / shared tests (mobile monorepo)

| Present | Gap |
|---------|-----|
| `listingPurchase`, `queueSections`, location provider, trackingProgress | No checkout/fee tests |
| Buyer wires some shared tests | Farmer lacks test scripts |
| trackingProgress test may mirror logic | Prefer import module |

### 3.3 Integration / e2e

**Missing / high value:**

1. Order create with `pricing.v1` on, dynamic fee off → assert snapshot + payment amount  
2. Dispute REFUND stream allocation → dispute columns + payment intent row  
3. Settlement accrual uses `courier_payout_etb` when non-zero; flat when zero  
4. Flag matrix: dynamic fee on without quote → 400  
5. Admin PATCH platform fees → subsequent order uses new rates (snapshot immutability for old orders)

### 3.4 High-risk areas

| Area | Risk |
|------|------|
| Buyer charge vs goods `total_etb` | UX/payment confusion |
| Accidental enable of dynamic delivery fees | Checkout breakage / mispricing |
| Courier earnings under fee-off | Silent zero payout |
| Stub intents treated as paid | Finance error |
| Express legacy create-order | Wrong fees if used |
| Mirrored money tests | False confidence |

### 3.5 Highest-priority tests before RC1 public testing

1. **API integration:** create order (NAHU_COURIER, no quote) → `buyerChargeEtb = goods + buyerFee`, delivery fees 0  
2. **API unit:** import real `pricing.rules` (or shared module) — marketplace + refund waterfall  
3. **Manual staging script:** Admin change buyer fee → new order reflects; old order unchanged  
4. **Device:** Buyer PaymentScreen amount matches API; OrderDetail shows fee lines  
5. **Flag guard:** confirm `delivery.dynamic_fee.enabled = false` in staging DB  

---

## 4. Blockers remaining

### Hard blockers for public testing

1. **Staging DB** missing or unverified pricing migrations / flag state (`ops/011`)  
2. **Checkout preview** can show wrong totals if `/pricing/active` fails (mitigate UX or document “trust Payment amount”)  
3. **Documentation** still teaching 2%-only commission (API README + mobile RC1 packs) — will mis-train testers  
4. **Branch/WIP hygiene** — unclear freeze boundary for “RC1 candidate” artifacts  

### Soft blockers (can smoke-test with caveats)

- Courier earnings may be 0 without flat config  
- No live payment — testers must understand simulated escrow  
- Dispute refunds are intent-only  
- Delivery quotes unused (by design)  

---

## 5. What should be completed before public testing

Treat as a **stabilisation sprint** (no new product features):

| # | Item | Owner hint |
|---|------|------------|
| 1 | Apply migrations through `ops/011`; verify flags | Deploy |
| 2 | Delete temp exports / backups; ignore patterns | Mobile |
| 3 | Fix or gate checkout fee preview (no silent 2% lie) | Buyer |
| 4 | Update API README + docs index + mobile RC1 checklists | Docs |
| 5 | Order-create fee integration test + fix pricing test import | API |
| 6 | Document Express as non-RC1 / Nest-only | Gebaya |
| 7 | Set explicit flat earning or communicate zero courier pay | Ops |
| 8 | Label payment intents as non-cash in Admin | Admin/docs |
| 9 | Freeze release branch; park unrelated location/CRM WIP | Lead |

---

## 6. What should wait until RC2

Per approved roadmap and this review:

| Theme | Why wait |
|-------|----------|
| Enable `delivery.dynamic_fee` | Needs real distance + vehicle selection |
| Finance / revenue ledger | Snapshots sufficient for RC1 accounting view |
| Automated refund policy engine | Manual disputes OK for limited UAT |
| Live Telebirr / Chapa / CBE rails | Explicitly stubbed |
| Drop legacy Express / dual-write columns | Compat cost; needs migration program |
| Surge, promos-at-checkout, VAT, multi-country | Designed as extensions |
| Full notification fan-out TODO | Delivery ops polish, not commercial gate |

---

## 7. Is RC1 internally stable?

**Yes, with gates:**

- Delivery platform RC1 (D1–D12) remains the operational backbone.  
- Revenue Engine is **architecturally complete** and **production-gated** correctly (dynamic fees off, rails stubbed).  
- Internal stability for **closed** testing is achievable after **P0 hygiene** (migrate, flags, docs, checkout preview, one integration test, junk cleanup).  

**Not yet** “public RC1 ready” until those P0 items and a clean staging smoke pass are done.

---

## 8. Recommended freeze policy

Until the next prioritised development phase:

1. **No new features** (already requested).  
2. **Allow:** docs, tests, junk removal, flag/migration verification, non-behavioural hygiene.  
3. **Do not:** enable `delivery.dynamic_fee.enabled`, wire live PSPs, or expand refund automation.  
4. Track work via [technical-debt.md](../technical-debt.md) and [revenue-engine-roadmap.md](../08-guides/revenue-engine-roadmap.md).

---

## Sign-off checklist (stabilisation)

| Check | Done? |
|-------|-------|
| Migrations through `ops/011` on target env | [ ] |
| `pricing.v1.enabled = true`, `delivery.dynamic_fee.enabled = false` | [ ] |
| Temp `.tmp-*` / `package.json.*` removed or ignored | [ ] |
| API README no longer claims 2%-only model | [ ] |
| Mobile RC1 device scripts mention buyer charge | [ ] |
| Order-create fee integration test green | [ ] |
| Closed UAT smoke (buyer pay / farmer payout display / courier earn policy) | [ ] |
| Explicit “no public testing” until checklist complete | [ ] |
