# Phase 4.7 / M12 — On-device smoke (staging)

**Goal:** Validate Farmer harvest sessions (DRAFT → Post → Inventory RECEIVE) against Nest staging before git closeout (commits → PRs → merge → tags → docs).

**API base:** `https://nahu-api-staging.up.railway.app/api/v1`  
**Production Nest / mobile cutover:** held (do not promote as part of this checklist)

---

## Backend smoke (completed 2026-07-15)

| # | Check | Result |
|---|--------|--------|
| 1 | Staging deploy maps HarvestController routes | ✅ Pass |
| 2 | Create DRAFT session + line | ✅ Pass |
| 3 | List farm harvest sessions | ✅ Pass |
| 4 | Post → Inventory RECEIVE + `stockLotId` on line | ✅ Pass |
| 5 | Delete DRAFT only | ✅ Pass |

---

## App under test

- **M12 staging APK:** https://expo.dev/accounts/tesfayesus/projects/nahu-buna-farmer/builds/29c29828-5641-4731-96ac-162e60b29a0f  
- Amharic labels via `harvestI18n.js` (unicode-safe). Broader Amharic cleanup remains a separate follow-up.

---

## On-device smoke checklist

| # | Check | Result |
|---|--------|--------|
| 1 | Sign in as FARMER (staging) | ✅ Pass |
| 2 | Settings → **Harvest** opens session list | ✅ Pass |
| 3 | Farm detail → **Record harvest** / View all harvest | ✅ Pass |
| 4 | Plan detail → **Record harvest** opens new session (prefills farm/plan) | ✅ Pass |
| 5 | Create draft: date + product + qty; opens detail | ✅ Pass |
| 6 | Detail shows DRAFT; **Post to inventory** succeeds | ✅ Pass |
| 7 | Inventory lot appears / qty moves after post | ✅ Pass |
| 8 | Posted session cannot be deleted from UI; draft delete works | ✅ Pass |
| 9 | Amharic toggle: harvest labels show Amharic | ✅ Pass (M12 harvest strings; broader Amharic cleanup deferred) |
| 10 | Buyer app unchanged / not required | ✅ N/A |

---

## Sign-off

| Field | Value |
|-------|--------|
| Tester | Product / program (chat authorization) |
| Device / OS | Staging farmer device checks |
| APK build URL or version | https://expo.dev/accounts/tesfayesus/projects/nahu-buna-farmer/builds/29c29828-5641-4731-96ac-162e60b29a0f |
| Date | 2026-07-16 |
| Overall | ✅ **Pass** — Phase 4.7 git closeout authorized |

**Closeout:** On-device validation received — commits / PRs / merge / tags / docs authorized. Production held. Amharic cleanup remains a separate follow-up.
