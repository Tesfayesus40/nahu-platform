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
├── 02-architecture/          ← architecture principles (markdown)
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
| [Business Model](business/nahu-platform-business-model.md) | Enterprise vision and business model |
| [Business Actors](business/business-actors.md) | Platform actors and IAM foundation |
| [Users Entity](03-domain-model/users-entity.md) | Approved Identity domain specification |
| [Staging deployment](08-guides/staging-deploy.md) | Deploy API to Railway staging |
| [Phase 3 — Product Catalog design](07-decisions/phase-3-product-catalog-design.md) | Approved v1.2 — multi-product catalog (status + multilingual) |
| [Phase 4 — Farmer Platform design](07-decisions/phase-4-farmer-platform-design.md) | Approved — Nahu Farm architecture & roadmap |
| [Phase 4.1 — Farm management design](07-decisions/phase-4.1-farm-management-design.md) | Approved v1.2 — farm management (implementation authorized) |

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
| 4 | Farmer Platform (Nahu Farm) — farms, inventory, warehouse readiness, production planning, dashboards | **4.1 Farm management done** (staging validated); 4.2 Inventory next |
| 5 | Nahu Delivery | Planned |

**Stable milestone:** Product Catalog (Phase 3) + Farm Management (Phase 4.1) — on-device Farmer/Buyer staging validation passed 2026-07-14. See `docs/07-decisions/`.

---

## Mobile clients

Farmer and Buyer apps are **Expo (React Native)** in the separate `nahu-buna-gebaya` repository. They consume `/api/v1` on this platform API. Enterprise architecture documents describe **Flutter** as the long-term mobile target.
