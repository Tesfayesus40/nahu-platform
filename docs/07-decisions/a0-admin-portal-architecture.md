# A0 — Admin Portal Architecture

**Status:** Approved — 2026-07-19  
**Date:** 2026-07-19  
**Version:** 1.2 — A0 approved; A1 design next  
**Audience:** Product · Operations · Engineering · Security  
**Depends on:** Identity · Catalog · Farms · Inventory · Warehouse · Marketplace · Orders · Certificates  
**Constraint:** A0 authorizes architecture only. Database, API, frontend, staging, and production changes require A1 (and later phase) approval. Production remains unchanged until explicitly approved.

---

## 1. Executive decision

Build the Admin Portal as a **separate web application** inside the existing `nahu-platform` monorepo:

```text
apps/admin-web        Next.js + TypeScript administrative web application
        │
        │ secure same-origin BFF calls
        ▼
apps/api              existing NestJS modular monolith
        │
        ├── Identity / authorization
        ├── domain-owned admin commands and queries
        ├── audit trail
        └── PostgreSQL schemas already owned by each domain
```

The portal is an **operational control plane**, not a new system of record. It must not duplicate Farmer, Buyer, listing, order, inventory, or catalog truth. Admin commands pass through the same domain services and transition rules used by mobile clients; privileged reads use dedicated, paginated admin query contracts.

### Recommended foundations

1. **Invite-only workforce identity** with mandatory MFA; never reuse Farmer/Buyer self-registration for administrators.
2. **Permission-based authorization** using the existing `identity.permissions` and `identity.role_permissions` tables. `ADMIN` alone is too broad for production operations.
3. **Append-only platform audit events** for every privileged mutation and sensitive administrative access.
4. **Dedicated `/api/v1/admin/*` contracts** with strict pagination, filtering, redaction, request IDs, reason capture, and optimistic concurrency.
5. **Domain ownership remains intact:** Identity controls users/access; Catalog controls categories/products/units; Marketplace controls profiles/listings; Orders controls lifecycle/disputes; Farms/Inventory/Warehouse control their records.
6. **Commodity-agnostic shell:** navigation, filters, tables, permissions, dashboard metrics, and workflow contracts use Category → Product → Listing and quantity + unit. Coffee remains an extension, never the portal's core model.

---

## 2. Why this architecture

The existing platform is a NestJS modular monolith over one PostgreSQL database with separate schemas and a Turborepo root. This is the right boundary for the current stage: add a web application and explicit admin APIs without splitting operational transactions across services.

The current identity data model already contains:

- users, credentials, roles, permissions, role-permissions, organizations, and user-organizations;
- `ADMIN`, `FARMER`, and `BUYER` role seeds;
- JWT authentication and route-level role guards.

However, the current runtime authorization only checks one role string from a long-lived JWT. Permissions are modeled but not enforced. User status is not revalidated on each privileged request, token revocation/refresh sessions are absent, CORS can default open, and the only current audit model is farm-specific. These are acceptable constraints for the validated mobile staging track, but they are not sufficient for a production administrative control plane.

The Admin Portal therefore starts with **security and audit foundations**, before broad CRUD screens.

---

## 3. Goals and non-goals

### 3.1 Goals

1. Give authorized Nahu staff a secure, searchable operational view across Farmer, Buyer, Identity, Catalog, Farms, Marketplace, Orders, Inventory, Warehouse, and Certificates.
2. Enable controlled actions such as account suspension, farmer verification, catalog activation, listing moderation, and order/dispute operations.
3. Make every privileged action attributable, reviewable, and reversible where the domain supports reversal.
4. Support least-privilege teams rather than one shared super-admin account.
5. Preserve domain invariants and avoid direct database editing as an operational workflow.
6. Remain category/product/unit based so future commodities require configuration and optional extension renderers, not portal redesign.
7. Provide a staging-first delivery path with production held behind explicit approval.

### 3.2 Non-goals for the initial Admin Portal

- Replacing Farmer or Buyer mobile workflows.
- Creating a second catalog, user store, order ledger, inventory ledger, or payment ledger.
- Real payment-provider settlement or refunds before the Payments phase is separately approved.
- Building logistics/dispatch before that domain is designed.
- A general-purpose database browser or arbitrary SQL console.
- Microservice decomposition, event streaming infrastructure, or a data warehouse before measured scale requires them.
- Activating a new commodity as part of Admin Portal delivery.
- Production deployment or production data changes.

---

## 4. Architecture principles

### 4.1 Control plane, not source of truth

```text
Admin UI intent
  → authorized admin API command
  → owning domain application service
  → domain validation + transaction
  → append-only audit event
  → response / refreshed read model
```

The portal never writes domain tables directly. A listing moderation action is a Marketplace command; an order transition is an Orders command; a role assignment is an Identity command.

### 4.2 Modular monolith first

Keep one deployable Nest API while preserving module boundaries. A separate admin web service improves security and deployment isolation without introducing distributed transaction complexity.

### 4.3 Least privilege and deny by default

Every `/admin/*` endpoint requires an explicit permission. Hiding a menu item is only presentation; the API remains the enforcement point.

### 4.4 Additive evolution

Prefer additive tables, endpoints, permissions, response fields, and status transitions. Existing Farmer and Buyer contracts remain unchanged.

### 4.5 Commodity neutrality

Core administrative records use:

- `categoryCode`, `productCode`, optional variety;
- `quantity`, `unitCode`, `pricePerUnit`, packaging;
- generic `qualityGrade`;
- `extensions.<family>` for commodity-specific data.

No core admin route, dashboard metric, filter, or permission is named for coffee. A Coffee details panel may render `extensions.coffee` when present.

### 4.6 Operational safety

Destructive actions are avoided. Use suspend, archive, withdraw, reject, or deactivate with reason and audit history. High-impact commands require confirmation; selected commands may require dual approval in a later phase.

---

## 5. System context and boundaries

```text
Nahu operations staff
        │ HTTPS
        ▼
Admin Web / BFF
  - secure HttpOnly cookies
  - CSRF protection
  - route gating and redaction-aware UI
  - no business rules
        │ private/public HTTPS
        ▼
Nest API /api/v1/admin
  ├── Identity + AuthZ
  ├── Admin dashboard/read orchestration
  ├── Catalog admin controllers
  ├── Marketplace admin controllers
  ├── Orders admin controllers
  ├── Farms/Inventory/Warehouse admin controllers
  ├── Certificates admin controllers
  └── Audit module
        │
        ▼
PostgreSQL
  identity · catalog · marketplace · orders
  farms · inventory · warehouse · audit

Existing Expo Farmer and Buyer apps
        └── existing /api/v1 mobile contracts (unchanged)
```

### Boundary rules

| Boundary | Rule |
|---|---|
| Browser → Admin Web | Same-origin browser requests; session only in secure HttpOnly cookie |
| Admin Web → Nest | User-bound short access token over HTTPS; no broad service account and no database access from Next.js |
| Nest admin controller → domain | Call exported application services, not raw cross-domain Prisma mutations |
| Admin read orchestration | May join/read across modules for purpose-built projections |
| Domain mutation → audit | Business mutation and audit insert succeed atomically where practical |
| Mobile contracts | No breaking response or auth change |

### 5.1 Existing and future product integration

The Admin Portal is a privileged client of the same Nahu Platform, not a peer backend:

| Product/module | Integration with Admin Portal | Ownership boundary |
|---|---|---|
| Farmer mobile | Admin observes users, profiles, farms, production, inventory, listings, and seller orders created through Farmer workflows | Farmer remains the producer-facing client; Farms/Inventory/Marketplace remain authoritative |
| Buyer mobile | Admin observes buyer identity, orders, disputes, addresses, payments, and certificates created through Buyer workflows | Buyer remains the purchasing client; Orders/Payments/Certificates remain authoritative |
| Identity | Admin authentication, sessions, roles, permissions, status, organizations, and scopes | Identity alone grants/revokes workforce access |
| Marketplace | Farmer verification, cooperative review, listing moderation, seller traceability | Marketplace owns profile/listing state and validation |
| Catalog | Category, product, variety, unit, localization, and activation controls | Catalog owns reusable product taxonomy; Admin only supplies authorized commands |
| Farms | Farm, party, plot, cycle, harvest, and activity visibility | Farms owns operational records and access rules |
| Inventory/Warehouse | Lot, movement, reservation, balance, storage-site, and traceability views | Inventory remains the quantity ledger; Warehouse remains location truth |
| Orders/Payments | Order timeline, dispute queue, payment references, settlement visibility later | Orders owns lifecycle; Payments owns provider truth when implemented |
| Certificates | Search, verification, and governed reissue/revocation later | Certificates remain derived from authoritative order/listing provenance |
| Future Delivery | Shipment/dispatch/tracking exceptions appear in Admin under Delivery permissions | Delivery owns shipment, carrier, route, proof-of-delivery, and dispatch transitions |

Future Delivery integrates through order and inventory identifiers:

```text
Order CONFIRMED
  → Delivery creates/manages shipment
  → Inventory DISPATCH records physical departure
  → Delivery updates SHIPPED / DELIVERED evidence
  → Admin monitors exceptions and applies governed overrides only
```

Admin Operations must not absorb route planning, fleet, carrier, or proof-of-delivery rules. Those belong to the future Delivery module and can contribute navigation, permissions, dashboard queues, and audit actions through the same extension pattern.

---

## 6. Frontend architecture

### 6.1 Technology and location

Create `apps/admin-web` as a **Next.js App Router, TypeScript-strict** application in the existing pnpm/Turborepo workspace.

Recommended frontend capabilities:

- server-rendered authenticated shell and route guards;
- Backend-for-Frontend route handlers for session cookies and CSRF;
- TanStack Query for server state and invalidation;
- TanStack Table for large paginated operational tables;
- React Hook Form + schema validation for command forms;
- an accessible component system with reusable Nahu tokens;
- Playwright for end-to-end tests;
- internationalization-ready message catalogs (English first; Amharic can be enabled without moving strings out of components later).

No business transition logic belongs in the frontend. The API returns allowed actions and authoritative errors.

### 6.2 Proposed structure

```text
apps/admin-web/
  app/
    (auth)/login/
    (portal)/
      dashboard/
      people/
      farmers/
      buyers/
      catalog/
      listings/
      orders/
      inventory/
      certificates/
      audit/
      system/
    api/                    # BFF/session route handlers only
  features/
    identity/
    participants/
    catalog/
    marketplace/
    orders/
    inventory/
    certificates/
    audit/
  components/
    data-table/
    command-dialog/
    status/
    extension-host/
  lib/
    api/
    auth/
    permissions/
    i18n/
    telemetry/
```

The complete target monorepo shape is:

```text
nahu-platform/
  apps/
    api/                         # existing Nest platform API
      prisma/
      src/
        admin/                   # dashboard/read orchestration only
        audit/                   # platform audit infrastructure
        common/authz/            # permission/session/scope enforcement
        identity/                # workforce auth + identity-owned admin routes
        catalog/                 # catalog-owned admin routes
        marketplace/             # verification/moderation routes
        orders/                  # order/dispute routes
        farms/
        inventory/
        warehouse/
        certificates/
        delivery/                # future; not created by A0/A1
    admin-web/                   # new Next.js portal
  packages/
    api-contracts/               # optional generated/shared DTO types after contract tooling is approved
    admin-ui/                    # optional only after components prove reusable
    config/                      # optional shared lint/TypeScript configuration
  database/
    migrations/
      identity/
      audit/
      operations/                # only when A4 case workflows are approved
  docs/07-decisions/
  scripts/
```

`packages/*` extraction is intentionally delayed. A1 may keep types/UI local; shared packages are created only when two consumers need them or generated API contracts are adopted.

### 6.3 Information architecture

| Area | Purpose | Initial posture |
|---|---|---|
| Dashboard | Role-aware queues and platform health | Read-only aggregation |
| People & Access | Users, roles, sessions, organizations | Controlled writes |
| Farmers | Profile/farm review and verification | Review + verify/suspend |
| Buyers | Buyer identity and order history | Read + account status |
| Catalog | Categories, products, varieties, units | Controlled configuration |
| Marketplace | Listings, cooperatives, moderation queues | Review + moderation |
| Orders | Lifecycle, addresses, disputes, timeline | Read; guarded commands |
| Payments | Payment references and simulation state | Read-only until provider phase |
| Inventory & Warehouse | Lots, balances, reservations, sites | Read-only initially |
| Certificates | Search, inspect, reissue policy later | Read-only initially |
| Audit | Who did what, when, why, and outcome | Read-only |
| System | Health, versions, jobs, feature flags later | Restricted read |

Navigation is permission-derived. A Catalog Manager does not see user-role controls; an Auditor receives read-only views.

### 6.4 Navigation hierarchy and pages

```text
Admin Portal
├── Authentication
│   ├── Sign in
│   ├── MFA challenge
│   ├── Recovery / password reset
│   └── Session expired / access denied
├── Dashboard
│   ├── Operational summary
│   ├── My queues
│   └── Platform health (authorized users only)
├── People & Access
│   ├── Users → User detail → Status / roles / sessions
│   ├── Administrators → Invitation / access review
│   ├── Roles & permissions
│   └── Organizations
├── Participants
│   ├── Farmers → Verification queue → Farmer detail → Farms/listings/orders
│   └── Buyers → Buyer detail → Orders/disputes
├── Catalog
│   ├── Categories
│   ├── Products → Varieties / translations
│   └── Units / conversions
├── Marketplace
│   ├── Listing moderation queue
│   ├── All listings → Listing detail
│   └── Cooperatives
├── Commerce
│   ├── Orders → Order detail / timeline
│   ├── Disputes → Case detail (A4)
│   ├── Payments / reconciliation (read-only until approved)
│   └── Certificates
├── Operations
│   ├── Farms / production
│   ├── Inventory lots / movements / reservations
│   ├── Warehouses / storage sites
│   └── Delivery exceptions (future Delivery module)
├── Governance
│   ├── Audit events
│   ├── Reports / exports (A6)
│   └── Access reviews (A6)
└── System
    ├── Health / version
    ├── Jobs / integrations (future)
    └── Feature activation (future, restricted)
```

Every list page follows the same operational pattern:

1. URL-addressable filters and saved view later;
2. server-side pagination and sort;
3. permission-aware columns and PII redaction;
4. row → detail route;
5. immutable timeline/activity panel;
6. explicit command dialog with reason and confirmation;
7. request ID and authoritative result.

Pages render an **unauthorized absence**, not a misleading zero. For example, a user without `payments.read` does not receive or display payment totals.

### 6.5 Commodity extension host

Generic list/detail views display core category/product/unit fields. Optional family-specific panels are registered:

```text
AdminListingDetail
  ├── ListingCore
  ├── SellerAndOrigin
  ├── InventoryBinding
  └── ExtensionHost
        └── registry[categoryCode] → CoffeeAdminPanel | future panels | null
```

The registry is for presentation only. Domain validation remains in the API.

---

## 7. Backend architecture

### 7.1 Route namespace

Reserve `/api/v1/admin/*` for admin-specific contracts:

```text
GET    /admin/dashboard
GET    /admin/users
GET    /admin/users/:id
POST   /admin/users/:id/status-transitions
PUT    /admin/users/:id/roles
GET    /admin/farmers
POST   /admin/farmers/:id/verification-decisions
GET    /admin/catalog/categories
POST   /admin/catalog/products/:id/status-transitions
GET    /admin/listings
POST   /admin/listings/:id/moderation-decisions
GET    /admin/orders
GET    /admin/orders/:id
POST   /admin/orders/:id/status-transitions
GET    /admin/audit-events
```

Exact endpoints are finalized per implementation slice. Prefer action resources (`verification-decisions`, `status-transitions`) over unbounded `PATCH` payloads for sensitive state changes.

### 7.2 Module ownership

```text
src/
  admin/
    admin.module.ts
    dashboard/                 # cross-domain read projection only
  audit/
    audit.module.ts
    audit.service.ts
  common/authz/
    permissions.decorator.ts
    permissions.guard.ts
    admin-session.guard.ts
  identity/admin-*.controller.ts
  catalog/admin-*.controller.ts
  marketplace/admin-*.controller.ts
  orders/admin-*.controller.ts
  farms/admin-*.controller.ts
  inventory/admin-*.controller.ts
  warehouse/admin-*.controller.ts
  certificates/admin-*.controller.ts
```

The top-level `AdminModule` owns only cross-domain dashboard/read orchestration and shared registration. Domain-specific controllers stay near their domain services.

### 7.3 Complete module breakdown

#### Backend/platform modules

| Module | Admin responsibilities | Must not do |
|---|---|---|
| Admin | Compose dashboard sections, register admin routes, expose capability metadata | Own users, listings, orders, stock, or payments |
| Identity | Workforce invitation, password/MFA login, session rotation/revocation, user status, role grants, organization membership | Allow Farmer/Buyer self-registration to grant workforce roles |
| Authorization (`common/authz`) | Resolve effective permissions/scopes, enforce deny-by-default, expose current capabilities | Encode domain state transitions |
| Audit | Append/search immutable admin and security events, redact payloads, enforce retention interface | Replace diagnostic logs or domain ledgers |
| Catalog | Admin category/product/variety/unit queries and controlled activation/configuration | Embed coffee-only assumptions or mutate listings |
| Marketplace | Farmer/cooperative review, listing moderation, seller/listing search | Edit inventory balances or order/payment state |
| Farms | Farm/party/plot/cycle/harvest/activity administrative views and later governed interventions | Reimplement Marketplace seller identity |
| Inventory | Lots, movements, reservations, traceability; approved adjustment commands later | Directly overwrite balances |
| Warehouse | Sites, zones, parties, stock-location visibility | Own shipment/carrier lifecycle |
| Orders | Global order query, timeline, allowed transition policy, dispute handoff | Fabricate payment success or dispatch evidence |
| Payments | Provider/reconciliation/refund/payout contracts when separately approved | Treat simulated payment as settled money |
| Certificates | Search/verify and governed reissue/revoke later | Mutate historical provenance silently |
| Uploads/Evidence | Secure evidence/object references for A4 cases later | Keep sensitive dispute evidence in public listing-photo storage |
| Delivery (future) | Shipment, dispatch, carrier, tracking, proof-of-delivery, delivery exceptions | Become generic Admin or rewrite Orders/Inventory |
| Advisory/AI (future admin surface) | Diagnostics/configuration under separate permissions | Execute privileged changes without normal audit/approval |
| Health/Telemetry | Readiness, version, dependency status, operational metrics | Expose secrets or unrestricted infrastructure controls |

#### Admin Web modules

| Frontend module | Responsibility |
|---|---|
| App shell | Authenticated layout, navigation, breadcrumbs, global search entry, environment marker |
| Auth | Sign-in, MFA challenge, recovery, re-authentication, session expiry |
| Access | Users, administrators, roles, permissions, organizations, sessions |
| Participants | Farmer verification and Buyer/Farmer operational profiles |
| Catalog | Categories, products, varieties, units, translations, activation |
| Marketplace | Listing/cooperative search, detail, moderation queues |
| Commerce | Orders, timeline, disputes, payment read views, certificates |
| Operations | Farms, production, inventory, reservations, warehouses, future Delivery |
| Governance | Audit search, reports/exports, access review |
| System | Health/version/feature capability views |
| Shared data table | URL filters, pagination, sorting, redaction, loading/error/empty states |
| Shared command dialog | Reason, expected version, confirmation, re-auth where required |
| Extension host | Optional category-specific read panels; never domain validation |

Modules register four things when applicable: **routes, permissions, navigation entries, and dashboard contributors**. This allows future Delivery, Finance, and AI modules to plug into the portal without modifying a central monolithic page.

### 7.4 Contract rules

All collection endpoints:

- server-side pagination; cursor pagination preferred for high-growth event/order tables;
- explicit sort allowlists;
- typed filters with date ranges;
- bounded page size (default 25, maximum 100);
- summary DTOs separate from detail DTOs;
- stable IDs and UTC ISO timestamps;
- no secrets, OTP codes, password hashes, recovery codes, or raw provider credentials.

All privileged command endpoints:

- require a specific permission;
- require a human-readable reason for moderation, status, access, inventory, or financial-impact actions;
- accept an idempotency key for retry-sensitive commands;
- use optimistic concurrency (`expectedVersion` or `If-Match`) for contested records;
- validate allowed transitions in the owning domain;
- emit a request/correlation ID;
- append an audit event including success or denial;
- return the updated authoritative representation.

### 7.5 Dashboard read model

`GET /admin/dashboard` is a role-aware aggregation over existing sources, not a second ledger:

```text
identity      users awaiting review / suspended accounts
marketplace   unverified farmers / listings requiring action
orders        open orders / disputes / stalled states
inventory     reservation anomalies (later)
system        API health / version / recent failure count (later)
```

Compute live first with bounded queries and short private caching (for example 30–60 seconds). Add materialized projections only after staging measurements show a need.

#### Dashboard layout

```text
Header
  Environment · asOf · organization/region/category/date scope · refresh

Priority strip
  My assigned cases · overdue actions · security alerts

Role-aware KPI row
  Pending farmer reviews · moderation queue · open/stalled orders
  disputes · payment attention · inventory anomalies

Operational queues
  Queue name · age/SLA · severity · owner · next action

Trends (later)
  Volume by category/product/region/status; no unauthorized financial totals

System status
  API/database/dependency health and deployed version (restricted)
```

#### Initial dashboard contributors

| Contributor | Metrics/queues | Drill-down |
|---|---|---|
| Identity | active/suspended users, expiring invitations, locked admin sessions | filtered Users/Administrators |
| Marketplace | pending farmer verifications, listings requiring moderation | verification/moderation queue |
| Orders | open by status, disputed, stalled beyond policy window | Orders/Disputes |
| Payments | simulated/payment-attention count; provider state later | Payments (authorized only) |
| Inventory | reservation mismatch or negative-availability signals later | Inventory anomalies |
| Audit/Security | recent denied high-risk actions, lockouts | Audit filtered view |
| Delivery (future) | delayed/unassigned/failed delivery exceptions | Delivery queue |
| System | dependency health and release version | System Health |

Dashboard rules:

- each module computes its own section contract; Admin only composes;
- every number has a documented definition, scope, `asOf`, and drill-down query;
- unauthorized sections are omitted rather than returned as zero;
- financial values are permission-gated and hidden by default;
- no dashboard card creates a second transactional source;
- queue age/SLA is computed from authoritative timestamps and policy configuration;
- cross-region/organization totals require matching scope permission.

---

## 8. Identity, authentication, and authorization

### 8.1 Separate workforce login

Farmer/Buyer OTP registration accepts only `FARMER` and `BUYER`; preserve that boundary. Administrators are provisioned through an invite or break-glass bootstrap process.

Recommended admin login:

1. invited, active Identity user with an approved workforce role;
2. password credential using a modern password hash;
3. mandatory TOTP MFA for all admin roles;
4. short-lived access token (about 15 minutes);
5. rotating, revocable refresh session stored server-side;
6. Admin Web stores session material only in Secure, HttpOnly, SameSite cookies;
7. re-authentication for high-risk access/role changes;
8. account lockout and security-event audit.

SMS OTP alone is not sufficient as the only factor for privileged production access.

#### Authentication lifecycle

```text
SUPER_ADMIN / authorized inviter
  → creates time-limited invitation for an existing/new Identity user
  → recipient sets password
  → recipient enrolls TOTP and confirms recovery method
  → invitation is consumed once

Sign in
  → password check + account/status/lockout check
  → MFA challenge
  → short access token + rotating refresh session
  → BFF stores Secure HttpOnly cookies

Privileged request
  → CSRF/origin check at BFF
  → access token verified by Nest
  → session ACTIVE + user ACTIVE + authzVersion valid
  → permission + resource scope resolved
  → domain command/query

Role/status/MFA risk change
  → authzVersion increment
  → affected sessions revoked
  → audit/security event
```

Security parameters are configuration, not hard-coded policy. A1 design will finalize password hashing, access/refresh lifetimes, TOTP secret encryption, recovery-code hashing, failed-attempt thresholds, idle/absolute timeouts, and re-authentication windows.

Break-glass access:

- at least two separately held `SUPER_ADMIN` identities;
- no shared account;
- strongest MFA and short session;
- every use generates a high-severity security event;
- cannot be used for routine operations;
- recovery procedure documented and tested before production.

### 8.2 Authorization model

Use existing role → permission relations, with API enforcement:

```text
User
  └── UserRole
        └── Role
              └── RolePermission
                    └── Permission
```

Suggested workforce roles:

| Role | Intended scope |
|---|---|
| `SUPER_ADMIN` | Break-glass/bootstrap; very limited membership |
| `PLATFORM_ADMIN` | Broad operational administration |
| `OPERATIONS_AGENT` | Farmers, listings, orders; no access governance |
| `MARKETPLACE_MODERATOR` | Farmer verification and listing moderation |
| `CATALOG_MANAGER` | Categories, products, units, activation |
| `SUPPORT_AGENT` | User/order read and low-risk support actions |
| `FINANCE_REVIEWER` | Payment/settlement read; guarded financial actions later |
| `AUDITOR` | Read-only audit and operational views |

Suggested permission families:

```text
admin.dashboard.read
identity.users.read
identity.users.status.write
identity.roles.read
identity.roles.assign
identity.sessions.revoke
farms.read
farmers.verify
catalog.read
catalog.write
catalog.activate
marketplace.listings.read
marketplace.listings.moderate
orders.read
orders.transition
orders.disputes.manage
payments.read
inventory.read
inventory.adjust
certificates.read
certificates.reissue
audit.read
system.health.read
```

Permissions are checked server-side on every request. The JWT should not be trusted as a week-long snapshot of authorization. Use a short token plus session/authz version and re-resolve effective permissions with a small cache.

#### Proposed role-to-permission bundles

`R` = read, `W` = controlled write/decision, `A` = role/access administration, `—` = not granted by default.

| Capability family | Super Admin | Platform Admin | Ops Agent | Marketplace Moderator | Catalog Manager | Support Agent | Finance Reviewer | Auditor |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Dashboard | R | R | R | R | R | R | R | R |
| Users / organizations | A | A | R/W status | R | R | R | R | R |
| Roles / sessions / MFA | A | A | — | — | — | — | — | R |
| Farmer verification | W | W | W | W | R | R | R | R |
| Catalog configuration | W | W | R | R | W | R | R | R |
| Listing moderation | W | W | W | W | R | R | R | R |
| Orders / disputes | W | W | W | R | R | R/W cases | R | R |
| Payment visibility | R/W later | R/W later | R masked | R masked | — | R masked | R | R masked |
| Inventory / warehouse | W later | W later | R | R | R | R | R | R |
| Certificates | W later | W later | R | R | R | R | R | R |
| Audit events | R | R | own/domain | own/domain | own/domain | own/domain | own/domain | R |
| System health | R | R | R | R | R | R | R | R |
| Exports | W | W | permission-specific | permission-specific | permission-specific | permission-specific | permission-specific | permission-specific |

This matrix is a proposed default bundle, not hard-coded authorization logic. Permissions remain atomic and roles remain configurable. `SUPER_ADMIN` and `PLATFORM_ADMIN` differ: the former controls bootstrap/break-glass administration; the latter performs broad platform operations but cannot change break-glass policy or grant powers it does not hold.

High-risk permissions are separated from normal reads:

- role grant/revoke;
- user suspension/reactivation;
- catalog/category activation;
- manual order transition;
- inventory adjustment;
- certificate reissue/revocation;
- payment refund/payout/release;
- bulk export of PII.

The last four are not granted for execution until their domain phase is approved.

### 8.3 Scope and data protection

The authorization layer must support:

- global platform scope initially;
- organization/region scope later without changing permission names;
- PII field masking based on permission;
- export-specific permission and audit;
- user status checks (`ACTIVE`) and immediate session revocation;
- no self-escalation: users cannot grant a role/permission they do not control;
- protection against removing the final active break-glass administrator.

#### Scope model for organizations and regions

Authorization is **RBAC plus scope**, not full attribute-based access control:

```text
EffectiveGrant = {
  roleCode,
  permissionCodes[],
  scope: GLOBAL
       | ORGANIZATION:<organizationId>
       | REGION:<stableRegionCode>
}
```

A1 may ship global grants only, while service interfaces already accept an authorization context. Later scoped-grant storage is additive. Domain services resolve each resource's organization/region and enforce intersection with the caller's grants. Category/product filters are data filters, not authorization scopes unless a future policy explicitly makes them so.

This approach avoids two extremes: global-only roles that cannot scale to regional operations, and a premature general policy language that would be difficult to test and govern.

---

## 9. Data architecture and migration recommendation

### 9.1 Reuse existing data

No admin-owned copies of users, farmers, buyers, farms, catalog records, listings, orders, lots, or certificates.

Existing Identity role/permission tables should become active authorization infrastructure rather than being replaced.

### 9.2 Database additions recommended for A1

Database work **is needed** for a production-ready foundation:

| Schema / table | Purpose |
|---|---|
| `identity.admin_invitations` | Invite-only workforce onboarding, expiry, inviter, accepted state |
| `identity.mfa_factors` | TOTP factor metadata; encrypted secret reference; recovery state |
| `identity.admin_sessions` | Rotating refresh-token hash, device metadata, expiry, revoke reason |
| `identity.users.authz_version` (or equivalent) | Invalidate stale authorization after role/status changes |
| `audit.events` | Append-only privileged activity and security events |

Possible later operations tables, only when their workflows are approved:

- `operations.cases` / `case_events` for disputes and support;
- `operations.comments` for internal notes with strict PII controls;
- `operations.approvals` for maker-checker actions;
- asynchronous export/job records.

### 9.3 Audit event minimum shape

```text
id
occurred_at
actor_user_id
actor_session_id
permission_code
action
target_type
target_id
request_id
reason
outcome
before_json          redacted
after_json           redacted
ip / user_agent      retained under policy
metadata_json
```

Audit is append-only. Do not store access tokens, OTPs, passwords, TOTP secrets, recovery codes, full payment credentials, or unnecessary sensitive PII in audit JSON.

### 9.4 Transaction and retention rules

- Privileged domain mutation and audit event should commit in one PostgreSQL transaction where possible.
- Audit events are never cascade-deleted with business records.
- Define retention and export policy before production.
- Database grants should prevent application-level update/delete of audit events except a separately governed retention process.
- Continue SQL-first migrations, then map Prisma; do not use Prisma migrations against an already SQL-managed environment.

### 9.5 Migration hygiene before A1 SQL

Admin schema work must not rely on the current generic recursive filename sort alone. Existing scripts can apply cross-schema migrations out of dependency order (for example farms before marketplace cooperatives, or inventory before warehouse prerequisites). Before or as part of A1:

1. establish a deterministic migration order (manifest or dependency-aware apply script);
2. record applied migrations with checksums;
3. keep staging apply/replay documented and repeatable.

This is platform infrastructure enabling A1 safely, not a reason to invent a second admin database.

### 9.6 Auditing and logging architecture

Four records serve different purposes:

| Record | Purpose | Examples | Mutability |
|---|---|---|---|
| Domain history | Business truth inside owning module | inventory movement, order transition, farm audit | Domain-defined; usually append-oriented |
| Admin audit event | Accountability for privileged intent and outcome | farmer verified, role granted, listing rejected | Append-only |
| Security event | Authentication/authorization risk | login failure, MFA reset, denied grant, session revoked | Append-only/high-retention policy |
| Application telemetry | Diagnosis and performance | request latency, stack trace, dependency timeout | Operational retention; never compliance truth |

#### End-to-end correlation

```text
Browser action
  requestId + idempotencyKey
    → Admin Web structured log (no secrets)
    → Nest request context
    → permission decision
    → domain transaction
    → domain history + audit.events
    → response containing requestId
```

Audit taxonomy:

- `auth.*` — invitation, login, MFA, recovery, logout, lockout;
- `identity.*` — status, role, organization, session;
- `farmer.*` — verification decisions;
- `catalog.*` — create/update/activate/deactivate;
- `marketplace.*` — moderation and overrides;
- `orders.*` — transition, dispute assignment/resolution;
- `payments.*` — reconciliation/refund/payout later;
- `inventory.*` — adjustment/release later;
- `certificates.*` — reissue/revoke later;
- `system.*` — export, configuration, break-glass.

Read auditing is selective: audit access to sensitive profile/payment details, PII exports, evidence downloads, and audit-log exports. Logging every ordinary table view would create noise and cost without improving accountability.

Audit viewer behavior:

- filters by actor, action, target, outcome, date, organization/region, request ID;
- actor and target links respect current permissions;
- before/after diff is field-allowlisted and redacted;
- audit records cannot be edited from the portal;
- export requires a separate permission and creates its own audit event.

Retention periods, legal hold, IP treatment, and PII minimization are policy decisions finalized before production.

---

## 10. Domain integration map

| Existing module | Admin responsibility | Source of truth | First write capability |
|---|---|---|---|
| Identity | users, status, roles, sessions, organizations | `identity.*` | suspend/reactivate, assign approved roles, revoke session |
| Farmer/Marketplace profile | verification, cooperative linkage | `marketplace.farmer_profiles` | verification decision |
| Farms | farm/party/hierarchy inspection | `farms.*` | read-only initially |
| Catalog | categories, products, units, varieties | `catalog.*` | create/edit/activate through Catalog service |
| Marketplace | listing search and moderation | `marketplace.listings` | withdraw/reject/suspend via explicit transition |
| Orders | lifecycle, dispute queue, trace | `orders.orders` | policy-controlled transition only |
| Payments | references and status | Orders/Payments provider adapter | read-only until real provider phase |
| Inventory | lots, movements, reservations | `inventory.*` ledger | read-only; adjustments require separate approval |
| Warehouse | sites and stock location | `warehouse.*` | read-only initially |
| Certificates | origin/traceability documents | `orders.origin_certificates` | read-only; reissue later |
| Advisory | service diagnostics/config later | Advisory module | out of initial scope |

### Invariant examples

- Admin listing moderation cannot change inventory quantities.
- Admin order transition cannot bypass Orders state-machine rules or fabricate payment.
- Catalog deactivation cannot silently invalidate historical listings/orders.
- User suspension revokes admin and mobile sessions but preserves historical records.
- Farmer verification is distinct from farm status and listing status.
- Inventory adjustments remain ledger movements, never direct balance edits.

---

## 11. Operational workflows

### 11.1 Farmer verification

```text
Queue → inspect identity/profile/farms/documents when available
      → approve or reject with reason
      → Marketplace service updates verification state
      → audit event
      → optional notification later
```

Current boolean `verified` can support the first UI, but a richer status (`PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`) and decision history should be considered in that implementation design rather than overloading notes.

### 11.2 Listing moderation

Use explicit moderation decisions and status transitions. Do not let an admin arbitrarily edit seller commercial data. If a correction is needed, return the listing to the seller or use a separately audited correction permission.

### 11.3 Account access changes

Role/status changes require:

- current effective permission;
- target-policy validation;
- reason;
- re-authentication for high-risk grants;
- authz version increment and session revocation;
- audit event;
- protection against self-escalation and loss of the last super-admin.

### 11.4 Orders and disputes

The portal first provides complete timelines and evidence. Any manual transition must use the Orders state machine. Dispute case records and refunds are separate later slices; they should not be simulated with free-form order status changes.

A4 should align with the draft Transaction Protection Policy requirements already captured for support operations:

- dispute/support case queue with assignment and status;
- complete order timeline;
- payment references and evidence attachments;
- buyer/seller communications history when available;
- documented resolution with administrator identity, timestamp, rationale, and evidence references;
- refund or seller-payout release only after real payment infrastructure is approved;
- fraud/audit visibility for suspicious patterns.

Current platform reality: either party can flag `DISPUTED`, but no admin case, evidence, SLA, or resolution model exists yet. A4 designs those entities; A0 only reserves the architecture slot.

Logistics transitions (`CONFIRMED`, `SHIPPED`, `DELIVERED`) remain reserved for Delivery. Admin Operations may inspect and intervene under policy, but Delivery owns dispatch/routing when that product is designed.

### 11.5 Catalog activation

```text
Draft/inactive category or product
  → validate stable code, translations, default unit, varieties/attributes
  → preview dependent Farmer/Buyer/Admin presentation
  → authorized activation with reason
  → Catalog service transition + audit
  → clients discover through existing active-catalog APIs
```

Deactivation must preserve historical listing/order/certificate references. It stops new use; it does not rewrite history. Activating a category does not automatically authorize marketplace sell-through—commodity readiness, listing validation, Farmer form, Buyer facets, and certificate behavior must pass a separate activation checklist.

### 11.6 Inventory intervention

A5 begins read-only. A later adjustment flow must create an Inventory movement (`ADJUST_IN`, `ADJUST_OUT`, release, relocation, etc.) with reason, source reference, permission, expected version, and audit event. Direct quantity editing is prohibited.

### 11.7 Delivery exception handoff

When Delivery exists:

```text
Delivery exception queue
  → inspect order + shipment + dispatch movement + tracking/proof
  → assign/escalate under Delivery policy
  → Delivery service command
  → order/inventory effects through their owned interfaces
  → correlated audit trail
```

Admin may coordinate the exception; it does not become the shipment state machine.

---

## 12. Security architecture

### 12.1 Required controls before privileged writes

- invite-only admin provisioning;
- mandatory MFA;
- permission guard with deny-by-default;
- short sessions and revocation;
- strict production CORS allowlist;
- Secure/HttpOnly/SameSite cookies and CSRF protection at the BFF;
- rate limits stricter than public mobile defaults for auth endpoints;
- security headers and Content Security Policy;
- input allowlists, output redaction, and bounded queries;
- audit trail and request IDs;
- secrets only in environment/secret manager;
- no staging universal OTP accepted by admin login;
- dependency, static analysis, and secret scanning in CI.

### 12.2 Threats addressed

| Threat | Primary mitigation |
|---|---|
| Stolen browser token | HttpOnly cookie, short access token, rotating refresh session, MFA |
| Role escalation | permission guard, grant policy, re-auth, audit, no self-escalation |
| IDOR across records | endpoint permission + scope checks; never trust hidden UI |
| CSRF | SameSite cookies + CSRF token/origin validation |
| Stale suspended admin | status/authz version validation + session revocation |
| Mass data extraction | pagination caps, export permission, rate limit, audit |
| Unsafe direct state edits | command endpoints + domain transitions + optimistic concurrency |
| Audit tampering | append-only table and restricted DB grants |
| Sensitive log leakage | structured redaction and explicit audit allowlist |

Before production, run a dedicated security review of the implemented A1/A2 changes.

---

## 13. Reliability, observability, and performance

### 13.1 Observability

Add, incrementally:

- structured server logs with `requestId`, `actorId`, route, latency, result, and redaction;
- frontend and backend error reporting separated by environment;
- API latency/error metrics by route and module;
- authentication failure, lockout, role change, and session revocation security events;
- health/readiness endpoints that distinguish API process and database connectivity;
- deploy/version metadata visible to restricted admins.

Audit events are compliance history; application logs are diagnostic telemetry. They are not interchangeable.

### 13.2 Performance targets

Initial staging targets:

- common paginated list p95 under 500 ms with representative data;
- detail view p95 under 500 ms;
- dashboard p95 under 1 second;
- first useful portal render under 2.5 seconds on a typical office connection;
- all collection queries bounded and indexed from measured query plans.

Use server-side filtering/pagination. Do not fetch full user/listing/order tables into the browser. Add read replicas, search infrastructure, queues, or materialized views only after evidence.

### 13.3 Failure behavior

- Read panels fail independently where safe; the portal shell remains usable.
- Mutations never use optimistic UI as proof of success; refresh authoritative state.
- Retry only idempotent commands with the same idempotency key.
- Show request IDs in error details for support.
- Never silently fall back from a denied action to a direct update.

### 13.4 Scalability and extensibility

#### Additional commodities

- Catalog stable codes remain canonical; localized names are data.
- Generic tables and filters use category/product/variety/unit/quality.
- Commodity attributes render through registered extension panels.
- Dashboard contributors group by category/product without coffee-specific metrics.
- A new commodity activation is configuration + domain extension + validation, not new Admin navigation.
- A fully dynamic form/schema engine is deferred until attribute-definition tables become authoritative; premature dynamic UI would hide business rules and complicate validation.

#### Additional organizations and regions

- Existing Identity organizations are reused.
- Authorization context supports future global/organization/region grants.
- Queries always accept an enforced scope, not a client-trusted organization filter.
- Stable geography codes should replace free-text region scope when a Geography module is approved.
- Organization/region become consistent filter and aggregation dimensions.
- Large national views can later use read replicas/materialized projections without changing command ownership.

#### Additional platform modules

Every future module (Delivery, Finance, Compliance, AI, Notifications) may contribute:

```text
module manifest
  routes
  permission catalogue
  navigation nodes
  dashboard contributor
  audit action catalogue
  API contracts
```

The central shell composes these contributions but does not absorb their business rules.

#### Data and traffic growth

| Scale signal | First response | Later response if measured |
|---|---|---|
| Large lists | indexes, cursor pagination, projection DTOs | dedicated search index |
| Dashboard joins | bounded queries, short cache | materialized read models |
| Long-running exports | synchronous small export caps | job queue + object storage |
| Evidence/photos | private object storage, signed URLs | CDN/lifecycle policies |
| Read-heavy national reporting | optimized SQL/views | read replica/warehouse |
| API load | stateless horizontal API/web services | module extraction only at proven boundary |
| Cross-module events | same-DB transaction first | outbox/event bus when async consumers appear |

The modular monolith remains the default. A module is extracted only when independent scaling, deployment cadence, regulatory isolation, or team ownership outweighs distributed-system cost.

---

## 14. Testing strategy

| Layer | Required coverage |
|---|---|
| Authorization unit tests | role → permission matrix, status, scope, self-escalation, final super-admin |
| Domain rule tests | allowed/denied transitions and invariants |
| API integration tests | authentication, permission enforcement, pagination, redaction, audit atomicity |
| Database tests | migrations, constraints, append-only audit behavior, indexes |
| Frontend tests | permission-derived navigation, forms, tables, error/empty states |
| End-to-end | invite/login/MFA; farmer verify; listing moderate; user suspend; audit lookup |
| Security | IDOR, CSRF, session replay/revocation, privilege escalation, rate limits, secret/PII leakage |
| Accessibility | keyboard navigation, focus, labels, contrast, screen-reader semantics |
| Performance | representative list/dashboard data and query-plan checks |
| Regression | existing Farmer and Buyer staging journeys remain unchanged |

Every permission must have at least one allow test and one deny test.

---

## 15. Deployment topology

### Staging

```text
Railway project/environment: staging
  ├── Postgres (existing staging DB)
  ├── nahu-api (existing Nest API)
  └── nahu-admin (new Next.js service)
```

- Separate admin hostname.
- Admin Web calls the staging API; private Railway networking may be used server-to-server.
- Explicit API CORS allowlist.
- Staging workforce accounts only; no production data.
- Feature flag privileged modules until their validation step.
- Existing Farmer/Buyer staging clients continue using the same API contracts.

### Production

Production is a separate explicit future gate:

1. architecture approved;
2. each implementation slice reviewed and validated on staging;
3. security review and backup/rollback rehearsal complete;
4. production variables, domains, MFA bootstrap, audit retention, and CORS reviewed;
5. explicit user approval for production deployment.

This A0 decision does not authorize any production action.

---

## 16. Delivery roadmap using the established workflow

Milestone namespace for Admin Portal is **`A*`** (A0, A1, …). This is distinct from Buyer `B*` milestones and from any older backend track numbering in feature-mapping docs.

### A0 — Architecture (this document)

Architecture → Review → Approval. Stop before database or code.

### A1 — Security foundation and portal shell

- SQL: admin sessions, invitations/MFA, authz version, audit events;
- Prisma mappings;
- permission guard, admin auth/session APIs, audit service;
- Next.js shell, login/MFA, permission-derived navigation;
- health/dashboard skeleton;
- tests, docs, staging, validation, commit, PR, merge, tag.

Suggested tag: `milestone-admin-a1-foundation`.

### A2 — People and participant operations

- users, organizations, roles, session revocation;
- farmer/buyer detail;
- farmer verification workflow;
- account status controls.

### A3 — Catalog and Marketplace operations

- category/product/unit management;
- activation safety;
- listing search, detail, and moderation;
- cooperative administration as separately approved.

### A4 — Order and dispute operations

- order timelines and stuck-order queues;
- dispute case model;
- guarded lifecycle actions;
- payment-provider operations remain deferred unless separately approved.

### A5 — Farm, inventory, warehouse, and certificate visibility

- cross-module operational detail;
- anomaly queues;
- read-only first;
- ledger adjustments/reissue commands require specific approval.

### A6 — Reporting and operational hardening

- asynchronous exports;
- maker-checker approvals for high-risk actions;
- advanced observability, retention, and performance work;
- optional analytics projections based on measured demand.

Each phase repeats:

```text
Architecture/Design → User review → Explicit approval
→ Implementation (Database / API / Frontend as applicable)
→ Testing → Documentation → Staging deployment
→ User validation and feedback → Final fixes and revalidation (if needed)
→ Commit → PR → Merge → Tag → Next milestone design
```

There are two mandatory stops in every milestone:

1. after design/review, before implementation;
2. after staging deployment, before commit/PR/merge/tag.

No phase implicitly authorizes the next one. Production remains frozen until separately and
explicitly approved.

---

## 17. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Admin Portal becomes a generic CRUD bypass | Domain-owned command APIs; no browser/database access |
| `ADMIN` becomes an all-powerful shared role | granular permissions and workforce roles |
| Long-lived JWT preserves revoked rights | short access token, server session, authz version, revocation |
| Audit history is partial | shared audit service; privileged mutation + audit transaction |
| Dashboard duplicates domain truth | aggregation only; no second ledger |
| Cross-module admin module becomes monolithic | controllers and commands remain in owning domains |
| Coffee assumptions leak into operations | category/product/unit core + extension host |
| Large tables overload API/browser | bounded server pagination, filters, indexes |
| Manual order edits corrupt lifecycle | transition commands through Orders policy |
| Sensitive PII becomes widely visible | field-level redaction, export controls, audit |
| Admin release affects mobile clients | additive `/admin` namespace and mobile regression tests |
| Premature distributed architecture slows delivery | modular monolith until measured scaling boundary |
| Migrations apply out of dependency order | deterministic migration manifest + applied-migration ledger before A1 SQL |
| Dispute ops outrun payment reality | A4 case/timeline first; refund/payout only after Payments approval |
| Local container uploads block evidence scale | keep filesystem for current listing photos; move evidence/object storage before multi-instance production admin |

---

## 18. Success criteria

The architecture is successful when:

- administrators use invite-only MFA-backed identities;
- every portal route and API action is permission-controlled;
- privileged mutations are domain-valid and auditable;
- Farmer and Buyer contracts remain unchanged;
- all lists are searchable, filtered, paginated, and redaction-aware;
- the dashboard is a read projection, not a duplicate ledger;
- category/product/unit fields drive operations across commodities;
- Coffee-specific data appears only in an extension panel;
- staging validation covers security, operations, accessibility, and mobile regression;
- production remains untouched without explicit approval.

---

## 19. Rationale, trade-offs, and alternatives for the 11 approval decisions

### D1 — Separate `apps/admin-web` Next.js application

**Recommendation:** A distinct web application in the existing monorepo.

**Rationale:** Admin is desktop/data-dense, needs server rendering/BFF/session controls, and has a different release/security boundary from Expo clients. Turborepo already supports another app while retaining one repository and CI graph.

**Trade-off:** Adds a separately deployed web service and frontend stack.

**Alternatives considered:**

- **Add admin screens to Expo:** rejected for data-dense desktop operations, browser security, accessibility, and independent release needs.
- **Embed server-rendered views in Nest:** simpler deployment but couples UI/backend release and gives up the mature React/Next operations ecosystem.
- **Separate repository:** stronger isolation but creates avoidable contract/tooling drift at the current team/scale.

### D2 — Same-origin BFF with secure HttpOnly sessions; no Next.js database access

**Recommendation:** Browser talks to Next.js same-origin handlers; the BFF calls Nest. Session material stays in Secure, HttpOnly, SameSite cookies.

**Rationale:** Reduces token exposure to browser JavaScript, centralizes CSRF/origin handling, permits private server-to-server API networking, and keeps one API authority.

**Trade-off:** One additional network hop and BFF operational code.

**Alternatives considered:**

- **SPA calls Nest with bearer token in local storage:** simpler but materially increases token-theft exposure.
- **Next.js accesses PostgreSQL directly:** lower read latency but bypasses domain rules, authorization, audit, and API ownership.
- **Cookie directly on Nest API:** viable, but complicates cross-origin deployment and tightly couples public mobile and admin browser auth concerns.

### D3 — Nest remains business authority through `/api/v1/admin/*`

**Recommendation:** Add versioned, explicit admin contracts to the existing Nest platform.

**Rationale:** Reuses current domain services and transactions, keeps mobile compatibility additive, and avoids a second backend with competing truth.

**Trade-off:** Nest modules gain admin-specific DTOs/controllers and must handle more query shapes.

**Alternatives considered:**

- **New admin microservice:** creates distributed authorization, transactions, and data ownership before scale justifies it.
- **GraphQL first:** flexible for tables but adds a second API paradigm, authorization surface, and caching complexity without a demonstrated need.
- **Generic database admin API:** fast initially but unsafe and impossible to govern as business workflows.

### D4 — Domain modules own mutations; Admin owns orchestration/read composition only

**Recommendation:** Identity, Catalog, Marketplace, Orders, Inventory, and future Delivery implement their own admin commands. `AdminModule` composes dashboard/read projections and module registration.

**Rationale:** Business invariants stay next to their source of truth; teams can evolve modules without a god-service.

**Trade-off:** More controllers/facades and deliberate cross-module interfaces.

**Alternatives considered:**

- **Central AdminService with raw Prisma access:** fewer files but duplicates rules and becomes a high-risk monolith.
- **Frontend orchestrates multiple writes:** cannot guarantee transactionality or audit completeness.
- **Event-only commands:** useful later for async work, but unnecessary complexity for current synchronous operations.

### D5 — Invite-only workforce authentication with mandatory MFA

**Recommendation:** Separate workforce provisioning, password + TOTP MFA, revocable sessions, and break-glass controls.

**Rationale:** Admin access is a privileged employment/contractor relationship, not public marketplace registration. SMS OTP alone is vulnerable to SIM-swap and staging bypass must never unlock admin.

**Trade-off:** MFA enrollment/recovery and support procedures add product and operational work.

**Alternatives considered:**

- **Reuse Farmer/Buyer OTP:** insufficient assurance and mixes trust boundaries.
- **Password only:** inadequate for privileged access.
- **Enterprise SSO immediately:** strongest centralized lifecycle when available, but no current identity-provider requirement/infrastructure. Architecture leaves an OIDC/SAML adapter path later.
- **Passkeys first:** strong option later; cross-device recovery/support readiness should be proven before making it the sole A1 method.

### D6 — Existing permission model enforced deny-by-default

**Recommendation:** Activate atomic permissions and role bundles, with resource scope support; never rely on an `ADMIN` string alone.

**Rationale:** Operations, support, catalog, finance, and audit duties differ. Existing tables provide a foundation, and API enforcement protects every client.

**Trade-off:** Permission catalogue, seed governance, tests, and UI capability handling require discipline.

**Alternatives considered:**

- **Single ADMIN role:** simple but violates least privilege and segregation of duties.
- **Hard-coded role checks:** becomes brittle as teams/regions grow.
- **Full ABAC/policy language now:** powerful but overly complex to explain, test, and administer. RBAC + explicit scope covers the foreseeable need.

### D7 — A1 additive session/MFA/invitation data and append-only `audit.events`

**Recommendation:** Persist revocable sessions and workforce lifecycle state; create a platform audit schema before privileged operations.

**Rationale:** Stateless seven-day JWTs cannot immediately revoke access or reflect permission changes. Farm-only audit is incomplete for identity, marketplace, orders, and security actions.

**Trade-off:** SQL migrations, secret protection, retention policy, and additional transactional writes.

**Alternatives considered:**

- **Short JWT only, no session table:** reduces schema but loses rotation, device/session visibility, and targeted revocation.
- **Application logs as audit:** logs are mutable/retained for diagnostics and lack business before/after semantics.
- **External IAM/audit vendor immediately:** may be appropriate later, but still requires domain audit and introduces cost/vendor dependency before requirements stabilize.

### D8 — A1 limited to security foundation and portal shell

**Recommendation:** Build auth, authorization, audit, shell, capability navigation, and a read-only dashboard skeleton before broad operations.

**Rationale:** Every later workflow depends on these controls; building CRUD first creates insecure endpoints and retrofit risk.

**Trade-off:** First staging slice demonstrates less business functionality.

**Alternatives considered:**

- **Vertical slice (for example farmer verification) first:** faster visible value, but either builds temporary security or expands A1 unpredictably.
- **Big-bang full portal:** long feedback cycle, difficult review, high migration and regression risk.
- **Read-only portal with current JWT:** useful prototype but not an acceptable foundation for privileged production evolution.

### D9 — Commodity-neutral Category → Product → Listing core with extension panels

**Recommendation:** Generic catalog/unit contracts drive tables, filters, workflows, and dashboard dimensions; commodity-specific attributes use registered panels.

**Rationale:** Matches approved G1/B1 direction and lets future cereals, honey, livestock, and others arrive without portal redesign.

**Trade-off:** Coffee data needs an extension panel and legacy compatibility adapters while schema transition continues.

**Alternatives considered:**

- **Coffee-first admin screens:** quicker today but repeats the coupling already removed from Buyer.
- **Fully dynamic schema/form engine now:** maximum flexibility but attribute definitions are not yet authoritative and critical validation would become opaque.
- **Separate portal per commodity:** duplicates identity, orders, audit, and operations.

### D10 — Inventory and payment actions begin read-only

**Recommendation:** Visibility first; inventory adjustments, refunds, payouts, settlement release, and certificate reissue require separately approved designs and permissions.

**Rationale:** Inventory is a physical ledger and current payments are simulated. Premature buttons could corrupt stock or imply movement of real funds.

**Trade-off:** Some early operational exceptions still require controlled engineering/database support rather than portal action.

**Alternatives considered:**

- **Generic admin override:** operationally convenient but bypasses ledgers and makes reconciliation impossible.
- **Immediate full finance/WMS tooling:** expands Admin into unapproved Payment, Warehouse, and Delivery products.
- **Hide these domains entirely:** loses valuable traceability and support visibility; read-only is the safer middle path.

### D11 — Staging-first; production remains separately approved

**Recommendation:** Complete each slice through tests, documentation, staging, validation, commit, PR, merge, and tag; production requires an additional explicit gate.

**Rationale:** Admin has the platform's highest-impact permissions. Staging must prove IAM, migration replay, audit, domain invariants, Farmer/Buyer regression, backup/rollback, and operational procedures.

**Trade-off:** Slower time to production and environment-management overhead.

**Alternatives considered:**

- **Direct production behind feature flag:** still deploys schema/security code without full operational validation.
- **Architecture approval implicitly authorizes implementation/production:** conflicts with the established phase-gated workflow.
- **Permanent staging-only tool:** avoids production risk but cannot become the operational backbone.

---

## 20. A0 approval checklist

Approved on **2026-07-19**. The 11 decisions are locked:

1. [x] Admin Portal is a separate `apps/admin-web` Next.js application in `nahu-platform`.
2. [x] Browser uses a same-origin BFF and secure HttpOnly sessions; Next.js never accesses PostgreSQL.
3. [x] Nest remains the business authority through dedicated `/api/v1/admin/*` contracts.
4. [x] Domain modules own admin mutations; `AdminModule` is limited to shared registration and cross-domain read projections.
5. [x] Workforce authentication is invite-only with mandatory MFA; Farmer/Buyer self-registration cannot grant admin access.
6. [x] Existing Identity permissions become the runtime authorization model; deny by default, with additive organization/region scopes.
7. [x] A1 includes additive Identity session/MFA/invitation data and append-only `audit.events`.
8. [x] A1 privileged actions are limited to security foundation and shell; broader operations arrive in A2+ slices.
9. [x] Portal core is Category → Product → Listing with unit-aware quantities/prices and optional commodity extension panels.
10. [x] Inventory and payment operations begin read-only; adjustments/refunds need separate approval.
11. [x] Staging first; production remains unchanged until explicitly approved.

**Milestone convention (not a separate architecture decision):** suggested A1 tag `milestone-admin-a1-foundation`.

**Next:** detailed A1 design (`docs/07-decisions/a1-admin-portal-foundation-design.md`) — stop again for review/approval before SQL or implementation.

---

## 21. Repository evidence

- `apps/api/src/app.module.ts` — current Nest modular-monolith composition.
- `apps/api/src/common/guards/roles.guard.ts` — current single-role enforcement.
- `apps/api/src/identity/identity.service.ts` — current OTP/JWT issuance.
- `apps/api/prisma/schema.prisma` — existing roles, permissions, organizations, domain models, and SQL-first mapping warning.
- `database/migrations/005_identity_permissions.sql` and `007_identity_role_permissions.sql` — existing permission foundation.
- `database/migrations/012_identity_seed_core_roles.sql` — current role seeds.
- `docs/07-decisions/commodity-generalization-architecture-review.md` — category/product/extension direction.
- `docs/07-decisions/b2-buyer-mobile-mvp-architecture.md` — G1/B1 contract and staging-first precedent.
- `docs/08-guides/staging-deploy.md` — Railway staging topology and production gate.
- `docs/business/Nahu_Transaction_Protection_Policy_v1.docx` — dispute/support operational requirements for later A4.
