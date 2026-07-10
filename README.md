# Nahu Platform

Ethiopia's digital agriculture platform — a secure, mobile-first marketplace connecting farmers, buyers, cooperatives, and the wider agricultural value chain.

**Author:** Tesfayesus Yimenu Yirdaw  
**License:** MIT

---

## Vision

Build the digital infrastructure that enables Ethiopia's agricultural economy to operate more efficiently, transparently, and globally. See [Business Model](docs/business/nahu-platform-business-model.md) for the full enterprise vision.

---

## Repository map

```
nahu-platform/
├── apps/
│   └── api/              # NestJS backend (@nahu-platform/api)
├── packages/             # Shared libraries (future: mobile-core, ui)
├── database/
│   ├── migrations/       # SQL-first schema migrations (identity, marketplace, orders)
│   └── docs/             # Data dictionary
├── docs/                 # Business, architecture, domain model, engineering guides
├── package.json          # Monorepo root (pnpm + Turborepo)
├── pnpm-workspace.yaml
└── turbo.json
```

| Path | Purpose |
|------|---------|
| `apps/api/` | REST API under `/api/v1` — Identity, Marketplace, Orders, Certificates, Advisory |
| `database/migrations/` | Authoritative schema changes (apply manually in order) |
| `docs/` | Business rules, architecture principles, engineering playbook |
| `packages/` | Reserved for shared packages (`@nahu-platform/*`) |

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| pnpm | 9.x (`packageManager` field pins 9.15.0) |
| PostgreSQL | 14+ |

---

## Quick start

### 1. Clone and install

```bash
git clone <repository-url>
cd nahu-platform
pnpm install
```

### 2. Database setup

**Option A — Docker (recommended)**

```bash
docker compose up -d
```

This starts PostgreSQL 16 and applies all SQL migrations from `database/migrations/` on first run. Connection string:

```
postgresql://postgres:postgres@localhost:5432/nahu_platform
```

**Option B — Manual**

Create a PostgreSQL database, then apply migrations in order:

```bash
# Identity (001–012), then marketplace (001–006), then orders (001–003)
# See database/migrations/ for the full ordered list.
psql $DATABASE_URL -f database/migrations/001_identity_schema.sql
# ... continue through all migration files in numeric order
```

> **Important:** Migrations are SQL-first. Do **not** run `prisma migrate dev` against a database that already has these migrations applied. Prisma maps the schema; SQL files are the source of truth. See [Engineering Playbook](docs/engineering-playbook.md#database).

### 3. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
# Edit DATABASE_URL and JWT_SECRET
```

### 4. Generate Prisma client and start the API

```bash
pnpm --filter @nahu-platform/api prisma:generate
pnpm --filter @nahu-platform/api dev
```

### 5. Verify

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{ "status": "ok", "service": "nahu-platform-api", "dependencies": { ... } }
```

### 6. Smoke-test authentication

```bash
curl -X POST http://localhost:3000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251911223344","role":"FARMER"}'

curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251911223344","otp":"123456"}'
```

In development (`NODE_ENV !== production`), OTP `123456` always verifies. See [API README](apps/api/README.md) for the full endpoint catalog.

---

## Monorepo scripts

Run from the repository root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode (Turborepo) |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests across packages |
| `pnpm format` | Format with Prettier |

Filter to the API only:

```bash
pnpm --filter @nahu-platform/api dev
pnpm --filter @nahu-platform/api build
```

---

## API overview

The backend exposes ~25 endpoints under `/api/v1`:

| Module | Examples |
|--------|----------|
| Identity | `POST /auth/request-otp`, `POST /auth/verify-otp`, `GET /auth/me` |
| Marketplace | `GET /listings`, `POST /listings`, `GET /farmers/profile` |
| Orders | `POST /orders`, `GET /orders/my`, `PATCH /orders/:id/confirm-delivery` |
| Certificates | `GET /certificates/verify/:certNumber` |
| Advisory | `POST /advisory/ask`, `GET /advisory/price-alert/:region` |

Full route list, migration history, and design notes: **[apps/api/README.md](apps/api/README.md)**

---

## Mobile applications

The Farmer and Buyer Expo apps live in a separate repository (`nahu-buna-gebaya`):

| App | Role | Default language |
|-----|------|------------------|
| `nahu-buna-farmer` | FARMER | Amharic |
| `nahu-buna-buyer` | BUYER | English |

Both apps target `/api/v1` on the platform API. Migration from the legacy Express backend is in progress — see the [Engineering Playbook](docs/engineering-playbook.md#mobile-compatibility) for compatibility requirements.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Engineering Playbook](docs/engineering-playbook.md) | How we build — conventions, database workflow, API rules |
| [Contributing](CONTRIBUTING.md) | How to contribute — setup, PRs, commit style |
| [Architecture Principles](docs/02-architecture/architecture-principles.md) | Ten platform design principles |
| [Business Model](docs/business/nahu-platform-business-model.md) | Enterprise vision and business model |
| [Business Actors](docs/business/business-actors.md) | All platform actors and IAM foundation |
| [Users Entity](docs/03-domain-model/users-entity.md) | Approved Identity domain spec |
| [Data Dictionary](database/docs/data-dictionary.md) | Database module overview |
| [Staging deployment](docs/08-guides/staging-deploy.md) | Deploy API to Railway staging |

### Planned documentation structure

```
docs/
├── business/              # exists — business model, actors
├── 02-architecture/       # exists — architecture principles
├── 03-domain-model/       # exists — entity specs
├── 04-requirements/       # planned
├── 05-api/                # planned — OpenAPI, error catalog
├── 06-database/           # planned — detailed schema docs
├── 07-decisions/          # planned — ADRs
└── 08-guides/             # planned — how-to guides
```

---

## Current status

| Area | Status |
|------|--------|
| NestJS API (Identity, Marketplace, Orders, Certificates, Advisory) | Implemented |
| SQL migrations (22 files, 3 schemas) | Implemented |
| Mobile apps (Expo) | MVP — separate repo |
| CI/CD, Docker | CI build on PR; Docker Compose for local Postgres |
| Real payment integration (Telebirr) | Planned — Phase 2 |
| Admin portal | Planned — Phase 3 |
| Shared mobile package | Planned — Phase 1 |

---

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. For conventions and workflow details, see the [Engineering Playbook](docs/engineering-playbook.md).

---

## License

MIT — see [package.json](package.json).
