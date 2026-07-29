# RC1 Release Readiness Report

**Document:** `RC1_RELEASE_READINESS.md`  
**Release:** `v1.0.0-rc1`  
**Date:** 2026-07-29  
**Phase:** Phase 3 – Pilot UAT Preparation  
**Authoritative prior evidence:** [RC1_STAGING_VALIDATION.md](./RC1_STAGING_VALIDATION.md)

---

## Recommendation

### **Ready for Pilot**

| Option | Status |
|--------|--------|
| Ready for Pilot (controlled staging UAT) | **YES — recommended now** |
| Ready for Production | **NO** |
| Additional RC required before pilot | **NO** (pilot can proceed; see risks) |

Wait for **pilot/UAT results** before choosing the next development cycle (including Telebirr). Do **not** start Honey, notifications, or AI from this gate.

---

## 1. Current release status

| Area | Status |
|------|--------|
| Product freeze / tags | `v1.0.0-rc1` on `nahu-platform` + `nahu-buna-gebaya` |
| CI | Platform CI green after lint/admin type recovery |
| Staging API | Deployed; `/health/live` + `/health/ready` OK |
| Staging Admin Web | Deployed after route-slug hotfix |
| Migrations | Through **`ops/013`** (manifest current) |
| Automated smoke | Buyer→pay→fulfill→settle→refund path verified on staging |
| Mobile APKs | Buyer 8 · Farmer 8 · Courier 11 (`1.0.0-rc1`) |
| UAT materials | [PILOT_GUIDE.md](./PILOT_GUIDE.md) · [UAT_CHECKLIST.md](./UAT_CHECKLIST.md) · [BUG_REPORT_TEMPLATE.md](./BUG_REPORT_TEMPLATE.md) |

Staging tip includes RC1 tag **plus** necessary hotfixes (CI lint/types, migration SQL, admin slug, smoke harness). Product behaviour matches RC1 intent; artifact hashes are not identical to the annotated tag alone.

---

## 2. Staging security actions completed (Phase 3)

| Action | Result |
|--------|--------|
| Temporary smoke admin password (`Rc1Smoke!Validate26`) | **Rotated / invalidated** — old password rejected |
| Smoke admin sessions | **Revoked** |
| Smoke admin `mfa_required` | **Re-enabled (`true`)**; TOTP factor active |
| `NODE_ENV` | Set to **`production`** on staging API (was `development`) |
| `OTP_DEV_BYPASS` | **Left `true` intentionally** — no `AT_API_KEY` / `AT_USERNAME` on staging; pilot OTP = `123456` |
| `delivery.dynamic_fee.enabled` | Confirmed **OFF** |
| `delivery.earning.flat_etb` | **`0`** (zero courier flat payout accepted for unpaid pilot) |

Pilot Admin access should use **MFA-enrolled** workforce accounts (e.g. primary SUPER_ADMIN), not the rotated smoke password.

---

## 3. Staging vs intended production (remaining differences)

| Topic | Staging (pilot) | Production (target) |
|-------|-----------------|---------------------|
| OTP | `OTP_DEV_BYPASS=true` → code `123456` | Real SMS (`AT_*`) or equivalent; bypass **off** |
| Payments | Stub Telebirr / ledger escrow | Live provider (Telebirr etc.) — **not in RC1** |
| `NODE_ENV` | `production` | `production` |
| Data | Staging / UAT data | Isolated prod DB + backups |
| Courier earnings | Flat **0** unless changed | Non-zero policy if paid couriers |
| Dynamic delivery fee | OFF | OFF until routing mature |
| Mobile distribution | Internal EAS APKs | Store / managed distribution as approved |
| Observability | Railway logs + admin monitoring | Full on-call, alerts, backups SLA |
| Admin bootstrap | Existing MFA admins | Hardened invite + break-glass procedure |

---

## 4. Remaining risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Participants confuse stub pay with real money | Medium | Brief every tester; guide limitation section |
| Wrong farmer account (no listing ownership) | Medium | Pilot owner assigns listing owner phone |
| Courier OFFLINE → assign fails | Medium | Checklist: go ONLINE before assign |
| POD flag friction (photo/OTP/recipient) | Medium | Walk POD once in kickoff |
| Staging OTP bypass in screenshots / leaks | Low–Med | Treat `123456` as staging-only; disable before prod |
| Zero courier earnings surprises testers | Low | Documented; optional ops tune of `flat_etb` |
| Post-tag hotfixes not in annotated tag | Low | Documented; optional `rc1.1` retag later |
| Maps key / GPS issues on devices | Medium | Confirm Google key; indoor fallback addresses |

---

## 5. Known limitations (RC1)

1. No live payment provider settlement.  
2. Staging OTP bypass (no Africa’s Talking keys).  
3. Dynamic delivery pricing disabled.  
4. Courier flat earning currently 0 on staging.  
5. Coffee vertical only.  
6. Android APK pilot focus (no iOS RC1 package in this pack).  
7. Notifications / AI / Honey explicitly deferred.

---

## 6. Required actions before **production**

*Not required to start staging pilot UAT; required before production Go:*

1. Disable `OTP_DEV_BYPASS`; configure real SMS.  
2. Production secrets rotation (`JWT_SECRET`, MFA key, DB).  
3. Production migration apply through `ops/013` on prod DB.  
4. Payment provider decision (Telebirr live) + reconciliation runbook — **separate approval**.  
5. Non-zero courier earning policy if couriers are paid.  
6. Backup / rollback drill on prod.  
7. Close all S1 and agreed S2 from UAT.  
8. Legal/ops acceptance of stub→live payment cutover.  
9. Confirm Nest-only cutover (no Express).  

---

## 7. Pilot success → next gate

After UAT sign-off in [UAT_CHECKLIST.md](./UAT_CHECKLIST.md):

| UAT outcome | Next action |
|-------------|-------------|
| Success criteria met | Decide: limited prod pilot vs patch RC vs live-payments project |
| S1 remains | Patch / additional RC — **no** new product streams |
| Only S3/S4 | May proceed to limited prod planning with backlog |

**Do not** start Telebirr, Honey, notifications, or AI until this readiness doc is updated with UAT results and an explicit go decision.

---

## 8. Sign-off (preparation complete)

| Role | Name | Date | Prep complete? |
|------|------|------|----------------|
| Eng lead | | | |
| Ops | | | |
| Pilot owner | | | |

**Preparation verdict:** Staging secured for pilot · materials ready · APKs distributed via [PILOT_GUIDE.md](./PILOT_GUIDE.md) · **Ready for Pilot UAT**.
