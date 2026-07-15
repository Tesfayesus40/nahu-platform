# Nahu Platform — Architecture

This page is the entry point for platform architecture documentation. It does not replace the enterprise documents — it links to them.

---

## Start here

| Document | Description |
|----------|-------------|
| [Architecture Principles](02-architecture/architecture-principles.md) | Ten binding design principles (markdown, active) |
| [Nahu Farm V1 Architecture Overview](02-architecture/nahu-farm-v1-architecture-overview.md) | Reference architecture for Farmer Platform Phases 4.1–4.7 (staging) |
| [Documentation index](README.md) | Full map of all platform documentation |

---

## Enterprise architecture (.docx)

| Document | Description |
|----------|-------------|
| [01 — Master Vision](architecture/01_Master_Vision_NAHU_Platform_v1.docx) | Long-term vision, mission, product portfolio |
| [02 — Enterprise Software Architecture](architecture/02_Enterprise_Architecture_NAHU_Platform_v1.docx) | Logical layers, business domains, technology stack |
| [03 — Enterprise Domain Model](architecture/03_Enterprise_Domain_Model_NAHU_Platform_v1.docx) | Core entities, relationships, business rules |

---

## Engineering references

| Document | Description |
|----------|-------------|
| [Engineering Playbook](engineering-playbook.md) | How we implement — conventions, migrations, API v1 contract |
| [M5 — Technical Architecture & Standards](engineering/M5_Technical_Architecture_Engineering_Standards_v1.docx) | Module structure and coding standards |
| [M6 — Database Design & API Contracts](engineering/M6_Database_Design_and_API_Contracts_v1.docx) | Target database schemas and API patterns |

---

## Product specifications

| Document | Description |
|----------|-------------|
| [04 — Nahu Farms](products/04_Nahu_Farms_Functional_Specification_v1.docx) | Agricultural marketplace |
| [05 — Nahu Delivery](products/05_Nahu_Delivery_Functional_Specification_v1.docx) | Logistics platform |

---

## Current implementation snapshot

The running backend (`apps/api`) and Farmer Expo client implement **Nahu Farm V1** on staging:

- **Phase 1–2:** Identity, Marketplace (coffee-first), Orders, Certificates, Payments (methods catalog), Advisory, Uploads
- **Phase 3:** Product Catalog (`catalog.products`, units, varieties, translations; listings `product_id`)
- **Phase 4.1–4.7:** Farms/plots → production planning → harvest → inventory → warehouse → listing↔stock → farmer dashboard

Farms do **not** own products; listings reference `catalog.products`. Inventory is the stock system of record. **Production Nest / mobile cutover remains held.**

Canonical overview: [Nahu Farm V1 Architecture Overview](02-architecture/nahu-farm-v1-architecture-overview.md).  
Also: [API README](../apps/api/README.md), [Data Dictionary](../database/docs/data-dictionary.md), [Phase decisions](07-decisions/), [Backend ↔ Mobile mapping](backend-mobile-feature-mapping.md).
