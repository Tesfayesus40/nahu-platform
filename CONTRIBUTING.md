# Contributing to Nahu Platform

Thank you for contributing to Ethiopia's digital agriculture platform. This guide covers setup, workflow, and expectations for pull requests.

For conventions and architecture rules, see the [Engineering Playbook](docs/engineering-playbook.md).

---

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 9.x
- PostgreSQL 14+
- Git

### 1. Fork and clone

```bash
git clone <your-fork-url>
cd nahu-platform
pnpm install
```

### 2. Set up the database

Create a PostgreSQL database and apply migrations in numeric order from `database/migrations/`:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nahu_platform"

# Apply identity migrations (001–012), then marketplace/, then orders/
psql $DATABASE_URL -f database/migrations/001_identity_schema.sql
# Continue through all files — see apps/api/README.md for migration notes
```

### 3. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

- Set `DATABASE_URL` to your local database
- Set `JWT_SECRET` to a long random string
- Leave `AT_API_KEY` blank for local dev (OTP `123456` works)

### 4. Generate Prisma client and run

```bash
pnpm --filter @nahu-platform/api prisma:generate
pnpm --filter @nahu-platform/api dev
```

### 5. Verify

```bash
curl http://localhost:3000/health
```

---

## Development workflow

### 1. Create a branch

```bash
git checkout -b feature/short-description
# or
git checkout -b fix/short-description
```

### 2. Make changes

Follow the [Engineering Playbook](docs/engineering-playbook.md):

- Put business logic in services, not controllers
- Validate all inputs with DTOs
- Use SQL migrations for schema changes
- Preserve mobile API compatibility (`{ error: "..." }`, camelCase, uppercase roles)

### 3. Test locally

```bash
pnpm build
pnpm lint    # when lint is configured for your package
pnpm test    # when tests exist for your change
```

### 4. Commit

Write clear, imperative commit messages:

```
docs: add root README with quick start
fix: use camelCase field names in earnings screen
feat: add PATCH /listings/:id endpoint
```

Match the style of existing commits in the repository.

### 5. Push and open a pull request

- Describe **what** changed and **why**
- Include a test plan (commands run, endpoints tested)
- Link related issues if applicable
- Note any database migrations that need applying
- Note any mobile app impact

---

## Database changes

Schema changes require **both**:

1. A new SQL file in `database/migrations/` (with a header comment explaining why)
2. An update to `apps/api/prisma/schema.prisma` matching the new tables/columns

**Do not** run `prisma migrate dev` on a database that already has SQL migrations applied.

After your migration:

```bash
psql $DATABASE_URL -f database/migrations/<your-new-file>.sql
pnpm --filter @nahu-platform/api prisma:generate
pnpm --filter @nahu-platform/api build
```

Document the migration in your PR description so reviewers can apply it.

---

## API changes

### Backward compatibility

The mobile apps (`nahu-buna-farmer`, `nahu-buna-buyer`) depend on the v1 API contract:

- URL prefix `/api/v1`
- Error body `{ error: "message" }`
- camelCase JSON fields
- Uppercase role and enum codes

Do not break these without coordinating a mobile app release.

### Adding an endpoint

1. Create or extend a DTO in `dto/`
2. Add service method with business logic
3. Add controller route with appropriate guards (`JwtAuthGuard`, `RolesGuard`)
4. Document in `apps/api/README.md`
5. Test with `curl` or integration tests

---

## Major changes

For architectural changes, new database schemas, or breaking API changes:

1. Explain the proposed change in an issue or PR draft
2. Wait for approval from a maintainer
3. Implement in focused, reviewable commits
4. Update documentation

See [Major changes protocol](docs/engineering-playbook.md#major-changes-protocol) in the playbook.

---

## What not to commit

| Item | Reason |
|------|--------|
| `.env` files | Contain secrets |
| `node_modules/` | Installed via pnpm |
| Compiled `.js` / `.js.map` in `src/` | Build artifacts |
| `apps/api/api/` duplicate folder | Removed — path is gitignored; canonical source is `apps/api/` |
| API keys, passwords, tokens | Security |

---

## Code style

| Area | Convention |
|------|------------|
| Language | TypeScript for backend (`apps/api/src/`) |
| Formatting | Prettier (`pnpm format` from root) |
| Controllers | Thin — delegate to services |
| Services | Business logic, database access via PrismaService |
| DTOs | `class-validator` decorators on all request fields |
| Errors | NestJS exceptions (`BadRequestException`, `NotFoundException`, etc.) |

---

## Pull request checklist

- [ ] Branch is up to date with `main`
- [ ] `pnpm build` passes
- [ ] No secrets or `.env` files included
- [ ] Database migrations documented in PR description
- [ ] Mobile compatibility considered for API changes
- [ ] Documentation updated if setup or conventions changed
- [ ] Test plan included in PR description

---

## Documentation changes

Documentation-only PRs are welcome. Key files:

| File | When to update |
|------|----------------|
| `README.md` | Setup steps, repo structure, or status changes |
| `docs/engineering-playbook.md` | New conventions or workflow changes |
| `docs/08-guides/staging-deploy.md` | Staging/production Railway deployment |
| `CONTRIBUTING.md` | Contribution process changes |
| `apps/api/README.md` | New endpoints, migrations, or packages |
| `docs/03-domain-model/` | Entity spec changes |

---

## Getting help

| Resource | Contents |
|----------|----------|
| [README](README.md) | Quick start and repo map |
| [Engineering Playbook](docs/engineering-playbook.md) | Conventions and architecture |
| [API README](apps/api/README.md) | Endpoints, migrations, dev notes |
| [Architecture Principles](docs/02-architecture/architecture-principles.md) | Design principles |
| [Business Actors](docs/business/business-actors.md) | Platform actors and roles |

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
