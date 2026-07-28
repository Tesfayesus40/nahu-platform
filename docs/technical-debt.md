# Technical Debt Register

**Created:** 2026-07-28  
**Context:** Post–Revenue Engine architecture approval; pre–next development phase  
**Scope:** `nahu-platform` + `nahu-buna-gebaya`  
**Constraint:** Assessment only — no application code was changed for this register  

**Related:** [RC1 Revenue Engine release notes](./releases/RC1-Revenue-Engine.md) · [RC1 Readiness Report](./releases/RC1-Readiness-Report.md) · [Revenue Engine TDD](./08-guides/revenue-engine-tdd.md) · [Production Readiness backlog](./09-platform-evolution/37-production-readiness.md)

> **Pilot mapping:** P0 ≈ Critical (PR-C*), P1 ≈ High (PR-H*), P2 ≈ Medium, P3 ≈ Nice / deferred. Track closure in [37-production-readiness.md](./09-platform-evolution/37-production-readiness.md).

---

## How to use

| Priority | Meaning |
|----------|---------|
| **P0** | Complete or mitigate before public / external RC1 testing |
| **P1** | Complete before calling RC1 “internally stable” for broader UAT |
| **P2** | Stabilize soon after RC1; do not block smoke UAT if gated |
| **P3** | RC2+ / backlog |

| Effort | Rough guide |
|--------|-------------|
| **S** | &lt; 0.5 day |
| **M** | 0.5–2 days |
| **L** | &gt; 2 days |

---

## Register

| ID | Issue | Impact | Priority | Recommendation | Effort |
|----|-------|--------|----------|----------------|--------|
| TD-01 | Mirrored (non-imported) pure-rule unit tests — e.g. `pricing.rules.test.mjs` reimplements `pricing.rules.ts` instead of importing it; same pattern across many `*.rules.test.mjs` files | Fee/settlement/dispute tests can pass while production rules drift | **P0** | Prefer importing compiled TS or a shared `.mjs` export of rules; at minimum add CI check that money-path rules tests import source | **M** |
| TD-02 | No integration tests for order create → fee snapshot → payment amount → confirm-payment intent | Highest commercial regression risk for Revenue Engine | **P0** | Add API integration smoke: create order with `pricing.v1` on / dynamic fee off; assert `buyer_charge_etb` and payment amount | **M** |
| TD-03 | Buyer checkout fee preview defaults to 2%/2% and client-side math until `/pricing/active` succeeds | UI “You pay” can diverge from PaymentScreen (server amount) if API fails or is slow | **P0** · **Mitigated** | Checkout waits for `/pricing/active`; never invents % (PR-C7) | **S** |
| TD-04 | Staging migrations may not include `pricing/*` + `ops/011` yet | Deploy API without migrate → hard failures; or old TRUE dynamic-fee seed | **P0** | Apply manifest through `ops/011`; verify flags; document in staging checklist | **S** |
| TD-05 | `apps/api/README.md` still documents “correct 2% commission math” and outdated sandbox notes | Engineers follow wrong commercial model | **P1** | Update order examples to buyer+farmer fee + `buyer_charge_etb`; link TDD/release notes | **S** |
| TD-06 | Root `docs/README.md` omits Revenue Engine TDD, roadmap, `docs/releases/` | Discoverability; conflicting mental models | **P1** | Index new docs in documentation map | **S** |
| TD-07 | Admin Web README has no Pricing section | Ops cannot find rate-edit surface from docs | **P1** | Document `/pricing`, permissions, flags | **S** |
| TD-08 | Buyer/Farmer/Courier RC1 markdown (`BUYER_RC1.md`, `FARMER_RC1.md`, `COURIER_RC1.md`) outdated vs shipped delivery + fees | Device UAT follows wrong checklist | **P1** · **Mitigated** | Checklists refreshed for Nest + G8–G10 pilot (PR-H4) | **M** |
| TD-09 | Buyer/Farmer `AGENTS.md` cite Expo **v55**; packages are **~54** | Agent/dev doc drift | **P1** · **Done** | AGENTS aligned to Expo v54 | **S** |
| TD-10 | Legacy Express stack in gebaya root (`src/modules/orders` with `COMMISSION_RATE = 0.02`) still runnable | Dual commercial semantics if someone runs Express against shared DB | **P1** · **Mitigated** | [nest-only-ops.md](./08-guides/nest-only-ops.md) + gebaya `LEGACY_EXPRESS.md` | **M** |
| TD-11 | Temporary export junk: `nahu-buna-courier/.tmp-rc1-export*`, `package.json.*` backups | Repo noise; accidental commit risk | **P1** | Delete artifacts; add `.gitignore` patterns | **S** |
| TD-12 | Deprecated unused `nahu-buna-buyer/src/utils/token.js`; `TelebirrPaymentScreen.js` re-export unused | Dead code | **P2** | Remove after import grep confirms | **S** |
| TD-13 | `pricing.rules.test` / flag-off path hardcodes farmer 2% / buyer 0% when `pricing.v1` off | Legacy rollback path not Admin-editable | **P2** | Move fallback rates to ops settings or require schedule always | **S** |
| TD-14 | Quote TTL (15m) is a service constant | Cannot tune without redeploy | **P2** | Admin/system setting when dynamic fees enabled | **S** |
| TD-15 | Checkout hardcodes `MOTORBIKE` + `distanceKm: 10` when dynamic fee on | Mispricing if flag flipped early | **P2** (P0 if flag enabled) | Keep flag OFF; roadmap routing + vehicle UI before enable | **L** |
| TD-16 | Flat earning fallback (`delivery.earning.flat_etb`, often 0) when `courier_payout_etb` is 0 | With dynamic fees OFF, courier may earn 0 unless ops set flat | **P1** · **Mitigated** | Ops policy in [nest-only-ops.md](./08-guides/nest-only-ops.md) (PR-H7) | **S** |
| TD-17 | Payment intents are stubs; easy to mistake for cash movement | Finance/ops false confidence | **P1** · **Mitigated** | `isStub` / `settlementNote` on intents + ops payment views (PR-H6) | **S** |
| TD-18 | Admin Pricing writes accept optional `reauthPassword` but API does not enforce reauth | Weaker control than other admin money actions | **P2** · **Done** | `requireReauth` on pricing mutations (PR-H2) | **S** |
| TD-19 | Prisma `Order.feeScheduleId` / `deliveryQuoteId` lack typed relations to pricing models | Weaker integrity in ORM; SQL FKs may vary | **P2** | Add Prisma relations + align FKs | **M** |
| TD-20 | Duplicate delivery UI: courier local `delivery.js` timeline vs `shared/components/delivery/*` | Drift in status presentation | **P2** | Consolidate on shared components | **M** |
| TD-21 | Farmer earnings/order money formatting not using shared order display helpers | Inconsistent ETB/fee presentation | **P2** | Reuse `shared/marketplace/orderDisplay` | **S** |
| TD-22 | `TODO(D6+/A13)` delivery event fan-out to notifications/push | Missing ops/mobile alerts on lifecycle | **P2** | Track under delivery notifications; not Revenue Engine blocker | **L** |
| TD-23 | No automated refund policy engine | Manual dispute allocation only | **P3** | Roadmap issue #4 | **L** |
| TD-24 | No finance/revenue ledger | Cannot reconcile three platform streams easily | **P3** | Roadmap issue #3 | **L** |
| TD-25 | Live payment providers not integrated | Escrow remains simulated | **P3** | Roadmap issue #5 | **L** |
| TD-26 | Dual-write legacy columns (`quantity_kg`/`price_per_kg`, `commission_etb`, `total_etb`) | Confusion; long-term cleanup | **P3** | Keep for RC1 compat; deprecate in RC2 with API versioning | **L** |
| TD-27 | Deprecated `apps/api/scripts/reset-test-data.mjs` | Confusion vs `db:reset` | **P2** | Remove or replace with stub that only prints migration path | **S** |
| TD-28 | Shared location provider tests not wired into app npm scripts | Easy to skip in CI | **P2** | Wire into package test scripts / CI | **S** |
| TD-29 | No OpenAPI / `docs/05-api` for Pricing endpoints | Contract discoverability | **P2** | Document in API README or generate OpenAPI slice | **M** |
| TD-30 | Uncommitted / mixed WIP across location + revenue + courier CRM (git status at review time) | Hard to know what is “RC1 freeze” vs WIP | **P0** | Branch hygiene: freeze Revenue Engine + delivery RC1 paths; park unrelated WIP | **M** |

---

## Categorisation cheat-sheet (architecture review)

### Safe to remove (after confirm)

- Courier `.tmp-rc1-export/` and `.tmp-rc1-export-navfix/`
- Accidental `package.json.*` backup files in buyer/courier
- Buyer `TelebirrPaymentScreen.js` (unused navigator)
- Buyer `src/utils/token.js` if zero imports remain
- Deprecated `reset-test-data.mjs` body (or whole script)

### Needs review

- Legacy Express `src/modules/**` in gebaya (especially `COMMISSION_RATE`)
- Checkout client fee preview / quote placeholders
- Mirrored rules tests
- App RC1 markdown vs reality
- Flat earning vs zero courier payout under dynamic-fee OFF
- Prisma soft refs for fee schedule / quote
- Icon orientation QA assets under `shared/brand/icons/orientation/`

### Keep (intentional)

- `pricing.payment_intents` stub ledger
- `delivery.dynamic_fee.enabled = FALSE` gate
- Dual-write `commission_etb` / `total_etb` for legacy clients
- Feature-flag off path with explicit legacy farmer 2% (until replaced by settings)
- Delivery flat earning config as settlement fallback
- Seed tariff matrix and Admin Pricing CRUD
- Shared marketplace listing/order helpers used by Buyer

---

## Suggested cleanup sequence (no new features)

1. **Hygiene (S):** delete temp exports/backups; gitignore; verify flags on staging  
2. **Docs (S–M):** API README, docs index, Admin Pricing, mobile RC1 checklists  
3. **Money safety (M):** checkout rate loading UX; order-create integration test; import pricing rules in unit tests  
4. **Ops clarity (S):** flat earning policy + payment-intent labeling  
5. **Legacy quarantine (M):** Express stack documentation / access control  
6. **RC2 backlog:** ledger, refund engine, providers, routing, vehicle UI  

---

## Change log

| Date | Note |
|------|------|
| 2026-07-28 | Initial register from project health review |
