# Phase 4.6 / M11 — On-device smoke (staging)

**Goal:** Validate Farmer Home ops dashboard against Nest staging before git closeout.

**API base:** `https://nahu-api-staging.up.railway.app/api/v1`  
**Production Nest / mobile cutover:** held

---

## App under test

- M11 staging APK: https://expo.dev/accounts/tesfayesus/projects/nahu-buna-farmer/builds/8d623dff-687c-4a69-9f03-1cae7d213859

| # | Check | Result |
|---|--------|--------|
| 1 | Sign in as FARMER (staging) | ✅ Pass |
| 2 | Home shows **Operations** section (soft-fail OK if empty farms) | ✅ Pass |
| 3 | Farm / Inventory / Marketplace / Production cards render | ✅ Pass |
| 4 | Production empty-state or attainment when plans exist | ✅ Pass |
| 5 | Alerts area (or empty) — no escrow/money on Home | ✅ Pass |
| 6 | Existing Home actions (listings, orders, earnings) still work | ✅ Pass |
| 7 | Buyer app unchanged | ✅ N/A |

---

## Sign-off

| Field | Value |
|-------|--------|
| Tester | Product / program (chat authorization) |
| APK | https://expo.dev/accounts/tesfayesus/projects/nahu-buna-farmer/builds/8d623dff-687c-4a69-9f03-1cae7d213859 |
| Date | 2026-07-15 |
| Overall | ✅ **Pass** — Phase 4.6 git closeout authorized (`4.6 on-device pass`) |
