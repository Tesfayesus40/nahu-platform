# Nahu Platform

# Enterprise Data Dictionary

**Version:** 1.0

**Project:** Nahu Platform

**Status:** Draft

---

# Purpose

This document defines the database structure of the Nahu Platform.

It is the primary reference for:

- Database design
- Backend development
- API development
- Mobile applications
- AI platform
- Reporting
- Future integrations

---

# Database Modules

| Module | Description |
|---------|-------------|
| Identity | Users, roles, authentication |
| Organizations | Cooperatives, exporters, buyers |
| Geography | Regions, zones, woredas, kebeles |
| Agricultural Catalog | See below |
| Farms (Nahu Farm) | Farm holdings, parties, plots/fields/production units (Phase 4.1) |
| Inventory | Stock lots and movements for catalog products (Phase 4.2) |
| Marketplace | Listings and offers |
| Orders | Buying and selling |
| Payments | Transactions |
| Warehousing | Inventory |
| Logistics | Transportation |
| Messaging | Chat system |
| AI | Intelligent services |
| Administration | Platform configuration |

---

# Agricultural Catalog (Phase 2–3)

Schema: `catalog`

| Table | Purpose |
|-------|---------|
| `categories` | Commodity families (`COFFEE` active; cereals, livestock, … inactive until enabled) |
| `units` | Canonical UoM (`KG`, `LITER`, `HEAD`, …) with `dimension` |
| `products` | Saleable product types; lifecycle `status`; `is_default` per category |
| `product_varieties` | Optional cultivars / breeds |
| `product_translations` | Locales beyond en/am (`om`, `ti`, `so`, `aa`, …) |

Marketplace `listings.product_id` → `catalog.products` (nullable until backfill; coffee backfilled in Phase 3).

Authoritative design: `docs/07-decisions/phase-3-product-catalog-design.md`.

---

# Farms / Nahu Farm (Phase 4.1)

Schema: `farms`

| Table | Purpose |
|-------|---------|
| `farms` | Production holdings (no product ownership) |
| `farm_parties` | Ownership / access (owner, tenant, coop, …) |
| `plots` / `fields` / `production_units` | Hierarchy |
| `farm_translations` | Extra locales |
| `farm_party_history` / `farm_audit_log` | History & audit |

Products remain in `catalog`. Listings reference products. Season/cropping cycles planned in Phase 4.5.

Authoritative design: `docs/07-decisions/phase-4.1-farm-management-design.md`.

---

# Inventory (Phase 4.2)

Schema: `inventory`

| Table | Purpose |
|-------|---------|
| `stock_lots` | Traceable product batches at a farm |
| `stock_movements` | Append-only ledger |
| `reservations` | Soft holds (API in 4.4) |

Also: `catalog.unit_conversions` for same-dimension unit factors.

Authoritative design: `docs/07-decisions/phase-4.2-inventory-design.md`.
| Logistics | Transportation |
| Messaging | Chat system |
| AI | Intelligent services |
| Administration | Platform configuration |