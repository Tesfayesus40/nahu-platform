# v1.0.0-rc1 — Release Candidate 1

**Status:** Prepared for pilot deployment  
**Date:** 2026-07-29  
**Gate:** Production Readiness **accepted** — this phase freezes scope; no new features

| Artifact | Path |
|----------|------|
| Release notes (this file) | `docs/releases/v1.0.0-rc1/README.md` |
| **RC1 Manifest (authoritative)** | [RC1_MANIFEST.md](./RC1_MANIFEST.md) |
| Version freeze | [VERSION-FREEZE.md](./VERSION-FREEZE.md) |
| Deployment notes | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Release checklist | [CHECKLIST.md](./CHECKLIST.md) |
| Pilot verification | [PILOT-VERIFICATION.md](./PILOT-VERIFICATION.md) |
| Backlog (Post-RC1 / RC2) | [BACKLOG.md](./BACKLOG.md) |
| Frozen migration manifest | [migration-manifest.frozen.json](./migration-manifest.frozen.json) |
| Tagging procedure | [TAGGING.md](./TAGGING.md) |

**Companion repos**

| Repo | Tag (after approval) | Apps |
|------|----------------------|------|
| `nahu-platform` | `v1.0.0-rc1` | Nest API, Admin Web, migrations, CI |
| `nahu-buna-gebaya` | `v1.0.0-rc1` | Buyer, Farmer, Courier, shared |

See [RC1_MANIFEST.md](./RC1_MANIFEST.md) for commit hashes and tag readiness.

---

## Platform capabilities (in this RC)

- **Coffee marketplace (Nest-only)** — browse, listing schema attributes, create order with fee snapshot, simulated payment → escrow
- **Revenue Engine** — buyer/farmer platform fees from active schedule; delivery dynamic fee **OFF**
- **Fulfilment (G8)** — seller accept → ready → assign → dual pickup/delivery confirm → settle
- **Payments (G9)** — payment cases, escrow ledger, settlement lines; **provider stubs only** (not live cash)
- **Ops (G10)** — admin dashboard, order inspection, sellers, courier/payment lists, health
- **Delivery RC1** — courier CRM, queue, execution, POD, earnings (flat ETB or zero per ops policy)
- **Admin** — users, MFA, verification, moderation, disputes, pricing (reauth), catalog, delivery ops
- **Mobile** — Buyer / Farmer / Courier Expo ~54 against Nest staging

---

## Deployment requirements (summary)

1. Apply **full** migration manifest through `ops/013_ops_query_indexes.sql` (see frozen copy).
2. Nest API Docker image from `nahu-platform` root `Dockerfile`; healthcheck = `/health/ready`.
3. Prod/staging secrets: `JWT_SECRET`, `ADMIN_MFA_ENCRYPTION_KEY`, `DATABASE_URL`, `CORS_ORIGINS`; SMS or staging `OTP_DEV_BYPASS`.
4. Point Admin Web + mobile EAS builds at Nest — **never** legacy Express (`docs/08-guides/nest-only-ops.md`).
5. Optional: `PILOT_SMOKE=1` + tokens → `apps/api/scripts/pilot-e2e-smoke.cjs`.

Full steps: [DEPLOYMENT.md](./DEPLOYMENT.md) · [staging-deploy.md](../../08-guides/staging-deploy.md).

---

## Known limitations

| Area | Limitation |
|------|------------|
| Payments | Stubs / simulated confirm — intents are **not** live Telebirr/CBE/Chapa cash |
| Delivery fee | `delivery.dynamic_fee.enabled` remains **OFF** |
| Courier pay | May be **0** unless `delivery.earning.flat_etb` is set |
| Verticals | **Coffee only** — Honey and others not activated |
| Notifications | No full push/email inbox platform |
| Throttler | Not every route has global `APP_GUARD` (PR-H9 waived for pilot) |
| Express | Still present in gebaya root — quarantined, not supported |

---

## Deferred work (after successful pilot)

See [BACKLOG.md](./BACKLOG.md):

- **Track A** — live payment integrations  
- **Track B** — notification platform  
- **Track C** — Honey marketplace activation  

---

## Freeze policy

After tags are cut: **bug fixes only**. No features, redesigns, schema redesign, or UI redesign. See [VERSION-FREEZE.md](./VERSION-FREEZE.md).

---

## Related

- [37 — Production Readiness](../../09-platform-evolution/37-production-readiness.md) (accepted)
- [nest-only-ops.md](../../08-guides/nest-only-ops.md)
- Prior: [RC1-Revenue-Engine.md](../RC1-Revenue-Engine.md) · [RC1-Readiness-Report.md](../RC1-Readiness-Report.md)
