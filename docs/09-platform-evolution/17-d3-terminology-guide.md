# 17 — D3: Marketplace Terminology Guide

**Status:** Design locked — no production code  
**Resolves:** [12 — Design Validation](./12-design-validation.md) § D3  
**Parent:** [Platform Evolution index](./README.md)  
**Consumed by:** [14 — Marketplace Engine](./14-marketplace-engine-design.md)

---

## 1. Purpose

Standardize vocabulary so the platform core stays **marketplace-neutral** while experience packs (Nahu Farms, Buna Gebeya) keep familiar agri/coffee language in UI.

**Rule:** Engineering, SQL comments for *new* objects, OpenAPI, and Admin IA use **neutral terms**. Mobile copy may use vertical-specific labels via i18n.

---

## 2. Core terminology map

| Avoid in core (legacy) | Prefer (neutral) | Experience-pack label (examples) |
|------------------------|------------------|----------------------------------|
| Coffee listing | **Listing** | “Coffee listing” only in Buna Gebeya copy |
| Farmer (as sole seller) | **Seller** / **Seller Party** | “Farmer” in Farmer App |
| Farm (as required site) | **Business Profile** | “Farm” in Nahu Farms |
| Produce (kind) | **Goods** (`GOODS`) | “Produce” alias in agri UI |
| Input (kind) | **Supplies** (`SUPPLIES`) | “Inputs” in agri UI |
| Commodity (entity) | **Product** (catalog) | Marketing may say commodity |
| Harvest date (required) | **Offer date** / **Produced on** | “Harvest date” for crop categories |
| Grade (coffee-only) | **Quality grade** (vocab per category) | Coffee grades 1–9 |
| Process method | **Attribute** (category pack) | “Processing method” coffee |
| Woreda-only location | **Location** (structured address + geo) | Keep woreda fields where relevant |
| Farmer fee | **Seller fee** (platform fee on seller) | Can still say “farmer fee” in agri admin until rename |
| Buyer app “coffee home” | **Category hub** | Coffee default via config |

---

## 3. Listing kinds (canonical codes)

| Code | Meaning | Agri UI alias |
|------|---------|---------------|
| `GOODS` | Tangible offerings for sale | Produce |
| `SUPPLIES` | Goods used as inputs to production/trade | Inputs |
| `SERVICE` | Non-inventory or light-inventory services | Services |

Store **canonical codes** in DB. Map aliases in form-schema / i18n (`labelKey: listingKind.GOODS.agriculture`).

---

## 4. Actor glossary

| Actor | Core name | Notes |
|-------|-----------|-------|
| Buyer | Buyer | Unchanged |
| Seller | Seller Party | Types: Farmer, Company, … |
| Courier | Courier | Delivery module |
| Admin | Admin operator | RBAC permissions |
| Organization | Organization | Companies, coops (D7) |
| Platform | NAHU Platform | Umbrella |

---

## 5. Module / product names (brands vs domains)

| Brand / product | Domain module | Neutral domain noun |
|-----------------|---------------|---------------------|
| Nahu Buna Gebeya | Marketplace experience | Coffee category pack |
| Nahu Farms | Agri vertical experience | Agriculture vertical |
| Nahu Delivery | Delivery | Shipment / fulfillment |
| Nahu Payments | Payments | Payment intent / capture |
| Nahu Finance | Finance | Ledger / credit |
| Nahu AI | AI | Advisory / inference packs |

---

## 6. Field renaming policy

| Today (physical) | API / docs | UI |
|------------------|------------|-----|
| `harvest_date` | `offerDate` (+ `harvestDate` deprecated alias) | Category label |
| `farm_id` | `businessProfileId` optional alias; keep `farmId` while agri-linked | “Farm” |
| `farmer_id` | `sellerPartyId` primary after bridge; `farmerId` compat | “Seller” / “Farmer” |
| `process_method` | `extensions.coffee` / attributes | Coffee form |
| `grade` | `qualityGrade` | Category vocab |
| `quantity_kg` | Prefer `quantity` + `unitCode` | Unit label |

**Never** rename production columns in a breaking migration without dual-read period.

---

## 7. Document & code hygiene checklist

When adding design or code:

- [ ] No new required coffee-only columns on `listings` core  
- [ ] No new APIs named `/farmers/listings` for generic commerce (prefer `/sellers/...` or `/marketplace/listings`)  
- [ ] Listing kind uses `GOODS|SUPPLIES|SERVICE`  
- [ ] Vertical referenced when discussing category scope  
- [ ] Experience-pack labels isolated in i18n / app config  

---

## 8. Updates to earlier pack language

Documents 01–10 remain historically agri-framed. **This guide + doc 14 supersede** naming for forward work. Light errata:

- Doc 03/04 “PRODUCE / INPUT” → treat as aliases of `GOODS` / `SUPPLIES`.  
- Doc 03 `harvest_date` → semantic **offer date**.  
- “Farmer” in core diagrams → **Seller Party** (Farmer specialization called out).
