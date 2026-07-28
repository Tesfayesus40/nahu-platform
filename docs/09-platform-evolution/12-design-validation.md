# 12 — Design Validation

**Status:** Design validation only — no production code  
**Companion:** [11 — Architecture Review](./11-architecture-review.md)  
**Purpose:** Confirm what the evolution pack already gets right, lock required design deltas, and define pass/fail criteria for “marketplace-capable platform.”

---

## 1. Validation summary

| Question | Result |
|----------|--------|
| Can the same core run coffee RC1? | **Yes** — preserve dual-write + coffee template |
| Can it run multi-agriculture (Nahu Farms)? | **Yes** — after G2–G4 + category activation |
| Can it later run non-agri marketplaces? | **Yes, with design deltas** (vertical, seller, naming) — not “out of the box” as written |
| Delivery / Payments / Finance / AI modular? | **Yes** — keep event/adapter boundaries |
| Is the pack implementable without redesign? | **Yes** — D1–D7 design-locked in docs 15–21 |

**Overall validation:** **Pass.** Deltas resolved; G2 may proceed after RC1 operational gates ([14](./14-marketplace-engine-design.md) §10).

---

## 2. What the pack already validates well

### 2.1 Correct decisions (keep)

1. **Catalog spine** (Category → Product → Variety) as the multi-commodity foundation — do not invent a parallel Commodity table.  
2. **Attribute definitions + values** for category-specific fields — correct generalization path.  
3. **G1 first, then G2 Admin, then G3 attributes** — sequencing matches risk.  
4. **Coffee dual-write / dual-read** — protects RC1 while generalizing.  
5. **Certificate templates** — right abstraction for quality documents beyond coffee.  
6. **Listing kind** (goods / supplies / services) — enables services and inputs without a second marketplace.  
7. **Revenue Engine as accounting-first** — vertical-agnostic fee schedules.  
8. **Delivery as fulfillment module** — not baked into coffee listing shape.  
9. **Config activation of categories** — safer than hard-coding new verticals into apps.  
10. **Farms / harvest as agri capability** — conceptually separable (must stay optional on listings).

### 2.2 Alignment with existing platform docs

| Existing artifact | Pack alignment |
|-------------------|----------------|
| Commodity generalization architecture review | Aligned — G1→G5 path |
| Phase 3 catalog | Aligned — Admin G2 extends it |
| Revenue Engine design lock | Aligned — fees stay schedule-driven |
| Delivery RC1 | Aligned — shipment independent of process/grade |
| Technical debt register | Pack addresses TD themes (coffee hardcoding, mirrored tests) if gates held |

---

## 3. Binding design deltas — **RESOLVED** (2026-07-28)

All deltas below are design-locked. See resolution docs; synthesis in [14 — Marketplace Engine](./14-marketplace-engine-design.md).

| Delta | Resolution doc | Pass criterion |
|-------|----------------|----------------|
| **D1** Marketplace Vertical | [15](./15-d1-marketplace-vertical.md) | Vertical owns categories; data/API/migration/config defined |
| **D2** Seller Party | [16](./16-d2-seller-party.md) | SellerParty ≠ Farmer; bridge from \armer_id\ |
| **D3** Neutral vocabulary | [17](./17-d3-terminology-guide.md) | Terminology guide; GOODS/SUPPLIES/SERVICE |
| **D4** Attributes & extensions | [18](./18-d4-attribute-extension-strategy.md) | Config attrs + explicit extension sunset |
| **D5** Form schema | [19](./19-d5-form-schema-specification.md) | ahu.form.v1\ contract published |
| **D6** Tax & regulatory | [20](./20-d6-tax-regulatory-model.md) | Compliance layer architecture (no impl) |
| **D7** Module boundaries | [21](./21-d7-platform-module-boundaries.md) | Ownership map + farms-optional invariant |

### Historical decision text (superseded by 15–21)

Original brief decisions: D1 Vertical→Category; D2 SellerParty with Farmer specialization; D3 GOODS/SUPPLIES/offer date/business profile; D4 attributes-first + extension sunset; D5 form JSON before G4; D6 tax lines + jurisdiction config; D7 farms optional + module ownership in doc 21.

---

## 4. Extensibility scenarios (worked)

### 4.1 Honey (agri)

1. Activate/seed Category `HONEY`.  
2. Products: raw honey, comb, etc.  
3. Attributes: moisture %, floral source, container size.  
4. Units: kg, jar, liter.  
5. Certificate template: origin + lab moisture.  
6. Fee schedule: reuse or clone agri default.  
7. Delivery: weight-based — no change.

**Validation:** Fits pack **without** redesign.

### 4.2 Livestock (agri)

1. Category + species/breed attributes.  
2. Listing kind GOODS; stock qty often 1.  
3. Delivery policy: live-animal constraints as **policy pack** (future).  
4. Certificates: veterinary / ownership templates.

**Validation:** Fits; policy packs needed for logistics — design as config, not new order types.

### 4.3 Farm machinery / services

Machinery → SUPPLIES + condition attrs.  
Services → SERVICE kind + escrow without shipment (MVP).

**Validation:** Fits pack listing_kind plan.

### 4.4 Construction materials / furniture / electronics

Same engine: vertical `HOME` or `INDUSTRIAL`, categories, attributes (dimensions, SKU, warranty), optional serial certificate, volume-aware delivery tariffs already exist.

**Validation:** Fits **after D1–D3, D7**. Without them, teams will fork “Farms” branding and farmer FKs.

### 4.5 Wholesale / healthcare

Wholesale: MOQ attributes + B2B org buyers (identity already partial).  
Healthcare: compliance_profile on vertical + cold-chain delivery policy + restricted categories.

**Validation:** Architecture capable; **compliance packs** are new design work, not a new marketplace core.

---

## 5. Configurability scorecard

| Item | Target state | Validated? |
|------|--------------|------------|
| Categories | Admin + sell flags + vertical | After G2 + D1 |
| Product types | Admin CRUD | G2 |
| Attributes | Definitions + packs | G3 |
| Units | Catalog + dimension rules | Mostly G1; enforce G3 |
| Quality grades | Vocabularies per category | G3 |
| Pricing | Schedules | Already |
| Delivery rules | Tariffs + policy packs | Partial — add packs |
| Commissions | Fee schedules | Already |
| Taxes | Config rules | **Not yet** — D6 |
| Payments | Provider adapters | Roadmap OK |
| Forms / facets | Schema-driven | G4 + D5 |
| Certificates | Templates | Pack OK |

---

## 6. Marketplace Engine checklist

A release may claim “Marketplace Engine ready for multi-vertical” only when:

- [x] Design: coffee is a pack, not the schema center of gravity ([14](./14-marketplace-engine-design.md), [18](./18-d4-attribute-extension-strategy.md))  
- [ ] At least one non-coffee agri category live via config  
- [ ] Attributes drive create/search for that category  
- [ ] Certificate template ≠ coffee-only path  
- [x] Design: listing may exist without farm ([21](./21-d7-platform-module-boundaries.md))  
- [x] Design: seller glossary includes non-farmer sellers ([16](./16-d2-seller-party.md))  
- [x] Vertical/sector concept documented ([15](./15-d1-marketplace-vertical.md))  
- [x] Design: delivery + pricing independent of coffee fields  
- [x] Form-schema contract published ([19](./19-d5-form-schema-specification.md))  
- [x] Tax sketch accepted before payment rails go live ([20](./20-d6-tax-regulatory-model.md))  

Design checklist for **starting G2** is complete; runtime checklist above remains for engine completeness.


---

## 7. Risks if resolution docs are ignored in implementation

| If implementation ignores… | Consequence |
|----------------------------|-------------|
| D1 Vertical ([15](./15-d1-marketplace-vertical.md)) | Non-agri needs navigation/brand rewrite |
| D2 Seller ([16](./16-d2-seller-party.md)) | Every B2B seller hacked as fake farmer |
| D3 Naming ([17](./17-d3-terminology-guide.md)) | PRODUCE/harvest leak into electronics APIs |
| D4 Sunset ([18](./18-d4-attribute-extension-strategy.md)) | Permanent dual writers; drift |
| D5 Schema ([19](./19-d5-form-schema-specification.md)) | Each mobile screen re-hardcodes fields |
| D6 Tax ([20](./20-d6-tax-regulatory-model.md)) | Finance rebuilds order money model |
| D7 Boundaries ([21](./21-d7-platform-module-boundaries.md)) | Farms/checkout coupling; module spaghetti |

---

## 8. Design validation decision

**Validated for:** Multi-agriculture marketplace evolution on NAHU Platform.  
**Validated (architecturally) for:** Multi-sector marketplaces via Vertical + SellerParty + attributes — activation still gated by implementation waves.  
**Not validated as:** Same-sprint launch of arbitrary verticals.

**Sign-off:** D1–D7 resolved in docs 15–21; [14 — Marketplace Engine](./14-marketplace-engine-design.md) is the forward constitution. **G2 may begin** after RC1 staging smoke ([13](./13-implementation-readiness.md)).

