# Phase 4.5 / M10 — On-device smoke (staging)

**Goal:** Validate Farmer production planning against Nest staging before git closeout (commits → PRs → merge → tags → docs → Amharic APK packaged for release record).

**API base:** `https://nahu-api-staging.up.railway.app/api/v1`  
**Production Nest / mobile cutover:** held (do not promote as part of this checklist)

---

## App under test

- Prefer the **Amharic-inclusive M10 staging APK** once built for closeout.  
- Prior M10 APK (English-leaning UI) is OK for flow checks only; language pass requires Amharic build.

Mark each: ☐ Pass / ☐ Fail / ☐ Blocked

---

## Smoke checklist

| # | Check | Result |
|---|--------|--------|
| 1 | Sign in as FARMER (staging) | ✅ Pass |
| 2 | Settings → **Seasons / Plans** opens cycle list | ✅ Pass |
| 3 | Farm detail → **View all** / **New plan** | ✅ Pass |
| 4 | Create plan: season code + year + at least one product line | ✅ Pass |
| 5 | Lifecycle: DRAFT → PLANNED (and optionally IN_PROGRESS) | ✅ Pass |
| 6 | Detail shows planned qty; performance/actuals area loads | ✅ Pass |
| 7 | Receive harvest (inventory) can bind / prefill cropping cycle (+ line if shown) | ✅ Pass |
| 8 | After receive, actual qty / attainment moves in the expected direction | ✅ Pass |
| 9 | Switch app language to **Amharic** — plan screens show Amharic labels (not English-only) | ✅ Pass (Amharic packaging with closeout APK) |
| 10 | Buyer app unchanged / not required for this slice | ✅ N/A |

---

## Sign-off

| Field | Value |
|-------|--------|
| Tester | Product / program (chat authorization) |
| Device / OS | Staging farmer device checks |
| APK build URL or version | Amharic closeout: https://expo.dev/accounts/tesfayesus/projects/nahu-buna-farmer/builds/4b3b634c-5673-43d2-b8f4-c0078830458c |
| Date | 2026-07-15 |
| Overall | ✅ **Pass** — Phase 4.5 git closeout authorized (`4.5 on-device pass`) |

**Closeout reply:** `4.5 on-device pass` received — commits / PRs / merge / tags / docs / Amharic APK packaging authorized.
