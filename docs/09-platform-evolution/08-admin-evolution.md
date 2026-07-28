# 08 — Admin Portal Evolution Plan

**Status:** Planning only  
**Date:** 2026-07-28  
**Parent:** [Platform Evolution index](./README.md)

---

## 1. Role of Admin in multi-ag

Admin becomes the **control plane** for category activation, attribute definitions, quality vocabularies, and moderation — not a place that hard-codes coffee widgets forever.

---

## 2. Reuse

| Existing | Keep |
|----------|------|
| Listing moderation queue / decisions | Yes — generic workflow |
| Orders, disputes, pricing, delivery ops | Yes — category-agnostic |
| Feature flags | Yes — category sell flags |
| User / verification | Yes |

---

## 3. New Admin surfaces (planned)

| Surface | Purpose |
|---------|---------|
| **Catalog → Categories** | Activate/deactivate, listing kind, regulatory flags |
| **Catalog → Products / Varieties** | CRUD seeds without SQL |
| **Catalog → Attribute definitions** | Required/optional fields, types, enums |
| **Catalog → Facet config** | Buyer search facets |
| **Catalog → Form schema preview** | See Farmer form for a category |
| **Certificates → Templates** | Field schema per template |
| **Pricing** | Already exists — no commodity fork |

---

## 4. Moderation UI evolution

| Today | Target |
|-------|--------|
| Detail shows grade · processMethod · kg | **Attribute panel** driven by listing category |
| Queue columns coffee-oriented | Configurable columns / “primary attrs” |

Moderation permissions stay `marketplace.listings.*`.

---

## 5. Category activation checklist (Admin UX)

Before enabling sell for a category:

1. Products + default units exist  
2. Attribute definitions published  
3. Form schema validates  
4. Facets defined (can be empty)  
5. Certificate template selected or “none”  
6. Feature flag / `sell_enabled` on  
7. Smoke listing created in staging  

Encode as a checklist component to prevent premature activation.

---

## 6. Permissions

| Permission (illustrative) | Use |
|---------------------------|-----|
| `catalog.read` / `catalog.write` | Category/product/attrs |
| Existing listing moderation | Unchanged |
| `admin.system.config.*` | Flags + pricing |

Do not overload pricing permissions for catalog writes.

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Admins invent inconsistent attrs | Starter packs (Coffee Pack, Cereals Pack) as templates |
| Breaking coffee moderation display | Dual render: legacy coffee rows OR attribute panel |
| SQL-only catalog ops continue | Admin CRUD is G2 priority so seeds aren’t tribal knowledge |

---

## 8. Alignment with Revenue Engine Admin

Pricing page remains the **only** place for fee % and tariffs. Multi-ag must not reintroduce hardcoded commission in Admin listing tools.
