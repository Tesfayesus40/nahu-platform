# Nahu Platform

Ethiopia's digital agricultural marketplace — a secure, mobile-first platform connecting farmers, buyers, cooperatives, and the wider agricultural value chain.

**Status:** Active development (MVP backend + mobile apps)  
**License:** MIT  
**Author:** Tesfayesus Yimenu Yirdaw

---

## Vision

Build the digital infrastructure that enables Ethiopia's agricultural economy to operate more efficiently, transparently, and globally. See [docs/business/nahu-platform-business-model.md](docs/business/nahu-platform-business-model.md) for the full business model.

---

## Repository structure

This is a **pnpm + Turborepo monorepo**.

```
nahu-platform/
├── apps/
│   └── api/                  # NestJS backend (@nahu-platform/api)
├── packages/                 # Shared libraries (planned)
├── database/
│   ├── migrations/           # SQL-first schema migrations
│   └── docs/                 # Data dictionary
└── docs/                     # Business, architecture, and engineering docs
```

| Path | Purpose |
|------|---------|
| `apps/api/` | REST API under `/api/v1` — identity, marketplace, orders, certificates, advisory |
| `database/migrations/` | Authoritative schema changes (identity, marketplace, orders) |
| `docs/` | Business model, architecture principles, domain specs, engineering playbook |
| `packages/` | Reserved for shared code (`@nahu/mobile-core`, etc.) |

---

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **PostgreSQL** 14+ (local or Docker)

---

## Quick start

### 1. Install dependencies

From the repository root:

```bash
pnpm install
```

### 2. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

- Set `DATABASE_URL` to your PostgreSQL instance
- Set `JWT_SECRET` to a long random string (required outside local dev)

Leave `AT_API_KEY` and `AT_USERNAME` blank for local development — the dev OTP bypass (`123456`) works without SMS credentials.

### 3. Apply database migrations

Migrations are **SQL files applied manually** in order. See [database/migrations/](database/migrations/) and [CONTRIBUTING.md](CONTRIBUTING.md) for the full sequence.

At minimum, apply all files under:

- `database/migrations/` (identity: `001`–`012`)
- `database/migrations/marketplace/` (`001`–`006`)
- `database/migrations/orders/` (`001`–`003`)

### 4. Generate Prisma client and start the API

```bash
pnpm --filter @nahu-platform/api prisma:generate
pnpm --filter @nahu-platform/api dev
```

The API listens on `http://localhost:3000` by default.

### 5. Verify

```bash
curl http://localhost:3000/health
```

Expected response includes `"status": "ok"`.

### 6. Try authentication (dev mode)

```bash
curl -X POST http://localhost:3000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251911223344","role":"FARMER"}'

curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251911223344","otp":"123456"}'
```

In non-production environments, OTP `123456` always verifies after a request has been made.

---

## Root scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode (Turborepo) |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests across the monorepo |
| `pnpm format` | Format with Prettier |

Filter to the API only:

```bash
pnpm --filter @nahu-platform/api <script>
```

---

## API overview

The backend exposes ~25 endpoints grouped by domain:

| Domain | Base path | Auth |
|--------|-----------|------|
| Health | `/health` | Public |
| Identity | `/api/v1/auth/*` | OTP + JWT |
| Marketplace | `/api/v1/farmers/*`, `/api/v1/listings/*` | Mixed |
| Orders | `/api/v1/orders/*` | JWT + role |
| Certificates | `/api/v1/certificates/*` | Mixed |
| Advisory | `/api/v1/advisory/*` | JWT + FARMER |

Full endpoint documentation, package history, and design notes: **[apps/api/README.md](apps/api/README.md)**.

---

## Mobile applications

The Farmer and Buyer Expo apps live in a separate repository:

**`nahu-buna-gebaya`** — contains `nahu-buna-farmer` and `nahu-buna-buyer`.

Both apps target `/api/v1` on the backend. Migration from the legacy Express server to this NestJS API is in progress. See the engineering playbook for mobile compatibility requirements.

---

## Documentation

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute — setup, PRs, migrations |
| [docs/engineering-playbook.md](docs/engineering-playbook.md) | Day-to-day engineering conventions |
| [docs/02-architecture/architecture-principles.md](docs/02-architecture/architecture-principles.md) | Core architectural principles |
| [docs/business/business-actors.md](docs/business/business-actors.md) | Platform actors and IAM foundation |
| [docs/03-domain-model/users-entity.md](docs/03-domain-model/users-entity.md) | Users entity specification |
| [database/docs/data-dictionary.md](database/docs/data-dictionary.md) | Database module outline |
| [apps/api/README.md](apps/api/README.md) | API packages, routes, and local dev details |

### Planned documentation layout

The repository is moving toward a numbered docs structure (`docs/01-business` through `docs/08-guides`). Existing files are mapped in the [engineering playbook](docs/engineering-playbook.md).

---

## Architecture at a glance

- **API-first** — NestJS modules per business domain; mobile and web consume the same REST API
- **SQL-first database** — migrations in `database/migrations/`; Prisma maps tables but does not own schema evolution
- **Mobile-first** — JSON errors shaped as `{ error: "..." }` for Expo app compatibility
- **Modular** — identity, marketplace, orders, certificates, and advisory are independent NestJS modules

---

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. For conventions and patterns, see [docs/engineering-playbook.md](docs/engineering-playbook.md).

Major architectural or database changes require an explanation and approval before implementation.

---

## Related repositories

| Repository | Role |
|------------|------|
| `nahu-platform` (this repo) | Canonical enterprise backend and platform docs |
| `nahu-buna-gebaya` | Legacy Express backend (being retired) + Farmer/Buyer Expo apps |
