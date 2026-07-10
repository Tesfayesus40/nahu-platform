# Contributing to Nahu Platform

Thank you for contributing to Ethiopia's digital agricultural marketplace. This guide walks you through setting up the project and submitting changes.

For engineering conventions and patterns, see [docs/engineering-playbook.md](docs/engineering-playbook.md).  
For a high-level overview, see [README.md](README.md).

---

## Before you start

### Prerequisites

- Node.js 20+
- pnpm 9 (`corepack enable`)
- PostgreSQL 14+
- Git

### Clone and install

```bash
git clone <repository-url>
cd nahu-platform
pnpm install
```

---

## Development setup

### 1. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nahu_platform"
JWT_SECRET="your-local-dev-secret-at-least-32-chars"
NODE_ENV=development
```

For local development, SMS and AI keys are optional. OTP `123456` works as a dev bypass after calling `request-otp`.

### 2. Create the database

```bash
createdb nahu_platform
```

Or use your preferred PostgreSQL tooling.

### 3. Apply migrations

Migrations are SQL files applied **manually in order**. Use `psql`, pgAdmin, or any PostgreSQL client.

**Identity** (`database/migrations/`):

```
001_identity_schema.sql
002_identity_users.sql
003_identity_credentials.sql
004_identity_roles.sql
005_identity_permissions.sql
006_identity_user_roles.sql
007_identity_role_permissions.sql
008_identity_organizations.sql
009_identity_user_organizations.sql
010_identity_relax_registration_constraints.sql
011_identity_otp_codes.sql
012_identity_seed_core_roles.sql
```

**Marketplace** (`database/migrations/marketplace/`):

```
001_marketplace_schema.sql
002_marketplace_cooperatives.sql
003_marketplace_farmer_profiles.sql
004_marketplace_listings.sql
005_marketplace_expand_taxonomy.sql
006_marketplace_widen_primary_language.sql
```

**Orders** (`database/migrations/orders/`):

```
001_orders_schema.sql
002_orders_orders.sql
003_orders_origin_certificates.sql
```

Example with `psql`:

```bash
psql "$DATABASE_URL" -f database/migrations/001_identity_schema.sql
# … continue in order for all files
```

Do **not** run `prisma migrate dev` on databases that have been set up with these SQL files.

### 4. Generate Prisma client

```bash
pnpm --filter @nahu-platform/api prisma:generate
```

Run this again whenever `apps/api/prisma/schema.prisma` changes.

### 5. Start the API

```bash
pnpm --filter @nahu-platform/api dev
```

Verify:

```bash
curl http://localhost:3000/health
```

---

## Making changes

### Branch naming

| Prefix | Use for |
|--------|---------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `chore/` | Tooling, dependencies |

Example: `feature/listing-edit-endpoint`

### Code organization

| Change type | Where |
|-------------|-------|
| New API endpoint | `apps/api/src/<module>/` |
| Database table/column | `database/migrations/<module>/` + `prisma/schema.prisma` |
| Business docs | `docs/business/` |
| Architecture docs | `docs/02-architecture/` |
| Engineering conventions | `docs/engineering-playbook.md` |

Follow existing patterns. Read the surrounding module before adding code.

### Database changes

1. Create a new numbered SQL migration file with a header comment explaining **why**
2. Update `apps/api/prisma/schema.prisma` to match
3. Run `pnpm --filter @nahu-platform/api prisma:generate`
4. Document the migration in your PR description
5. Never modify migrations that have already been applied to shared environments

### API changes

- Preserve backward compatibility with `/api/v1` mobile clients
- Use camelCase in JSON request and response bodies
- Validate all inputs with `class-validator` DTOs
- Return errors as `{ error: "message" }` (handled by `MobileCompatExceptionFilter`)
- Document new routes in `apps/api/README.md`

### Major changes

For architectural changes, new database modules, or breaking API changes:

1. **Explain** the proposed change and rationale
2. **Wait for approval** before implementing
3. Implement in a focused PR

This applies especially to schema redesigns, auth model changes, and error format changes.

---

## Testing your changes

### Build

```bash
pnpm --filter @nahu-platform/api build
```

### Manual smoke test

After API changes, verify at minimum:

```bash
# Health
curl http://localhost:3000/health

# Auth
curl -X POST http://localhost:3000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251911223344","role":"FARMER"}'

curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251911223344","otp":"123456"}'
```

Use the returned token for authenticated endpoints. See [apps/api/README.md](apps/api/README.md) for the full endpoint list and lifecycle tests.

### Mobile impact

If your change affects request/response shapes, error messages, or auth:

- Test against the Farmer or Buyer Expo app in `nahu-buna-gebaya`
- Point the app's API URL at your local or staging server
- Verify bilingual error messages still display correctly

---

## Pull request process

### 1. Create a branch

```bash
git checkout -b feature/your-change
```

### 2. Make focused changes

Keep PRs small and reviewable. One feature or fix per PR when possible.

### 3. Write a clear PR description

Include:

- **What** changed
- **Why** it was needed
- **How** to test it
- Migration notes (if any)
- Mobile compatibility notes (if any)
- Breaking changes (if any)

### 4. Pre-submit checklist

- [ ] `pnpm --filter @nahu-platform/api build` passes
- [ ] No `.env` or secrets committed
- [ ] Migrations are numbered and documented
- [ ] API routes documented in `apps/api/README.md` (if applicable)
- [ ] Error format remains `{ error: "..." }` for mobile clients

### 5. Request review

Wait for review before merging to `main`.

---

## Commit messages

Use clear, imperative commit messages. Match the existing repository style:

```
docs: add root README with quick start and repo map

feat: add PATCH /listings/:id endpoint for farmer edits

fix: use camelCase farmerPayoutEtb in EarningsScreen totals

chore: add Docker Compose for local Postgres
```

Format: `<type>: <short summary>` with an optional body paragraph for context.

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.

---

## What not to commit

| File / pattern | Reason |
|----------------|--------|
| `apps/api/.env` | Contains secrets |
| API keys, passwords, tokens | Security |
| `apps/api/api/` compiled duplicate | Not canonical source |
| `node_modules/`, `dist/` | Build artifacts (should be gitignored) |
| Large binary files | Use external storage |

---

## Code style

- **TypeScript** for all API code
- **Prettier** for formatting: `pnpm format`
- **NestJS conventions**: modules, controllers, services, DTOs
- **Thin controllers**, business logic in services
- **Comments** only for non-obvious business logic

---

## Documentation changes

Documentation PRs are welcome and do not require API smoke tests. Update cross-links when adding or renaming files.

| Document | Update when |
|----------|-------------|
| `README.md` | Repo structure, quick start, or scripts change |
| `docs/engineering-playbook.md` | Conventions or workflows change |
| `apps/api/README.md` | Endpoints, packages, or API behavior change |
| `CONTRIBUTING.md` | Setup steps or PR process change |

---

## Getting help

| Topic | Resource |
|-------|----------|
| Running the API | [README.md](README.md) |
| Engineering conventions | [docs/engineering-playbook.md](docs/engineering-playbook.md) |
| API endpoints | [apps/api/README.md](apps/api/README.md) |
| Business actors | [docs/business/business-actors.md](docs/business/business-actors.md) |
| Architecture principles | [docs/02-architecture/architecture-principles.md](docs/02-architecture/architecture-principles.md) |

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
