# Nahu Platform — Engineering Playbook

**Version:** 1.0  
**Status:** Active  
**Audience:** Backend engineers, mobile engineers, DevOps, AI agents

---

## Purpose

This document defines how we build software on the Nahu Platform. It complements:

- [Architecture Principles](02-architecture/architecture-principles.md) — *why* we design this way
- [Business Model](business/nahu-platform-business-model.md) — *what* we are building
- [Contributing Guide](../CONTRIBUTING.md) — *how to submit changes*
- [API README](../apps/api/README.md) — endpoint catalog and package history

When this playbook and another document conflict, the more specific document wins for its domain (e.g. API README for route details, Users Entity spec for Identity fields).

---

## Documentation-first workflow

Before writing or modifying code, consult the relevant documentation:

| Priority | Folder | Status | Contents |
|----------|--------|--------|----------|
| 1 | `docs/business/` | Active | Business model, actors |
| 2 | `docs/02-architecture/` | Active | Architecture principles |
| 3 | `docs/03-domain-model/` | Active | Entity specifications |
| 4 | `docs/04-requirements/` | Planned | Feature requirements |
| 5 | `docs/05-api/` | Planned | OpenAPI, error catalog |
| 6 | `docs/06-database/` | Planned | Detailed schema docs |
| 7 | `docs/07-decisions/` | Planned | Architecture decision records |
| 8 | `docs/08-guides/` | Planned | How-to guides |

Never contradict documented architecture without explaining why in the PR and, for significant decisions, adding an ADR to `docs/07-decisions/`.

---

## Monorepo conventions

### Tooling

| Tool | Role |
|------|------|
| **pnpm** | Package manager (workspaces) |
| **Turborepo** | Task orchestration (`dev`, `build`, `lint`, `test`) |
| **Prettier** | Formatting (root `pnpm format`) |

### Workspace layout

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

| Package | Name | Description |
|---------|------|-------------|
| `apps/api` | `@nahu-platform/api` | NestJS REST API |
| `packages/*` | `@nahu-platform/*` | Shared libraries (future) |

### Naming

- **Packages:** `@nahu-platform/<name>` (scoped, lowercase)
- **NestJS modules:** `<domain>.module.ts` matching business capability
- **Database schemas:** `identity`, `marketplace`, `orders` (lowercase, singular concept)
- **Migration files:** `<sequence>_<schema>_<description>.sql` (e.g. `004_marketplace_listings.sql`)

### Running tasks

```bash
# All packages
pnpm dev
pnpm build

# Single package
pnpm --filter @nahu-platform/api dev
pnpm --filter @nahu-platform/api build
```

---

## Backend architecture

### Stack

- **Framework:** NestJS 10
- **ORM:** Prisma 5 (schema mapping only — not migration authority)
- **Validation:** `class-validator` + global `ValidationPipe`
- **Auth:** JWT Bearer tokens, phone OTP via Africa's Talking SMS

### Module structure

Each business capability is a NestJS module:

```
apps/api/src/<module>/
├── <module>.module.ts
├── <module>.controller.ts    # Thin — routing and guards only
├── <module>.service.ts       # Business logic lives here
└── dto/                      # Request/response validation
```

**Current modules:** `health`, `identity`, `marketplace`, `orders`, `certificates`, `advisory`

### Coding rules

| Rule | Detail |
|------|--------|
| Thin controllers | Delegate to services; no business logic in controllers |
| Global modules | `PrismaModule`, `JwtConfigModule` are `@Global()` — inject anywhere |
| Guards | `JwtAuthGuard` for auth; `RolesGuard` + `@Roles()` for authorization |
| DTOs | Every request body and query object gets a validated DTO class |
| Errors | Throw NestJS `HttpException` subclasses (`BadRequestException`, etc.) |

### Bootstrap (`main.ts`)

- Global prefix: `/api/v1` (health excluded at `/health`)
- Global `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform`
- Global `MobileCompatExceptionFilter`: reshapes errors to `{ error: "message" }`
- CORS enabled

---

## Database

### SQL-first migrations

**The source of truth for schema changes is SQL files in `database/migrations/`.**

Prisma's `schema.prisma` maps existing tables — it does not drive migrations.

```
database/migrations/
├── 001_identity_schema.sql          # identity schema
├── 002_identity_users.sql
├── ...
├── marketplace/
│   ├── 001_marketplace_schema.sql
│   └── ...
└── orders/
    ├── 001_orders_schema.sql
    └── ...
```

### Rules

| Do | Don't |
|----|-------|
| Add new `.sql` migration files in order | Run `prisma migrate dev` on a DB with existing SQL migrations |
| Update `schema.prisma` to match new tables/columns | Modify production schema without a migration file |
| Document rationale in migration file header comments | Delete or rename applied migration files |
| Apply migrations manually via `psql` or a future tracking script | Assume Prisma will create tables |

### After adding a migration

1. Apply the SQL file to your local database
2. Update `apps/api/prisma/schema.prisma` to reflect new tables/columns
3. Run `pnpm --filter @nahu-platform/api prisma:generate`
4. Verify `pnpm --filter @nahu-platform/api build` succeeds

### Schemas

| Schema | Module | Key tables |
|--------|--------|------------|
| `identity` | Identity | `users`, `roles`, `user_roles`, `otp_codes`, `organizations` |
| `marketplace` | Marketplace | `farmer_profiles`, `listings`, `cooperatives` |
| `orders` | Orders | `orders`, `origin_certificates` |

See [Data Dictionary](../database/docs/data-dictionary.md) for the full module map.

---

## API conventions

### URL structure

```
GET  /health                          # Unversioned health check
POST /api/v1/auth/request-otp         # Versioned API
GET  /api/v1/listings?page=1&limit=20
```

### Request format

- **Content-Type:** `application/json`
- **Auth:** `Authorization: Bearer <jwt>`
- **Field naming:** camelCase in JSON (`quantityKg`, `deliveryAddress`, `processMethod`)

### Response format

**Success:** Return the resource directly (no wrapper envelope in v1).

```json
{ "id": "...", "region": "ይርጋጨፌ", "pricePerKg": 250 }
```

**Listings pagination:**

```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 142, "pages": 8 }
}
```

**Errors (v1 — mobile compatible):**

```json
{ "error": "Human-readable error message" }
```

HTTP status code is in the response header only. Do not add `statusCode` to the body in v1 — mobile apps parse `error` as a string.

### Validation

Global pipe rejects unknown fields (`forbidNonWhitelisted`). All enums, bounds, and formats are validated in DTOs before reaching services.

### Backward compatibility

- Do not remove or rename v1 endpoints without a deprecation period
- Do not change error message substrings that mobile apps match (e.g. `"profile not found"`)
- Enum values use stable codes (`GRADE_1`, `WASHED`, `FARMER`) — not display labels

---

## Authentication

### Flow

```
1. POST /api/v1/auth/request-otp   { phone, role }
2. POST /api/v1/auth/verify-otp    { phone, otp }
3. → { token, user: { id, phone, role } }
4. Subsequent requests: Authorization: Bearer <token>
```

### Roles (seeded)

`FARMER`, `BUYER`, `ADMIN` — uppercase strings matching `identity.roles.code`.

### Guards

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FARMER')
@Post('listings')
```

### Dev mode

When `NODE_ENV !== production`:

- OTP `123456` verifies for any phone that requested an OTP
- `request-otp` returns `dev_otp` in the response
- Africa's Talking credentials are not required

In production, `AT_API_KEY` and `AT_USERNAME` are required. `dev_otp` is never returned.

---

## Mobile compatibility

The Expo apps (`nahu-buna-farmer`, `nahu-buna-buyer`) in the `nahu-buna-gebaya` repository consume this API. Every API change must consider mobile impact.

### Contract requirements

| Area | Convention |
|------|------------|
| Base URL | `/api/v1` |
| JSON fields | camelCase |
| Roles | Uppercase (`FARMER`, `BUYER`) |
| Error body | `{ error: "string" }` |
| Error matching | Mobile uses substring checks on `error` message |
| Listing grades | Enum codes (`GRADE_1`–`GRADE_9`), not display labels |
| Process methods | Enum codes (`WASHED`, `NATURAL`, etc.) |

### Before merging API changes

- [ ] Test against both Farmer and Buyer app flows
- [ ] Verify error messages still match mobile interceptor patterns
- [ ] Confirm camelCase field names in request and response
- [ ] Check enum values match mobile `constants.js` codes

---

## Environment variables

Configuration is loaded from `apps/api/.env` (see `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Must not be default in production |
| `JWT_EXPIRES_IN` | No | Default `7d` |
| `NODE_ENV` | No | `development` / `production` |
| `PORT` | No | Default `3000` |
| `AT_API_KEY` | Prod only | Africa's Talking SMS |
| `AT_USERNAME` | Prod only | Africa's Talking SMS |
| `ANTHROPIC_API_KEY` | For advisory | Claude API for `/advisory/*` |

Never commit `.env` files. Never commit secrets.

---

## Branching and releases

| Branch | Purpose |
|--------|---------|
| `main` | Stable, deployable |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |

### Release flow (target)

1. Feature branch → PR to `main`
2. CI passes (build, lint, test)
3. Deploy to staging
4. Mobile regression on staging
5. Deploy to production

CI runs on every push/PR to `main` (install → prisma generate → build). Lint and test jobs will be added when those tools are configured.

### Local database with Docker

```bash
docker compose up -d
```

Uses `docker-compose.yml` at the repo root. On first start, `database/docker/init-db.sh` applies every `*.sql` file under `database/migrations/` in sorted order. Set `DATABASE_URL` in `apps/api/.env` to:

```
postgresql://postgres:postgres@localhost:5432/nahu_platform
```

To reset the database: `docker compose down -v` then `docker compose up -d`.

---

## Testing

### Current state

No automated tests exist yet. Manual smoke testing is documented in `apps/api/README.md`.

### Target (Phase 1)

| Layer | Tool | Scope |
|-------|------|-------|
| API integration | Jest + Supertest | Auth, listings, orders lifecycle |
| Unit | Jest | Services with mocked Prisma |
| E2E mobile | Maestro / Detox | Login → order flow |

### Minimum before merging (once CI exists)

- `pnpm build` passes
- `pnpm lint` passes
- `pnpm test` passes
- New endpoints have at least one integration test

---

## Security

| Rule | Detail |
|------|--------|
| No secrets in git | Use `.env` locally; env vars in deployment |
| No default JWT secret in prod | App should fail startup if `JWT_SECRET` is unchanged |
| Rate limiting | Planned — OTP and auth endpoints (Phase 1) |
| Payment webhooks | User-callable `confirm-payment` must be replaced with signed webhooks (Phase 1) |
| Input validation | All inputs through DTOs; `forbidNonWhitelisted` globally |
| Audit log | Planned for sensitive actions (Phase 1) |

---

## Pull request checklist

Before requesting review:

- [ ] Read relevant docs (`business/`, `02-architecture/`, `03-domain-model/`)
- [ ] Business logic is in services, not controllers
- [ ] New endpoints have DTOs with validation
- [ ] Database changes include SQL migration + Prisma schema update
- [ ] Error responses use `{ error: "..." }` format
- [ ] Mobile compatibility considered (camelCase, enum codes, error strings)
- [ ] No secrets, `.env`, or compiled artifacts committed
- [ ] `pnpm build` succeeds locally
- [ ] Documentation updated if conventions or setup changed

---

## Major changes protocol

For architectural changes, new schemas, or breaking API changes:

1. **Explain** the proposed change and rationale
2. **Wait for approval** before implementing
3. **Document** the decision (ADR in `docs/07-decisions/` when that folder exists)
4. **Implement** in focused PRs

This applies to: new database schemas, API version bumps, auth model changes, and module restructuring.

---

## Related repositories

| Repository | Contents | Relationship |
|------------|----------|--------------|
| `nahu-platform` (this repo) | Backend API, migrations, docs | Canonical backend |
| `nahu-buna-gebaya` | Farmer app, Buyer app, legacy Express API | Mobile clients; Express being replaced |

---

## Roadmap reference

Engineering work is organized in five phases. This playbook supports **Phase 1 — Foundation**. See the platform roadmap for full phase breakdown:

| Phase | Focus |
|-------|-------|
| 1 — Foundation | CI/CD, security, shared mobile core, production cutover |
| 2 — Marketplace | Photos, Telebirr, notifications, offline |
| 3 — Enterprise | IAM, admin portal, cooperatives, multi-commodity |
| 4 — AI | Production advisory, market intelligence |
| 5 — National Platform | Government, logistics, finance, export |
