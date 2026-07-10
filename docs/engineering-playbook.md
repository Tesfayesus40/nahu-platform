# Nahu Platform — Engineering Playbook

**Version:** 1.0  
**Status:** Active  
**Audience:** Backend engineers, mobile engineers, and AI coding agents

---

## Purpose

This document defines how we build the Nahu Platform. It covers conventions, workflows, and quality expectations for day-to-day engineering.

For business context, see [business/nahu-platform-business-model.md](business/nahu-platform-business-model.md).  
For architectural principles, see [02-architecture/architecture-principles.md](02-architecture/architecture-principles.md).  
For contributor setup steps, see [../CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Documentation-first workflow

Before writing or modifying code, consult the relevant documentation.

### Current documentation map

| Intended path | Current location | Contents |
|---------------|------------------|----------|
| `docs/01-business/` | `docs/business/` | Business model, business actors |
| `docs/02-architecture/` | `docs/02-architecture/` | Architecture principles |
| `docs/03-domain-model/` | `docs/03-domain-model/` | Entity specifications (users) |
| `docs/04-requirements/` | — | Not yet created |
| `docs/05-api/` | `apps/api/README.md` | Endpoint catalog and package history |
| `docs/06-database/` | `database/docs/data-dictionary.md` | Data dictionary outline |
| `docs/07-decisions/` | — | ADRs not yet created |
| `docs/08-guides/` | `CONTRIBUTING.md`, this file | Contributor and engineering guides |

Never contradict documented architecture without explaining why in the PR or an ADR.

Cursor rules in `apps/.cursor/rules.md` mirror these priorities for AI-assisted development.

---

## Monorepo conventions

### Tooling

| Tool | Role |
|------|------|
| **pnpm** 9 | Package manager (`packageManager` field in root `package.json`) |
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
| `packages/*` | `@nahu-platform/*` | Shared libraries (planned) |

### Commands

Run from the **repository root** unless noted:

```bash
pnpm install                              # Install all workspace dependencies
pnpm dev                                  # Start all apps in watch mode
pnpm build                                # Build all packages
pnpm --filter @nahu-platform/api dev      # API only
pnpm --filter @nahu-platform/api build    # API build only
```

### Package naming

- Scoped: `@nahu-platform/<name>`
- Private packages (`"private": true`) until published

---

## Backend architecture

### NestJS module layout

Each business domain is an independent NestJS module:

```
apps/api/src/
├── identity/       # OTP auth, JWT, users
├── marketplace/    # Farmers, listings, cooperatives
├── orders/         # Order lifecycle
├── certificates/   # Origin certificates
├── advisory/       # AI farmer advice
├── health/         # Liveness probe
├── prisma/         # @Global PrismaService
├── common/         # Guards, filters, decorators
└── config/         # Typed environment configuration
```

### Coding rules

| Rule | Detail |
|------|--------|
| Thin controllers | Route definitions, guards, DTO binding only |
| Business logic in services | All domain rules live in `*.service.ts` |
| DTO validation | `class-validator` on every request body and query object |
| Global validation | `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform` |
| Shared JWT | `@Global JwtConfigModule` — any module can use guards |
| Shared Prisma | `@Global PrismaModule` — inject `PrismaService` anywhere |

### Adding a new module

1. Create `src/<module>/` with `*.module.ts`, `*.controller.ts`, `*.service.ts`
2. Add DTOs under `src/<module>/dto/`
3. Register in `app.module.ts`
4. Add SQL migrations if new tables are needed
5. Update `prisma/schema.prisma` to map new tables
6. Document routes in `apps/api/README.md`

---

## Database workflow

### SQL-first migrations

Schema evolution is **SQL-first**. Migration files live in:

```
database/migrations/
├── 001_identity_schema.sql … 012_identity_seed_core_roles.sql
├── marketplace/
│   ├── 001_marketplace_schema.sql … 006_marketplace_widen_primary_language.sql
└── orders/
    ├── 001_orders_schema.sql … 003_orders_origin_certificates.sql
```

### Rules

| Do | Don't |
|----|-------|
| Add numbered SQL files for every schema change | Run `prisma migrate dev` against production or migrated databases |
| Include a header comment explaining rationale | Modify applied migrations in place |
| Apply migrations in order (identity → marketplace → orders) | Let Prisma own schema evolution |
| Update `prisma/schema.prisma` after SQL changes | Skip the data dictionary for significant tables |
| Run `pnpm --filter @nahu-platform/api prisma:generate` after schema changes | Commit `.env` files |

### Prisma's role

Prisma is the **ORM mapping layer** only. It reads the schema defined by SQL migrations. The `prisma/schema.prisma` file must stay in sync with the actual database.

### Schemas

PostgreSQL uses multiple schemas:

| Schema | Module |
|--------|--------|
| `identity` | Users, roles, OTP, organizations |
| `marketplace` | Farmer profiles, listings, cooperatives |
| `orders` | Orders, origin certificates |

---

## API conventions

### Versioning

- Global prefix: `/api/v1`
- Health check excluded: `GET /health` (unversioned, for load balancers)

### Request / response

| Convention | Detail |
|------------|--------|
| JSON body | camelCase field names (`quantityKg`, `deliveryAddress`) |
| Phone format | `+251` followed by 9 digits |
| Roles | Uppercase enums: `FARMER`, `BUYER`, `ADMIN` |
| Auth header | `Authorization: Bearer <JWT>` |
| Listing grades | `GRADE_1` … `GRADE_9` (not display strings) |
| Process methods | `WASHED`, `NATURAL`, `ANAEROBIC`, etc. |

### Error format (mobile compatibility)

All HTTP errors return:

```json
{ "error": "Human-readable message" }
```

Implemented by `MobileCompatExceptionFilter` in `apps/api/src/common/filters/`. Do not change this shape without coordinating a mobile app release.

Validation errors are joined into a single string in the `error` field.

### Input validation

Global `ValidationPipe` settings:

```typescript
{ whitelist: true, forbidNonWhitelisted: true, transform: true }
```

Every endpoint must have a DTO with `class-validator` decorators. Reject unknown fields.

### Pagination (listings)

```
GET /api/v1/listings?page=1&limit=20&region=...&sort=newest
```

Response envelope:

```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 142, "pages": 8 }
}
```

### Backward compatibility

- Do not remove or rename existing `/api/v1` routes without a deprecation period
- Mobile apps match error messages by substring — preserve recognizable phrases
- Enum value changes require coordinated mobile updates

---

## Authentication

### Flow

1. `POST /api/v1/auth/request-otp` — `{ phone, role }`
2. `POST /api/v1/auth/verify-otp` — `{ phone, otp }` → `{ token, user }`
3. Subsequent requests: `Authorization: Bearer <JWT>`

### Guards

| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` | Validates Bearer token |
| `RolesGuard` | Checks `@Roles('FARMER')` etc. against JWT payload |

Use both on protected routes:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FARMER')
```

### Dev mode

When `NODE_ENV !== 'production'`:

- OTP `123456` verifies for any phone that requested an OTP
- `request-otp` returns `dev_otp` in the response
- SMS credentials (`AT_API_KEY`, `AT_USERNAME`) are not required

In production, SMS delivery is required and `dev_otp` is never returned.

### Known limitation

JWT currently carries a single `role` string. Users with multiple roles need `activeRole` support (planned in Phase 1). `/auth/me` already returns `roles[]`.

---

## Mobile compatibility

The Farmer and Buyer Expo apps (`nahu-buna-gebaya`) consume this API.

### Requirements for API changes

| Requirement | Reason |
|-------------|--------|
| camelCase JSON fields | Matches TypeScript/mobile conventions |
| `{ error: "..." }` error body | Mobile interceptors parse this shape |
| Uppercase role enums | Mobile guards and registration |
| `/api/v1` prefix | Hardcoded in mobile `config.js` |
| Recognizable error substrings | Mobile maps "profile not found", "validation", etc. to friendly Amharic/English messages |

### Testing API changes against mobile

1. Point mobile `EXPO_PUBLIC_API_URL` (or `config.js`) at local or staging API
2. Test full user journeys: login → profile → listing → order → certificate
3. Verify error alerts show bilingual friendly messages

---

## Environment variables

Defined in `apps/api/.env.example`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes (prod) | JWT signing key |
| `JWT_EXPIRES_IN` | No | Default `7d` |
| `OTP_EXPIRES_MINUTES` | No | Default `10` |
| `AT_API_KEY` | Prod only | Africa's Talking SMS |
| `AT_USERNAME` | Prod only | Africa's Talking SMS |
| `ANTHROPIC_API_KEY` | For advisory | Claude API for farmer advice |
| `NODE_ENV` | No | `development` / `production` |
| `PORT` | No | Default `3000` |

Never commit `.env` files. Never use the example `JWT_SECRET` in production.

---

## Branching and releases

| Branch | Purpose |
|--------|---------|
| `main` | Stable, deployable code |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |

### Release flow (target)

1. Merge feature branch to `main`
2. Deploy to staging
3. Run smoke tests (health, auth, order lifecycle)
4. Deploy to production
5. Monitor error rates

CI/CD is not yet configured (planned: Phase 1, task 1.1.2).

---

## Testing

### Current state

- No automated test suite in CI
- API smoke-tested manually and documented in `apps/api/README.md`
- `pnpm test` runs Jest in the API package (scaffold only)

### Target (Phase 1)

- Integration tests for auth, listings, and orders
- CI runs `build`, `lint`, and `test` on every PR
- Staging environment for pre-production validation

### Writing tests

When adding tests:

- Use a dedicated test database or in-memory stand-in
- Test the full order lifecycle: create → pay → deliver → certificate
- Test role guards: FARMER cannot create orders, BUYER cannot create listings
- Test mobile error shape: `{ error: "..." }` not NestJS default format

---

## Security

| Rule | Detail |
|------|--------|
| No secrets in git | `.env`, API keys, credentials |
| Input validation on every endpoint | `class-validator` DTOs |
| Resource ownership in services | Orders check `buyerId`; certificates check buyer/farmer |
| Rate limiting | Planned on OTP endpoints (Phase 1) |
| Payment webhooks | User-callable `confirm-payment` must be replaced with signed webhooks (Phase 2) |
| Audit logging | Planned for payment, dispute, and auth events (Phase 1) |

---

## Pull request checklist

Before requesting review:

- [ ] Code builds: `pnpm --filter @nahu-platform/api build`
- [ ] No secrets committed
- [ ] New endpoints documented in `apps/api/README.md`
- [ ] New migrations numbered and include header comments
- [ ] `prisma/schema.prisma` updated if schema changed
- [ ] Mobile compatibility considered (error shape, field names, enums)
- [ ] Breaking changes called out explicitly in PR description
- [ ] Major architectural changes were approved before implementation

---

## What not to do

| Anti-pattern | Why |
|--------------|-----|
| Duplicate `apps/api/api/` nested copy | Canonical source is `apps/api/src/` |
| Run `prisma migrate dev` on migrated DBs | SQL files are authoritative |
| Change error response shape without mobile coordination | Breaks Expo app interceptors |
| Put business logic in controllers | Hard to test and reuse |
| Hardcode production URLs in mobile apps | Use environment config |
| Skip migrations and edit schema.prisma only | Database and ORM will diverge |

---

## Roadmap alignment

This playbook supports **Phase 1 — Foundation** of the platform roadmap:

| Task | Status |
|------|--------|
| Root README | Done |
| Engineering playbook (this file) | Done |
| Contribution guide | Done |
| CI pipeline | Planned |
| Docker Compose | Planned |
| API security hardening | Planned |
| Shared mobile package | Planned |
| Legacy cutover | Planned |

See the platform roadmap for Phases 2–5 (Marketplace, Enterprise, AI, National Platform).

---

## Getting help

| Question | Where to look |
|----------|---------------|
| How do I run the API locally? | [README.md](../README.md), [apps/api/README.md](../apps/api/README.md) |
| What actors exist on the platform? | [business/business-actors.md](business/business-actors.md) |
| How is the users table designed? | [03-domain-model/users-entity.md](03-domain-model/users-entity.md) |
| What modules exist in the database? | [database/docs/data-dictionary.md](../database/docs/data-dictionary.md) |
| How do I submit a PR? | [CONTRIBUTING.md](../CONTRIBUTING.md) |
