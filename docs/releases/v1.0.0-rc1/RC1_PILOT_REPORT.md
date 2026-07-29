# RC1 Pilot Report

**Document:** `RC1_PILOT_REPORT.md`  
**Release:** `v1.0.0-rc1`  
**Date:** 2026-07-29  
**Phase:** Phase 1 – RC1 Pilot & UAT  
**Authoritative inputs:** [RC1_STAGING_VALIDATION.md](./RC1_STAGING_VALIDATION.md) · [RC1_RELEASE_READINESS.md](./RC1_RELEASE_READINESS.md) · [PILOT_DEFECT_REGISTER.md](./PILOT_DEFECT_REGISTER.md) · [PILOT_PROGRESS.md](./PILOT_PROGRESS.md)

---

## Recommendation

### **NO GO** (for production `v1.0.0` and for declaring Phase 1 formally complete)

| Decision | Verdict |
|----------|---------|
| Close Phase 1 as complete? | **No** |
| Proceed to Phase 2 (production deploy)? | **No — blocked** |
| Proceed with **human device UAT** on staging? | **Yes — recommended immediately** |
| Engineering pre-UAT gate | **Pass** |

**Why NO GO:** Phase 1 exit criteria require signed human UAT ([UAT_CHECKLIST.md](./UAT_CHECKLIST.md)). That participant execution has **not** been completed. Staging/engineering validation alone is necessary but not sufficient to approve production.

Do **not** begin Phase 2, `v1.0.x` feature work, `v1.1`, or `v2.0` until Phase 1 is formally approved after UAT (or an approved exception is recorded in the master roadmap).

---

## 1. Pilot summary

RC1 reached a **controlled staging ready-for-pilot** state:

- Tagged `v1.0.0-rc1` on platform + mobile repos  
- Staging API + Admin Web healthy  
- Migrations through `ops/013`  
- Full coffee money path verified via API (browse → order → stub pay → seller → courier → settle → refund)  
- Pilot materials and APKs published  
- Staging smoke credentials rotated; `NODE_ENV=production`; OTP bypass retained intentionally for staging without SMS  

**What remains for Phase 1:** execute and sign the **human** pilot (Buyer / Farmer / Courier / Admin on devices), file UAT defects, triage to zero open Critical, then re-issue this report with an updated recommendation.

---

## 2. Participants

### Engineering / staging validation

| Role | Who | Notes |
|------|-----|-------|
| Automation / ops validation | Release execution (2026-07-29) | API smoke + admin ops probes |
| Accounts used | Staging OTP users (buyer/farmer/courier) + MFA admin | Not a substitute for named pilot users |

### Formal UAT roster

| Role | Assigned participants | Status |
|------|----------------------|--------|
| Buyer / Farmer / Courier / Admin | **None recorded** | Kickoff pending — see [PILOT_PROGRESS.md](./PILOT_PROGRESS.md) |

---

## 3. Test scenarios completed

### Completed (engineering / staging)

| Scenario | Result |
|----------|--------|
| Health live/ready | Pass |
| Buyer browse approved listing | Pass |
| Checkout + fee snapshot | Pass |
| Stub Telebirr confirm-payment → escrow | Pass |
| Seller accept → prepare → ready | Pass |
| Courier ONLINE + admin assign | Pass |
| Dual pickup / transit / dual delivery | Pass |
| Settlement (auto on dual confirm) | Pass |
| Admin order inspect + payment timeline | Pass |
| Admin refund (ledger) | Pass |
| Ops dashboard / health / sellers / audit list | Pass |
| Courier reassignment (reauth) | Pass |
| APK builds Buyer 8 / Farmer 8 / Courier 11 | Pass |

Canonical engineering order: `5d10dd81-b75c-467d-bace-dbf1015fde87`

### Not completed (human UAT checklist)

All device checklist rows in [UAT_CHECKLIST.md](./UAT_CHECKLIST.md) (B1–B9, C1–C8, D1–D8, E1–E10, shared human E2E ×2, sign-off table) — **Pending**.

---

## 4. Defects found

See [PILOT_DEFECT_REGISTER.md](./PILOT_DEFECT_REGISTER.md).

| Sev | Found | Notes |
|-----|-------|-------|
| Critical | 2 | Both **resolved** (migration SQL; Admin slug) |
| High | 1 | Smoke admin credential risk — **resolved** (rotated) |
| Medium | 2 | Smoke harness + NODE_ENV — **resolved** |
| Low | 4 | 1 open doc item (fulfillment vs shipment id); others accepted/resolved |

No Critical or High defects remain open from staging validation.  
**Zero defects** filed from human device UAT (not run).

---

## 5. Defects resolved

| ID | Sev | Resolution |
|----|-----|------------|
| STG-01 | Critical | `744c510` + staging migrate |
| STG-02 | Critical | `744c510` + Admin redeploy |
| STG-03 | Medium | `a133a3e` |
| STG-07 | Low | Migrations caught up |
| STG-08 | Medium | `NODE_ENV=production` |
| STG-09 | High | Admin password rotate + MFA + session revoke |

---

## 6. Outstanding issues

1. **Formal human UAT not executed** (Phase 1 blocker).  
2. STG-05 — document/ops clarity on fulfillment id vs shipment id (Low).  
3. Staging **OTP_DEV_BYPASS** still on (intentional; must be off before production).  
4. **No live payments / SMS** — expected for RC1; production gap.  
5. Courier flat earning **0** on staging — accepted for unpaid pilot.  
6. Staging tip includes post-tag hotfixes — optional `rc1.1` retag later.  
7. Participant roster empty — pilot owner must fill [PILOT_PROGRESS.md](./PILOT_PROGRESS.md).

---

## 7. Lessons learned

1. Staging DBs can lag tagged code — always apply migration manifest before pilot.  
2. Admin Web dynamic route slug consistency is a deploy-time footgun in Next.js.  
3. Smoke harnesses must match live DTO contracts (`TELEBIRR`, nested `order.id`).  
4. Listing-owner identity matters more than “any FARMER” demo account.  
5. Dual delivery confirm can auto-settle — treat SETTLED as success even if explicit settle returns 400.  
6. Temporary validation credentials must be rotated before broader UAT (done).  
7. Engineering PASS ≠ Phase 1 complete without signed human UAT.

---

## 8. Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Declaring GO without device UAT | High | This report: **NO GO** until checklist sign-off |
| Stub payment misunderstood as live | Medium | Pilot briefing |
| OTP bypass leaked into prod habits | Medium | Disable before Phase 2 |
| Device/maps/POD friction unseen in API smoke | Medium | Human UAT required |
| Empty participant roster delays Phase 1 | High | Kickoff within pilot guide timeline |

---

## 9. Release readiness (current)

| Item | Status |
|------|--------|
| Ready for **human pilot on staging** | **Yes** |
| Ready for **production v1.0.0** | **No** |
| Phase 1 formally complete | **No** |
| Next roadmap phase authorized | **No** |

Living board: [PROJECT_ROADMAP.md](../../../PROJECT_ROADMAP.md)

---

## 10. Required next actions (to finish Phase 1)

1. Assign pilot owner + fill participant roster.  
2. Distribute APKs / Admin URL per [PILOT_GUIDE.md](./PILOT_GUIDE.md).  
3. Execute UAT checklist; log defects in register.  
4. Complete ≥2 human shared E2E runs.  
5. Reach **0 open Critical**; document any open High with workaround.  
6. Sign UAT checklist.  
7. **Re-issue** this pilot report with updated recommendation (`GO` / `GO WITH MINOR FIXES` / `NO GO`).  
8. Only then seek approval to enter Phase 2.

---

## 11. Sign-off (this report)

| Role | Name | Date | Agrees with NO GO pending human UAT? |
|------|------|------|--------------------------------------|
| Eng lead | | | |
| Ops | | | |
| Pilot owner | | | |

**Report verdict:** Engineering pre-UAT **PASS** · Phase 1 / Production **NO GO** until human UAT completion and approval.
