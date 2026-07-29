# Production Readiness Report — toward `v1.0.0`

**Document:** `PRODUCTION_READINESS_v1.0.0.md`  
**Date:** 2026-07-29  
**Status:** **DRAFT — BLOCKED on Phase 1 approval**  
**Depends on:** [RC1_PILOT_REPORT.md](./RC1_PILOT_REPORT.md) recommendation flipping from NO GO after human UAT

> This document inventories **exactly what remains** before Coffee Marketplace production (`v1.0.0`).  
> It does **not** authorize deployment. Do **not** deploy to production until Phase 1 is formally completed and this report is re-approved.

---

## Gate status

| Gate | Status |
|------|--------|
| Phase 1 human UAT signed off | **Pending** |
| Phase 1 Go/No-Go for production | **NO GO** (current) |
| Production deploy | **Not started — do not start** |
| Phase 2 work | **Blocked** |

---

## What already exists (reusable for prod)

- Nest API + Admin Web RC1 capability set (coffee path)  
- Migration manifest through `ops/013`  
- CI pipeline (lint, rules tests, builds)  
- Staging reference configuration (with documented differences)  
- Mobile APK train `1.0.0-rc1` (rebuild for prod URLs/secrets as needed)  
- Runbooks: staging deploy, migration manifest, admin bootstrap, RC1 deployment notes  

---

## Remaining work before `v1.0.0` deployment

### A. Phase 1 close-out (mandatory first)

1. Complete human UAT; update [RC1_PILOT_REPORT.md](./RC1_PILOT_REPORT.md) to GO or GO WITH MINOR FIXES.  
2. Resolve all open **Critical** UAT defects; agree disposition of High.  
3. Explicit Phase 1 **approval** recorded on [PROJECT_ROADMAP.md](../../../PROJECT_ROADMAP.md).

### B. Production environment

| Item | Action |
|------|--------|
| Production Postgres | Provision isolated DB; backups enabled |
| Apply migrations | Manifest through `ops/013` on **prod** |
| Nest API service | Deploy approved image/commit; healthchecks `/health/live` + `/health/ready` |
| Admin Web | Deploy with prod `API_BASE_URL` / CORS |
| Secrets | Unique `JWT_SECRET`, `ADMIN_MFA_ENCRYPTION_KEY`, DB URL — never copy staging |
| `NODE_ENV` | `production` |
| `OTP_DEV_BYPASS` | **Must be false / unset** |
| SMS | Configure `AT_API_KEY` / `AT_USERNAME` (or approved provider) |
| `PUBLIC_API_URL` / `CORS_ORIGINS` | Production hosts only |
| Feature flags | `delivery.dynamic_fee.enabled` **OFF**; set `delivery.earning.flat_etb` per paid-courier policy |

### C. Security & access

| Item | Action |
|------|--------|
| Admin MFA | All prod admins enrolled; break-glass documented |
| No smoke/test passwords | Verify; rotate any shared UAT secrets |
| Nest-only | Confirm no mobile/admin traffic to legacy Express |
| Upload / PII | Volume backups + access controls |

### D. Mobile distribution

| Item | Action |
|------|--------|
| Prod API URL in EAS profile | Point to production Nest `/api/v1` |
| Fresh builds | New versionCode; signed artifacts |
| Distribution channel | Internal track or store — as approved |
| Version label | Align to `1.0.0` (not `rc1`) when cutting prod |

### E. Observability & operations

| Item | Action |
|------|--------|
| Monitoring / alerts | API uptime, error rate, DB, disk |
| Runbooks | Incident, rollback ([DEPLOYMENT.md](./DEPLOYMENT.md) §8) |
| On-call | Named owner for pilot week |
| Backup restore drill | At least one successful restore test |
| Release notes | `v1.0.0` notes for ops + partners |

### F. Product / policy (explicit RC1 limits)

| Topic | Production stance for `v1.0.0` |
|-------|-------------------------------|
| Payments | **Stub/ledger only** unless Phase 4 brought forward by separate approval — default: keep stubs and label UX clearly **or** delay prod until live PSP (decision required) |
| Notifications | OTP only |
| Categories | Coffee only |
| Dynamic delivery fee | OFF |

**Decision required before deploy:** Is `v1.0.0` allowed to ship with **stub payments** for a limited private pilot in production, or must live Telebirr wait inside `v1.0.0`? Roadmap places live payments in **Phase 4 (`v1.1`)**. Default recommendation: **limited production with clearly labelled stub/simulated pay only if legal/ops accept**; otherwise keep production cutover gated on payment policy.

---

## Suggested production cutover sequence (after Phase 1 GO)

1. Freeze prod candidate commit/tag (`v1.0.0`).  
2. Apply prod migrations; verify ledger.  
3. Deploy API → verify ready probe.  
4. Deploy Admin → MFA login.  
5. Configure SMS; disable OTP bypass; smoke OTP with real SMS.  
6. Build/publish mobile `1.0.0`.  
7. Private prod smoke (one order path).  
8. Open limited pilot cohort.  
9. Monitor 48–72h.  

**Still do not** start Honey, notifications platform, AI, or Nahu Farms (`v2.0`) from this cutover.

---

## Exit criteria for this document

This draft becomes **actionable** only when:

1. [RC1_PILOT_REPORT.md](./RC1_PILOT_REPORT.md) recommendation is **GO** or **GO WITH MINOR FIXES**, and  
2. Phase 1 is marked **Completed** on [PROJECT_ROADMAP.md](../../../PROJECT_ROADMAP.md) with approval, and  
3. Payment policy for `v1.0.0` is decided.

Until then: **no production deployment**.
