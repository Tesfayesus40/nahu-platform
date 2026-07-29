# RC1 Pilot Guide

**Release:** `v1.0.0-rc1`  
**Audience:** Pilot participants and pilot owner  
**Companion docs:** [UAT_CHECKLIST.md](./UAT_CHECKLIST.md) · [BUG_REPORT_TEMPLATE.md](./BUG_REPORT_TEMPLATE.md) · [RC1_RELEASE_READINESS.md](./RC1_RELEASE_READINESS.md)

---

## 1. What this pilot is

A **controlled User Acceptance Test** of the coffee marketplace on **staging**:

Buyer browse → checkout → **stub** payment → seller prepare → courier delivery → settlement → admin inspection (optional refund).

**Out of scope for this pilot**

- Live Telebirr / bank cash movement  
- Honey Marketplace or other verticals  
- Push/SMS product notifications beyond OTP  
- AI features  

Payments are **platform ledger stubs**. Treat amounts as test data.

---

## 2. Environment

| Service | URL |
|---------|-----|
| API | https://nahu-api-staging.up.railway.app |
| API v1 | https://nahu-api-staging.up.railway.app/api/v1 |
| Admin Web | https://nahu-admin-web-staging.up.railway.app |
| Health | https://nahu-api-staging.up.railway.app/health/ready |

Mobile APKs are preconfigured to the Nest staging API (not legacy Express).

---

## 3. APK distribution

| App | Version | Build # | Download |
|-----|---------|---------|----------|
| **Buyer** | `1.0.0-rc1` | **8** | https://expo.dev/artifacts/eas/7swdFb_VoWLSYW0HFvAMxlEzPioC7lz5YOaRJdAwU4I.apk |
| **Farmer** | `1.0.0-rc1` | **8** | https://expo.dev/artifacts/eas/lV49Vj4bRwdV0FyNkmWlKNkoKyXLdSDPTvnFW5-1A9Y.apk |
| **Courier** | `1.0.0-rc1` | **11** | https://expo.dev/artifacts/eas/m0O-RyKRKIM7AJ0kATmjpORPkU34110nJTTucQ9bWlw.apk |

Build detail pages (Expo):

- Buyer: https://expo.dev/accounts/tesfayesus/projects/nahu-buna-buyer/builds/5b8cc5ec-ee2c-4002-af45-9e82df25913b  
- Farmer: https://expo.dev/accounts/tesfayesus/projects/nahu-buna-farmer/builds/bc8b41b3-e963-439f-a907-cda9c98904d6  
- Courier: https://expo.dev/accounts/tesfayesus/projects/nahu-buna-courier/builds/754eae6b-d189-47ec-ad14-e943c0ce64e4  

### Installation (Android)

1. On the test phone, open the APK link (Chrome) or transfer the file.  
2. Allow **Install from unknown sources** / that browser if prompted.  
3. Install; open the app.  
4. Confirm version/build if shown in Settings (or note the APK filename/build from this guide).  
5. Log in with the phone number and role assigned by the pilot owner.

**iOS:** Not part of this RC1 APK pilot distribution.

### Known limitations (tell every participant)

1. **Stub payments** — confirming payment does **not** charge a real wallet/bank.  
2. **OTP on staging** — SMS provider may be unset; pilot uses staging OTP policy (`OTP_DEV_BYPASS` → test code **`123456`** unless the pilot owner issues another process).  
3. **Courier earnings** — flat earning may be **0 ETB** on staging (`delivery.earning.flat_etb=0`); zero payout is accepted for this unpaid internal pilot unless ops changes the setting.  
4. **Dynamic delivery fees** — **OFF**; courier delivery fee may be 0 on quotes.  
5. **Maps / Places** — require valid Google key on device builds; offline/poor GPS may affect address UX.  
6. **POD rules** — photo / OTP / recipient may be required depending on flags; follow in-app prompts.  
7. **Language / fonts** — Amharic rendering may vary by device.  
8. **Admin** — MFA (TOTP) required; keep authenticator app available.

---

## 4. Accounts & coordination

Pilot owner assigns:

| Role | Participant | Phone / email | Notes |
|------|-------------|---------------|-------|
| Buyer | | | |
| Farmer (listing owner) | | | Must own an **APPROVED** coffee listing |
| Courier | | | Must set availability **ONLINE** before assign |
| Admin | | | MFA-enrolled workforce account |

**Important:** Seller steps must use the farmer who **owns the listing**, not a random demo farmer without profile/listings.

Suggested shared listing for the pilot: use an Admin-approved ACTIVE coffee listing already on staging (pilot owner confirms ID before day 1).

---

## 5. Role playbooks

### Buyer

1. Install Buyer APK → login (OTP).  
2. Browse coffee → open a listing.  
3. Checkout with quantity + delivery address (NAHU courier path).  
4. Confirm **stub** payment.  
5. Watch order status while Farmer/Courier work.  
6. Confirm delivery when prompted.  
7. File bugs with [BUG_REPORT_TEMPLATE.md](./BUG_REPORT_TEMPLATE.md).

**Expected:** Order created with fee breakdown; payment stub succeeds; tracking moves through fulfillment; delivery confirm works.

### Farmer

1. Install Farmer APK → login.  
2. Find the paid order for your listing.  
3. Accept → Preparing → Ready for pickup.  
4. Confirm pickup when courier arrives (seller side).  
5. Optionally verify listing quantity still makes sense.

**Expected:** Order visible after pay; orchestration advances; pickup confirm accepted.

### Courier

1. Install Courier APK → login.  
2. Set availability **ONLINE**.  
3. Wait for Admin assignment (or accept offer if shown).  
4. Execute pickup → in transit → deliver / POD.  
5. Check earnings screen (may show 0).

**Expected:** Assignment visible only when ONLINE; execution steps succeed; POD gates respected.

### Admin

1. Open Admin Web → MFA login.  
2. Confirm ops dashboard / health.  
3. Inspect the pilot order (fees, payment, fulfillment).  
4. Assign an **ONLINE** courier; optionally reassign (requires reauth password).  
5. After delivery/settle, optionally run a **small** refund with an allowed reason (e.g. `ADMIN_CANCELLATION`) — ledger only.  
6. Skim audit events.

**Expected:** Metrics load; order detail coherent; assign/reassign work; refund updates payment case without live cash.

---

## 6. Pilot plan (recommended)

### Participants

| Role | Count | Rationale |
|------|-------|-----------|
| Buyer | 2–3 | Catch device/OTP/checkout variance |
| Farmer | 2 | Listing owner + one backup |
| Courier | 2 | Availability / POD / device variance |
| Admin | 1–2 | MFA ops path |
| Pilot owner / scribe | 1 | Coordinates shared order IDs & bugs |

**Total:** ~8–10 people (can be fewer if roles are doubled carefully).

### Duration

| Phase | Length | Activity |
|-------|--------|----------|
| Kickoff | 0.5 day | Install APKs, login smoke, assign listing |
| Core UAT | **3–5 business days** | Complete checklist scenarios + ≥2 full E2E runs |
| Bug triage | Overlap + 1 day | Severity, reproduce, decide fix vs defer |
| Sign-off | 0.5 day | Fill checklist sign-off + readiness decision |

### Tasks each participant must complete

- Install correct APK / open Admin URL  
- Complete **all checklist rows for their role**  
- Join **at least one** shared E2E happy path  
- File every S1/S2 immediately; S3/S4 daily batch OK  

### Success criteria (pilot UAT)

1. ≥ **2** independent full E2E paths completed (Buyer→Settle) without S1.  
2. All role checklists completed (or N/A with reason).  
3. **Zero open S1** at sign-off.  
4. Every open **S2** has workaround + owner + target (patch vs post-RC1).  
5. Participants confirm stub-payment limitation understood.  
6. Admin can inspect order + payment timeline + assign courier.

### Go / No-Go for **production** release

| Decision | Criteria |
|----------|----------|
| **No-Go (stay on RC / patch)** | Any open S1; money/status corruption; auth broken; Nest not sole API; migrations incomplete |
| **Go to limited production pilot** | UAT success criteria met; rollback plan reviewed; prod secrets/SMS/backup plan ready; **live Telebirr still optional/deferred** unless separately approved |
| **Go to broad production** | **Not recommended from this RC alone** — requires live payments policy, SMS, monitoring, and ops staffing beyond staging UAT |

**This phase recommends: Ready for Pilot (staging UAT), not Ready for Production.**

---

## 7. Daily stand-up (15 min)

1. Shared order IDs from yesterday  
2. New S1/S2  
3. Blockers (accounts, listings, ONLINE courier)  
4. Plan today’s E2E owner  

---

## 8. After the pilot

1. Pilot owner consolidates bug list.  
2. Eng lead triages vs [BACKLOG.md](./BACKLOG.md).  
3. Update [RC1_RELEASE_READINESS.md](./RC1_RELEASE_READINESS.md) recommendation from UAT evidence.  
4. **Do not** start Telebirr / Honey / notifications / AI until that recommendation is reviewed.
