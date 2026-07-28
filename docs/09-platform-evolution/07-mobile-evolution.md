# 07 — Mobile Application Evolution Plan

**Status:** Planning only  
**Date:** 2026-07-28  
**Parent:** [Platform Evolution index](./README.md)  
**Apps:** `nahu-buna-buyer`, `nahu-buna-farmer`, `nahu-buna-courier` (gebaya monorepo)

---

## 1. Principles

1. **One app per role** — do not fork “Nahu Cereals Buyer”.  
2. **Schema-driven UI** — forms and facets from API.  
3. **Coffee skin stays** — Buna Gebeya branding until platform cutover.  
4. **Courier stays logistics-first** — almost no category UI.  
5. **Shared package** — put form renderer / facet bar in `shared/`.

---

## 2. Buyer evolution

| Stage | Behaviour |
|-------|-----------|
| RC1 (now) | Coffee experience; pricing.v1 fees; dynamic delivery gated off |
| G4 | Category switcher (if multiple active); facets from schema |
| G5 | Non-coffee cards/detail without coffee-only widgets |
| Later | Inputs/services browse sections |

**Reuse:** navigation, checkout, escrow payment, delivery tracking, order detail fee lines.  
**Generalize:** Home hero copy, browse filters, listing detail attribute sections.  
**Coffee-specific keep:** Origin chips, process/grade display when `extensions.coffee` present.

Checkout must remain **server-priced** (`/pricing/active`, `buyerChargeEtb`) regardless of category.

---

## 3. Farmer evolution

| Stage | Behaviour |
|-------|-----------|
| RC1 | Coffee listing create/edit |
| G4 | Form sections rendered from `form-schema` |
| G5 | Create teff (etc.) without coffee fields |

**Reuse:** Auth, orders, earnings (`farmerPayoutEtb`), delivery/pickup locations, stock links.  
**Generalize:** `NewListingScreen` / edit flows — replace hard-coded coffee fields with schema engine.  
**Coffee-specific keep:** Coffee field pack registration in shared config until attrs fully drive UI.

---

## 4. Courier evolution

| Need | Action |
|------|--------|
| Multi-ag parcels | None for MVP — shipment already generic |
| Weight from listing | Optional display of declared weight |
| Category labels | Show product name from order; no coffee enums |

Courier is **already aligned** with platform logistics vision (food, parcels, etc. later via shipment metadata).

---

## 5. Shared architecture

```text
shared/
  marketplace/
    listingDisplay.js      -- already multi-field
    orderDisplay.js        -- fee-aware
    formSchema/            -- NEW renderer
    facetSchema/           -- NEW
  catalog/
    categoryTheme.js       -- optional skins
```

Avoid duplicating money math; keep trusting Nest for fees.

---

## 6. Branding rollout

| Phase | Store name / UI |
|-------|-----------------|
| Now | Nahu Buna Gebeya (coffee) |
| Multi-ag soft launch | Same apps; in-app “Nahu Farms” category hub |
| Hard cutover | Optional rename / new store listing — **separate program** |

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Huge NewListing rewrite | Incremental: coffee pack as first schema equivalent to today’s form |
| Offline schema cache stale | Version form-schema; refetch on focus |
| Expo SDK doc mismatch | Align AGENTS.md with installed SDK (tech debt) |

---

## 8. Non-goals for mobile in early G waves

- Native livestock live-video commerce  
- Full service scheduling calendar  
- Separate Inputs app  
- Enabling dynamic delivery fees before routing roadmap
