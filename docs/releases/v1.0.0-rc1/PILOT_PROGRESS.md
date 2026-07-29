# RC1 Pilot Progress Tracker

**Release:** `v1.0.0-rc1`  
**Last updated:** 2026-07-29  
**Mode:** **Human UAT execution — active** (awaiting first session evidence)  
**Pilot owner:** _(assign)_  
**Environment:** Staging  

Companion: [UAT_CHECKLIST.md](./UAT_CHECKLIST.md) · [PILOT_GUIDE.md](./PILOT_GUIDE.md) · [PILOT_DEFECT_REGISTER.md](./PILOT_DEFECT_REGISTER.md) · [RC1_PILOT_REPORT.md](./RC1_PILOT_REPORT.md)

**Operating rules**

- After each session: update this file + defect register; attach evidence paths.  
- After each defect fix: verify, mark status, reassess readiness, refresh pilot report if needed.  
- **Do not** close Phase 1 or recommend Phase 2 until checklist completion + your explicit approval.

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
| Human UAT execution mode | **Armed** | Standing by for session reports |
| **Named participant device UAT** | **Not started** | No signed checklist rows yet |
| ≥2 shared human E2E runs | **Not started** | — |
| Defect triage complete | **Partial** | Staging defects only; UAT bugs TBD |
| Pilot completion sign-off | **Blocked** | Waiting on human UAT + approval |
| Phase 1 formal close | **Blocked** | Requires your explicit approval |

---

## Participant roster (fill at kickoff)

| Role | Name | Contact | Device / OS | APK/URL | Checklist done? |
|------|------|---------|-------------|---------|-----------------|
| Buyer 1 | | | | Buyer build **8** | |
| Buyer 2 | | | | Buyer build **8** | |
| Farmer 1 (listing owner) | | | | Farmer build **8** | |
| Farmer 2 | | | | Farmer build **8** | |
| Courier 1 | | | | Courier build **11** | |
| Courier 2 | | | | Courier build **11** | |
| Admin 1 | | | | Admin Web staging | |
| Pilot owner / scribe | | | | — | |

---

## Shared E2E runs

| # | Date | Order ID | Result | Notes |
|---|------|----------|--------|-------|
| Eng-1 | 2026-07-29 | `5d10dd81-b75c-467d-bace-dbf1015fde87` | **PASS** (API) | Staging validation settle + refund |
| Human-1 | | | Pending | |
| Human-2 | | | Pending | |

---

## Session log

_Copy a block per session (or paste details in chat for the agent to file)._

### Session template

```text
Session ID: UAT-YYYYMMDD-#
Date / time (UTC+3):
Facilitator:
Participants (role = name):
Devices (model · OS · app · build):
Scenarios / checklist IDs completed (Pass/Fail/Blocked):
Shared order / shipment IDs:
Evidence (screenshot / log paths or links):
Defects filed (IDs):
Notes / blockers:
Next session focus:
```

| Session ID | Date | Roles covered | Result summary | Defects | Evidence |
|------------|------|---------------|----------------|---------|----------|
| _(none yet)_ | | | | | |

---

## How to report a session (for the agent)

Send a message with:

1. Participants + devices  
2. Checklist IDs completed (from `UAT_CHECKLIST.md`)  
3. Pass / Fail / Blocked per scenario  
4. Order/shipment IDs if any  
5. New defects (or “none”) with severity  
6. Optional: screenshots/logs  

The agent will update `PILOT_PROGRESS.md`, `PILOT_DEFECT_REGISTER.md`, and readiness/report as needed — **without** advancing phases.

---

## Daily log

| Date | Notes |
|------|-------|
| 2026-07-29 | Pilot execution management opened. Engineering pre-UAT gate PASS. |
| 2026-07-29 | **Human UAT execution mode armed.** Standing by for first session evidence. No phase advance. Production recommendation remains **NO GO** until UAT + approval. |
