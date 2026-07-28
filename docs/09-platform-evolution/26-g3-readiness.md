# 26 — G3 Readiness Assessment

**Status:** Go / No-Go gate for Dynamic Attributes  
**Date:** 2026-07-28  
**Inputs:** [24](./24-g2.5-workflow-validation.md) · [25](./25-g2.5-platform-review.md) · [14](./14-marketplace-engine-design.md) · [18](./18-d4-attribute-extension-strategy.md) · [13](./13-implementation-readiness.md)

---

## 1. Final recommendation

### Go / No-Go for G3

| Decision | Result |
|----------|--------|
| **Start G3 (Dynamic Attributes)?** | **GO** — with prerequisites below |
| Freeze Marketplace Engine Catalog (G2)? | **Yes** |
| Git tag recommended? | **Yes** — `marketplace-engine-g2.5` (or `g2.5-catalog-stable`) after migrations `011`–`014` applied on staging |
| First G3 implementation task | See §5 |

G2.5 **passes** as a stabilization gate: workflows validated, inactive multi-vertical taxonomy seeded, Revenue Engine payment amount verified, architecture review complete. Remaining gaps are **known** and either out of G3 scope or explicitly part of the G3 plan (coffee dual-write).

---

## 2. Remaining risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R1 | Coffee columns NOT NULL / required on create | Non-coffee listings cannot go live | G3 dual-write + nullable plan; do not activate honey/cement sell until done |
| R2 | Dual-write drift (columns vs attributes) | Incorrect search/display | Single writer module + reconciliation tests |
| R3 | Mirrored pure-rule tests | False confidence | Prefer importing TS rules where tooling allows |
| R4 | Admin fulfillment handoff | Ops bottleneck | Out of G3; track as Delivery UX backlog |
| R5 | Dynamic delivery fee off + client 10 km placeholder | Wrong delivery preview if flag flipped early | Keep flag false until routing ready |
| R6 | Live payments still stubs | No real money | Parallel Payments track — not G3 |
| R7 | Checkout preview ≠ server charge | UX confusion | Prefer server fees in UI (improvement) |

None of R4–R7 block **starting** attribute DDL/API work.

---

## 3. Recommended improvements before / during early G3

1. Apply and verify `catalog/014` on staging; Admin Catalog shows Construction/Retail inactive rows.  
2. RC1 money smoke: `payment.amount === buyerChargeEtb`.  
3. Tag freeze commit after green smoke.  
4. G3 kickoff spike: attribute_definitions DDL matching Phase 3 + Doc 18.  
5. Do **not** flip non-coffee `sell_enabled` in G3 until dual-write proven for coffee.

---

## 4. Freeze checklist (Marketplace Engine G2)

- [x] Verticals first-class  
- [x] Categories own vertical + listing_kind + sell_enabled  
- [x] Generic product types (coffee Green/Roasted/Ground + legacy default)  
- [x] Admin Catalog CRUD + permissions + write flag  
- [x] Additive APIs (`verticalCode`, `productTypeCode`, …)  
- [x] Inactive multi-vertical sample seed (G2.5)  
- [x] Workflow + platform review docs (24–25)  
- [ ] Staging migrations applied through `014`  
- [ ] Staging RC1 order/payment smoke  
- [ ] Git tag created  

---

## 5. First implementation task for G3

**G3.0 — Attribute foundation (DDL + read API)**

1. Migrations: `catalog.attribute_definitions` (+ enum values table if needed), `marketplace.listing_attribute_values`.  
2. Seed coffee attribute definitions mapped from existing columns (grade, process_method, …).  
3. Dual-write on coffee listing create/update (columns + attribute_values).  
4. Additive read: listing payload includes `attributes[]` without removing coffee fields.  
5. Admin read-only attribute definitions list (write editor can follow).  
6. Tests: coffee create still requires grade/process; attribute rows present; sellability unchanged.

**Explicitly out of G3.0:** schema-driven mobile forms (G4), SellerParty table, tax engine, activating Honey/Cement sell-through.

---

## 6. What “freeze” means

| Freeze | Do not change without ADR |
|--------|---------------------------|
| Vertical / category / product table shapes from G2 | Breaking renames |
| `buyerChargeEtb` as payment amount contract | Silent switch to `totalEtb` |
| Listing kind codes `GOODS\|SUPPLIES\|SERVICE` | Reintroducing PRODUCE as canonical |
| Doc 14 module boundaries | Coupling Delivery into Catalog |

Allowed: additive G3 columns/tables; bugfixes; ops flags; inactive seeds.

---

## 7. Go criteria summary

| Criterion | Met? |
|-----------|------|
| G2 Catalog accepted | Yes |
| G2.5 workflow validation documented | Yes |
| Architecture supports inactive multi-vertical taxonomy | Yes |
| RC1 payment field = Revenue Engine charge | Yes |
| G3 first task clear | Yes |
| No open design blocker for attribute tables | Yes (Doc 18) |

**GO for G3** after staging apply + smoke + tag.

---

## 8. If staging smoke fails

Treat as **No-Go for G3 start** until:

- Migrations `011`–`014` apply cleanly  
- Coffee create/pay path green  
- Catalog Admin loads verticals  

Then re-run §4 freeze checklist.
