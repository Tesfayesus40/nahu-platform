# Phase 4.8 / M13 — On-device smoke (staging)

**Goal:** Validate Farmer farm activities (ops log) against Nest staging before git closeout.

**API base:** `https://nahu-api-staging.up.railway.app/api/v1`  
**Production Nest / mobile cutover:** held

---

## Backend smoke

| # | Check | Result |
|---|--------|--------|
| 1 | Staging maps FarmActivitiesController routes | ✅ Pass |
| 2 | `GET /activity-types` returns seed codes | ✅ Pass (9 types) |
| 3 | Create COMPLETED farm activity | ✅ Pass |
| 4 | List farm activities | ✅ Pass |
| 5 | Cancel / same-day delete policy | ✅ Pass (cancel + PLANNED delete; same-UTC-day COMPLETED) |
| 6 | Inventory balances unchanged by activity create | ✅ Pass (no inventory calls on create) |

---

## On-device checklist

| # | Check | Result |
|---|--------|--------|
| 1 | Sign in as FARMER (staging) | ✅ Pass |
| 2 | Settings → **Activities** | ✅ Pass |
| 3 | Log activity (type + date) | ✅ Pass |
| 4 | Optional plan bind from form / plan detail | ✅ Pass |
| 5 | Farm detail entry works | ✅ Pass |
| 6 | Cancel / delete per policy | ✅ Pass |
| 7 | Harvest / Inventory / Dashboard still work | ✅ Pass |
| 8 | Buyer unchanged | ☐ N/A |

---

## Sign-off

| Field | Value |
|-------|--------|
| Tester | Product owner (on-device) |
| APK build URL | https://expo.dev/accounts/tesfayesus/projects/nahu-buna-farmer/builds/0fb1baf8-30df-4fcd-8957-cbd662d67a2e |
| Date | 2026-07-16 |
| Overall | ✅ **Pass** — authorized by `4.8 on-device pass` |

**Closeout:** Phase 4.8 git closeout authorized. Production Nest / mobile cutover remains **held**.
