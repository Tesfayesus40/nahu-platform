# Nahu Platform — Architecture

This page is the entry point for platform architecture documentation. It does not replace the enterprise documents — it links to them.

---

## Start here

| Document | Description |
|----------|-------------|
| [Architecture Principles](02-architecture/architecture-principles.md) | Ten binding design principles (markdown, active) |
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

The running backend (`apps/api`) implements Phase 1 foundation modules: Identity, Marketplace (coffee), Orders, Certificates, Payments (catalog), Advisory, and Uploads. See [API README](../apps/api/README.md) for the live endpoint catalog and [Data Dictionary](../database/docs/data-dictionary.md) for database modules.
