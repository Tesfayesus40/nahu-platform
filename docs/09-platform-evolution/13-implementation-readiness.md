# 13 — Implementation Readiness

**Status:** Design gate passed for G2 — no production code in the design phase  
**Companions:** [11](./11-architecture-review.md) · [12](./12-design-validation.md) · [14](./14-marketplace-engine-design.md)  
**Question:** Are we ready to begin implementing the marketplace generalization?

---

## 1. Verdict (updated after D1–D7 resolution)

| Scope | Ready? | When |
|-------|--------|------|
| **G2 — Admin Catalog** (+ vertical attachment) | **Implemented** — see [23](./23-g2-admin-catalog-implementation.md) | Apply migrations + deploy |
| **G3 — Attributes + coffee dual-write** | **Yes (design)** | After G2; follow [18](./18-d4-attribute-extension-strategy.md) |
| **G4 — Schema-driven mobile** | **Spec ready** | Implement after [19](./19-d5-form-schema-specification.md); not in G2 |
| **G5 — Deprecate coffee-only writers** | **Not yet** | After non-coffee category proven |
| **Non-agri verticals** | **Architecture ready; activation later** | After agri multi-category + SellerParty bridge |
| **Nahu Payments go-live** | **Not yet** | [20](./20-d6-tax-regulatory-model.md) + provider adapters |
| **Nahu Finance / AI productization** | **Not yet** | Event contracts after Payments settlement story |

**Headline:** G2 Catalog **implemented**; G2.5 **passed**; **GO for G3** after staging smoke + tag ([26](./26-g3-readiness.md)).


---

## 2. Prerequisites before merging G2 to staging

| # | Gate | Why |
|---|------|-----|
| P0 | RC1 Revenue Engine + Delivery smoke on staging | Don’t generalize on a broken checkout base |
| P0 | `delivery.dynamic_fee.enabled=false` understood | Avoid fee regressions |
| P0 | No new coffee-only NOT NULL columns | Protects dual-write plan |
| P1 | Follow [14](./14-marketplace-engine-design.md) invariants in G2 PRs | Prevent agri lock-in |
| P1 | Owner assigned for Catalog Admin G2 | Clear build responsibility |

D1–D7 design acceptance: **complete** (docs 15–21).

---

## 3. Design work status

| ID | Design work | Status | Needed by |
|----|-------------|--------|-----------|
| R1 | Marketplace Vertical | **Done** — [15](./15-d1-marketplace-vertical.md) | G2 |
| R2 | SellerParty vs Farmer | **Done** — [16](./16-d2-seller-party.md) | API freeze G3; table optional later |
| R3 | Neutral vocabulary / listing_kind | **Done** — [17](./17-d3-terminology-guide.md) | G3 migration names |
| R4 | Attribute + extension sunset | **Done** — [18](./18-d4-attribute-extension-strategy.md) | G3 |
| R5 | Form Schema Spec | **Done** — [19](./19-d5-form-schema-specification.md) | G4 |
| R6 | Tax / compliance sketch | **Done** — [20](./20-d6-tax-regulatory-model.md) | Payments go-live |
| R7 | Delivery policy packs | Deferred detail | Livestock / health |
| R8 | Certificate template field catalog | Partial in pack 03/04 | Second cert type |
| R9 | Event contracts Finance/AI | Deferred | Finance/AI modules |
| R10 | Module boundaries | **Done** — [21](./21-d7-platform-module-boundaries.md) | All waves |

---

## 4. Recommended implementation sequence

```text
DONE (design)
  └─ Pack 01–13 + D1–D7 (15–21) + Marketplace Engine (14)

NEXT (build)
  1. RC1 staging smoke green
  2. *** G2 — Admin Catalog Foundation ***  ← FIRST MILESTONE
       - marketplace_verticals + category FK/backfill
       - Admin category/product/variety + sell flags
       - API verticalCode
  3. G3 Attributes + dual-write + listing_kind GOODS|SUPPLIES|SERVICE
  4. Prove one non-coffee agri category E2E
  5. G4 form-schema renderer (nahu.form.v1)
  6. SellerParty physical bridge (when touching ownership)
  7. G5 deprecate coffee-only writers
  8. Payments + tax enablement → Finance / AI
  9. Non-agri vertical pilot
```

---

## 5. Go / No-Go checklist

### Go for G2 implementation when:

- [x] Evolution pack 01–10 reviewed  
- [x] Architecture review (11) complete  
- [x] Design validation (12) — D1–D7 **resolved**  
- [x] Marketplace Engine (14) + deltas 15–21 published  
- [ ] RC1 staging smoke (order + fees + shipment) passing  
- [ ] Product picks first non-coffee category candidate (activation may be later)  
- [ ] Engineering capacity allocated for Admin Catalog  

### No-Go for G3 until:

- [ ] G2 live for category/product ops + vertical attachment  
- [ ] Dual-write test plan written  
- [ ] Coffee RC1 regression suite identified  

### No-Go for G4 until:

- [ ] Attribute-driven category path underway  
- [ ] Implement against published [19](./19-d5-form-schema-specification.md)  

---

## 6. Final recommendation

**Begin G2 — Admin Catalog Foundation** as the first implementation milestone.

Treat [14 — Marketplace Engine Design](./14-marketplace-engine-design.md) as the constitution for PR review. Do not expand G2 into attributes, form renderers, tax, or Payments.
