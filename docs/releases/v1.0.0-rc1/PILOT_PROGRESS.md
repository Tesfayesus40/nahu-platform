# RC1 Pilot Progress Tracker

**Release:** `v1.0.0-rc1`  
**Last updated:** 2026-07-29  
**Pilot owner:** _(assign)_  
**Environment:** Staging  

Companion: [UAT_CHECKLIST.md](./UAT_CHECKLIST.md) · [PILOT_GUIDE.md](./PILOT_GUIDE.md) · [PILOT_DEFECT_REGISTER.md](./PILOT_DEFECT_REGISTER.md)

---

## Milestone progress

| Milestone | Status | Evidence |
|-----------|--------|----------|
| RC1 tagged + CI green | **Done** | Tags + CI recovery commits |
| Staging deploy + migrations through `ops/013` | **Done** | [RC1_STAGING_VALIDATION.md](./RC1_STAGING_VALIDATION.md) |
| Staging secured for pilot | **Done** | Smoke creds rotated; `NODE_ENV=production` |
| UAT materials + APKs | **Done** | Pilot guide; Buyer 8 / Farmer 8 / Courier 11 |
| Engineering E2E smoke (API) | **Done** | Buyer→refund path on staging |
| Ops surface validation | **Done** | Dashboard, order, payment, audit, sellers, reassign |
| **Named participant device UAT** | **Not started** | No signed `UAT_CHECKLIST` rows from pilot users |
| ≥2 shared human E2E runs | **Not started** | — |
| Defect triage complete | **Partial** | Staging defects registered; no UAT bugs yet |
| Pilot completion sign-off | **Blocked** | Waiting on human UAT |
| Phase 1 formal close | **Blocked** | See [RC1_PILOT_REPORT.md](./RC1_PILOT_REPORT.md) |

---

## Participant roster (fill during kickoff)

| Role | Name | Contact | APK/URL | Checklist done? |
|------|------|---------|---------|-----------------|
| Buyer 1 | | | Buyer build 8 | |
| Buyer 2 | | | Buyer build 8 | |
| Farmer 1 (listing owner) | | | Farmer build 8 | |
| Farmer 2 | | | Farmer build 8 | |
| Courier 1 | | | Courier build 11 | |
| Courier 2 | | | Courier build 11 | |
| Admin 1 | | | Admin Web staging | |
| Pilot owner / scribe | | | — | |

---

## Shared E2E runs

| # | Date | Order ID | Result | Notes |
|---|------|----------|--------|-------|
| Eng-1 | 2026-07-29 | `5d10dd81-b75c-467d-bace-dbf1015fde87` | **PASS** (API) | Staging validation settle + refund |
| Human-1 | | | Pending | |
| Human-2 | | | Pending | |

---

## Daily log

| Date | Notes |
|------|-------|
| 2026-07-29 | Pilot execution management opened. Engineering validation treated as pre-UAT gate. Human UAT not yet run. Staging healthy (`/health/ready` 200). |
