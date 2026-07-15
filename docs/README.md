# Nahu Platform — Documentation Index

Start here before writing or modifying code. The [Engineering Playbook](engineering-playbook.md) defines how we build; this page maps every official document and how they relate.

---

## Documentation authority

When documents conflict, use this order (most specific wins for its domain):

| Priority | Source | Use for |
|----------|--------|---------|
| 1 | [Users Entity](03-domain-model/users-entity.md) and other `03-domain-model/` specs | Entity fields and Identity rules |
| 2 | [API README](../apps/api/README.md) | Endpoint routes, request/response shapes, migration notes |
| 3 | [Engineering Playbook](engineering-playbook.md) | Conventions, database workflow, mobile API v1 contract |
| 4 | [Architecture Principles](02-architecture/architecture-principles.md) | Design principles |
| 5 | Enterprise `.docx` documents (`architecture/`, `engineering/`, `products/`) | Vision, domain model, long-term targets |
| 6 | [Data Dictionary](../database/docs/data-dictionary.md) | Database module overview |

**Mobile API v1 contract (authoritative today):** direct resource responses on success; errors as `{ "error": "message" }`. See the Engineering Playbook — not the M6 `{ success, data }` envelope, which is a future target.

---

## Folder map

```
docs/
├── README.md                 ← you are here
├── architecture.md           ← architecture entry point
├── engineering-playbook.md   ← how we build (active)
├── business/                 ← business model and actors
├── 02-architecture/          ← architecture principles + Nahu Farm V1 overview (markdown)
├── 03-domain-model/          ← entity specifications
├── 08-guides/                ← operational how-to guides
├── architecture/             ← enterprise architecture (.docx)
├── engineering/              ← technical standards (.docx)
└── products/                 ← product functional specs (.docx)

database/docs/                ← data dictionary (outside this folder)
```

Planned (not yet created): `04-requirements/`, `05-api/`, `06-database/`.  
Present: `07-decisions/` (design proposals awaiting or recording approval).

---

## Active markdown documents

| Document | Description |
|----------|-------------|
| [Engineering Playbook](engineering-playbook.md) | Monorepo conventions, SQL-first migrations, API rules, mobile compatibility |
| [Architecture entry point](architecture.md) | Links to architecture principles and enterprise documents |
| [Architecture Principles](02-architecture/architecture-principles.md) | Ten platform design principles |
| [Nahu Farm V1 Architecture Overview](02-architecture/nahu-farm-v1-architecture-overview.md) | Reference architecture — modules, entities, APIs, mobile hierarchy, data flow (Phases 4.1–4.7) |
| [Business Model](business/nahu-platform-business-model.md) | Enterprise vision and business model |
| [Business Actors](business/business-actors.md) | Platform actors and IAM foundation |
| [Users Entity](03-domain-model/users-entity.md) | Approved Identity domain specification |
| [Staging deployment](08-guides/staging-deploy.md) | Deploy API to Railway staging |
| [Phase 3 — Product Catalog design](07-decisions/phase-3-product-catalog-design.md) | Approved v1.2 — multi-product catalog (status + multilingual) |
| [Phase 4 — Farmer Platform design](07-decisions/phase-4-farmer-platform-design.md) | Approved — Nahu Farm architecture & roadmap |
| [Phase 4.1 — Farm management design](07-decisions/phase-4.1-farm-management-design.md) | Approved v1.2 — farm management (implementation authorized) |
| [Phase 4.2 — Inventory design](07-decisions/phase-4.2-inventory-design.md) | **Closed** — staging + Farmer APK validated |
| [Phase 4.3 — Warehouse design](07-decisions/phase-4.3-warehouse-design.md) | **Closed** — staging + Farmer M7 on-device (Warehouse complete); production held |
| [Phase 4.4 — Listing ↔ stock design](07-decisions/phase-4.4-listing-stock-design.md) | **Approved** — implementation authorized; production held |
| [Phase 4.5 — Production planning design](07-decisions/phase-4.5-production-planning-design.md) | **Closed** v1.1 — staging + Farmer M10 on-device (Amharic packaged); production held |
| [Phase 4.6 — Dashboards design](07-decisions/phase-4.6-dashboards-design.md) | **Closed** v1.3 — staging + Farmer M11 on-device; production held |
| [Phase 4.7 — Harvest management design](07-decisions/phase-4.7-harvest-management-design.md) | **Closed** v1.1 — staging + Farmer M12 on-device; production held |
| [Phase 4.5 — On-device smoke](08-guides/phase-4.5-on-device-smoke.md) | M10 staging smoke checklist (passed) |
| [Phase 4.6 — On-device smoke](08-guides/phase-4.6-on-device-smoke.md) | M11 staging smoke checklist (passed) |
| [Phase 4.7 — On-device smoke](08-guides/phase-4.7-on-device-smoke.md) | M12 staging smoke checklist (passed) |
| [Backend ↔ Mobile feature mapping](backend-mobile-feature-mapping.md) | Capability matrix (Farmer/Buyer vs Nest modules) |

---

## Enterprise documents (.docx)

### Architecture

| Document | Topic |
|----------|-------|
| [01 — Master Vision](architecture/01_Master_Vision_NAHU_Platform_v1.docx) | Vision, mission, product portfolio |
| [02 — Enterprise Architecture](architecture/02_Enterprise_Architecture_NAHU_Platform_v1.docx) | Layers, domains, technology stack |
| [03 — Enterprise Domain Model](architecture/03_Enterprise_Domain_Model_NAHU_Platform_v1.docx) | Entities, relationships, lifecycles |

### Engineering

| Document | Topic |
|----------|-------|
| [M5 — Technical Architecture & Standards](engineering/M5_Technical_Architecture_Engineering_Standards_v1.docx) | Engineering standards, module structure |
| [M6 — Database Design & API Contracts](engineering/M6_Database_Design_and_API_Contracts_v1.docx) | Schema map, API conventions (target state) |
| [M7 — Sprint Planning & Roadmap](engineering/M7_Sprint_Planning_and_Release_Roadmap_v1.docx) | Milestones and sprint backlog |
| [M8 — Cursor Engineering Playbook](engineering/M8_Cursor_Engineering_Playbook_v1.docx) | AI assistant workflow |
| [M9 — Testing, QA, CI/CD & Deployment](engineering/M9_Testing_QA_CICD_Deployment_Guide_v1.docx) | Quality and release practices |

### Products

| Document | Topic |
|----------|-------|
| [04 — Nahu Farms](products/04_Nahu_Farms_Functional_Specification_v1.docx) | Agricultural marketplace functional spec |
| [05 — Nahu Delivery](products/05_Nahu_Delivery_Functional_Specification_v1.docx) | Logistics functional spec |

---

## Related documentation (outside `docs/`)

| Document | Description |
|----------|-------------|
| [Root README](../README.md) | Quick start and repository map |
| [CONTRIBUTING](../CONTRIBUTING.md) | Contribution workflow |
| [API README](../apps/api/README.md) | Endpoint catalog and package history |
| [Data Dictionary](../database/docs/data-dictionary.md) | Database module overview |

---

## Implementation phases

Incremental evolution toward the enterprise architecture (preserve existing coffee marketplace functionality throughout):

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Repository stabilization — cleanup, documentation, CI | Done |
| 2 | Nahu Farms generalization — multi-commodity marketplace (coffee first) | Done |
| 3 | Product catalog | **Done** (staging validated; milestone tagged) |
| 4 | Farmer Platform (Nahu Farm) — farms, inventory, warehouse, planning, dashboards, harvest | **4.1–4.7 closed on staging**; production Nest cutover held |
| 5 | Nahu Delivery | Planned |

**Stable milestone:** Phase 3 Catalog + Phase 4.1 Farms + Phase 4.2 Inventory — Farmer staging APK validated 2026-07-15 (`milestone-phase-4.2`). Production Nest/mobile cutover remains held until explicit approval. See `docs/07-decisions/`.

---

## Mobile clients

Farmer and Buyer apps are **Expo (React Native)** in the separate `nahu-buna-gebaya` repository. They consume `/api/v1` on this platform API. Enterprise architecture documents describe **Flutter** as the long-term mobile target.

Older coffee demo apps (`nahu_coffee_farmer`, `nahu_coffee_buyer`) are **reference only** — no new feature work.

For what Nest already exposes vs what Farmer/Buyer screens implement, see **[Backend ↔ Mobile feature mapping](backend-mobile-feature-mapping.md)** before starting Phase 4.3 or new mobile UI.
