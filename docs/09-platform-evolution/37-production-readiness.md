# 37 — Production Readiness (Pilot Roadmap)

**Status:** **Accepted** — RC1 release candidate preparation (`docs/releases/v1.0.0-rc1/`)  
**Date:** 2026-07-29  
**Scope:** Full stack — API, Admin Web, Buyer / Farmer / Courier, shared packages, CI/CD  
**Constraint:** Hardening complete; RC1 freeze = bug fixes only

**Related:** [v1.0.0-rc1 release](../releases/v1.0.0-rc1/README.md) · [technical-debt.md](../technical-debt.md) · [nest-only-ops.md](../08-guides/nest-only-ops.md) · [staging-deploy.md](../08-guides/staging-deploy.md)

---

## Pilot-ready definition

Critical (PR-C*) complete; staging migrations through G10 + `ops/013` applied; optional staging smoke documented and runnable; Nest-only ops runbook published; no open Critical money / auth / health defects.

**Deferred after pilot:** live Telebirr/CBE/Chapa, additional marketplace verticals, finance ledger, k8s/Helm, device E2E.

---

## CI / smoke model

| Gate | When | What |
|------|------|------|
| **Every PR** | Always | API `test:rules`, API lint/build, Admin Web build, gebaya `npm test` (shared) |
| **Staging smoke** | `workflow_dispatch` + secrets | `apps/api/scripts/pilot-e2e-smoke.cjs` |

---

## Backlog status

### Critical — closed in this wave

| ID | Status |
|----|--------|
| PR-C1 | Done — `test:rules` + CI |
| PR-C2 | Done — import rules + secrets-gated smoke script |
| PR-C3 | Done — pricing/orch/payment/ops tests import `.ts` |
| PR-C4 | Done — `/health/live` vs `/health/ready`; Dockerfile ready probe |
| PR-C5 | Done — `.env.example` + staging checklist secrets |
| PR-C6 | Done — staging-deploy migrate through G10 + ops/013 |
| PR-C7 | Done — buyer checkout never invents fee % |
| PR-C8 | Done — Admin build + gebaya shared tests in CI |

### High — closed or mitigated

| ID | Status |
|----|--------|
| PR-H1 | Smoke script + workflow_dispatch job |
| PR-H2 | Pricing mutations require reauth |
| PR-H3 | `ops/013_ops_query_indexes.sql` |
| PR-H4 | RC1 + AGENTS Expo 54 refresh |
| PR-H5 | gitignore tmp exports; nest-only + LEGACY_EXPRESS |
| PR-H6 | Stub labels on intents / ops payments |
| PR-H7 | Courier flat earning policy in nest-only-ops |
| PR-H8 | API README + Admin Pricing commercial notes |
| PR-H9 | Deferred to next hardening (audit remaining) — **waive for internal pilot** |
| PR-H10 | Admin Web build in CI |

### Medium / Nice

Deferred per plan (OpenAPI, live providers, multi-vertical, device E2E).

---

## Verification

```bash
# API
cd apps/api && pnpm test:rules

# Gebaya shared
cd nahu-buna-gebaya && npm test

# Staging (optional)
PILOT_SMOKE=1 API_BASE_URL=https://... BUYER_TOKEN=... \
  node apps/api/scripts/pilot-e2e-smoke.cjs
```
