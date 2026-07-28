# Courier RC1 Completion Report

Date: 2026-07-27  
Scope: Profile, KYC (+ Admin review), Vehicles, Plate validation, Payout accounts, Notifications inbox, Settings, placeholder purge.

## Completed features

1. **Driver profile** — editable photo, names, email, gender, DOB, emergency contact, language; phone read-only; persisted via `PATCH /delivery/courier/me`.
2. **Identity verification** — National ID / Driving Licence / Passport; front/back/selfie upload; submit; status Not Submitted / Pending / Approved / Rejected(+reason); Admin Portal queue approve/reject.
3. **Vehicles** — multi-vehicle CRUD, activate, photo; Ethiopian plate normalize/validate + unique plate.
4. **Payout methods** — bank/Telebirr/CBE/Chapa/Commercial Bank storage; default flag; edit/delete; earnings ledger as payout history.
5. **Notifications** — `courier_notifications` + REST + emitters on assign/accept/pickup/transit/complete/payment/KYC; inbox with mark read/all, delete, filter, refresh, tab badge.
6. **Settings** — language, dark-mode preference, notification prefs, privacy/terms/help/support, logout.
7. **POD photo** — camera/gallery upload via `expo-image-picker` (no more URL-only placeholder).
8. **Placeholder purge** — removed orphan Settings/Availability/Inbox screens; removed fake earnings KPIs and coming-soon profile rows.

## New backend APIs

| Method | Path |
|--------|------|
| PATCH | `/delivery/courier/me` |
| PATCH | `/delivery/courier/me/notification-prefs` |
| GET/POST | `/delivery/courier/verification` |
| GET/POST/PATCH/DELETE | `/delivery/courier/vehicles` (+ `/:id/activate`) |
| GET/POST/PATCH/DELETE | `/delivery/courier/payout-accounts` |
| GET/POST/DELETE | `/delivery/courier/notifications` (+ read / read-all) |
| POST | `/uploads/courier-media` |
| GET/POST | `/admin/delivery/courier-verifications` (+ approve/reject) |
| POST | `/admin/delivery/courier-announcements` |

Extended: `UpdateMeDto` (lastName, email, preferredLanguage).

## Database changes

Migration: `database/migrations/delivery/008_delivery_courier_crm.sql` (applied on staging).

- Extended `delivery.courier_profiles`
- `delivery.courier_vehicles`
- `delivery.courier_payout_accounts`
- `delivery.courier_verification_cases` + `courier_verification_documents`
- `delivery.courier_notifications`

UAT wipe SQL updated to truncate these tables.

## Mobile screens modified / added

**Added:** EditProfile, IdentityVerification, Vehicles, VehicleForm, PayoutMethods, PayoutForm, AppSettings, CourierMediaPicker  
**Reworked:** Profile, Notifications, PodCapture, AppNavigator, api.js  
**Deleted orphans:** SettingsScreen, AvailabilityScreen, InboxScreen  
**Deps:** `expo-image-picker`, `expo-constants`

## Admin Web

- `/delivery/verifications` queue + detail approve/reject
- Nav tab “Courier KYC”
- BFF proxies under `/api/delivery/courier-verifications`

## Manual UAT checklist

### Profile
- [ ] Login as courier → Profile → Edit profile → save names/email/photo → reload persists
- [ ] Phone field is read-only

### KYC
- [ ] Submit National ID with front/back/selfie → status Pending
- [ ] Admin Portal → Delivery → Courier KYC → Approve → courier sees Approved
- [ ] Reject with reason → courier sees Rejected + reason; can resubmit

### Vehicles
- [ ] Add motorcycle with plate `AA-12345` → active
- [ ] Duplicate plate rejected
- [ ] Edit / set active / delete

### Payout
- [ ] Add Telebirr with +2519… → default
- [ ] Add bank account with account number
- [ ] Edit / delete; ledger section loads

### Notifications
- [ ] Admin assigns shipment → courier gets SHIPMENT_ASSIGNED (+ pickup reminder)
- [ ] Accept → SHIPMENT_ACCEPTED
- [ ] Mark read / mark all / delete / unread filter / badge

### Settings
- [ ] Toggle language; notification prefs persist; privacy/terms open; logout works

### Shipments (regression)
- [ ] Accept → pickup → transit → arrived → POD photo → delivered → complete still works

## Deferred to RC2 (intentionally)

- Live Maps SDK / ETA / map-radius matching (decorative map remains)
- POD signature pad, QR scan, offline queue
- Expo push notifications (device tokens) — in-app inbox only for RC1
- Live payout rails (Telebirr/Chapa disbursement)
- Full dark-theme polish (preference stored; chrome still light)

## RC1 readiness

See **`docs/08-guides/courier-rc1-final-readiness-report.md`** for the gate result.

**Staging deploy (2026-07-27):** `nahu-api` + `nahu-admin-web` SUCCESS; CRM routes return 401 (not 404); migration `008` verified; authenticated CRM smoke 13/13; APK v7 built.

**Verdict:** CRM implementation is live on staging, but **not** declared Production Ready until device UAT + full delivery E2E complete.
