# Nest-only commercial path (Production Readiness)

**Status:** Binding for pilot / RC1 ops  
**Date:** 2026-07-29

## Rule

All pilot commercial traffic (orders, fees, escrow, fulfilment, payments, admin ops) goes through **`nahu-platform` Nest API** (`apps/api`).

The **legacy Express stack** at the root of `nahu-buna-gebaya` (`server.js`, `src/modules/**`, including `COMMISSION_RATE = 0.02`) is **quarantined**:

- Do **not** point EAS / mobile `.env` / Admin Web at Express.
- Do **not** run Express against shared staging/prod Postgres for UAT.
- Treat Express as historical reference only until decommission.

## Mobile defaults

Buyer / Farmer / Courier `API_BASE_URL` and EAS profiles must target Nest staging (see each app `.env.example` and `MOBILE_NEST.md` where present).

## Ops checklist

1. Confirm `GET /health/ready` on Nest.
2. Confirm migrations through G10 + `ops/013` via manifest.
3. Confirm Admin Web BFF proxies to Nest `/admin/*`.
4. Never use Express `thorough-heart` for fee or order validation.

## Courier earnings (pilot)

Until dynamic delivery fees are ON, courier accrual uses flat config:

- Set `delivery.earning.flat_etb` in ops delivery config to a **non-zero** ETB amount for paid pilot courier runs, **or**
- Explicitly accept **zero** courier payouts for unpaid internal pilot.

See `docs/08-guides/d12-delivery-deployment-checklist.md` and `docs/08-guides/delivery-rc1-production-readiness-review.md`.
