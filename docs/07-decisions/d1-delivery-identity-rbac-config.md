# D1 — Delivery identity, RBAC, and config

**Status:** Implemented (dev) — apply migrations on staging, then review before D2  
**Date:** 2026-07-23  
**Depends on:** D0 SAD v1.2 · D1–D12 roadmap v1.1  
**Repos:** `nahu-platform` only

---

## 1. What shipped

| Item | Detail |
|------|--------|
| Role | `COURIER` in `identity.roles` |
| Permissions | `delivery.earnings.read`, `delivery.earnings.manage`, `delivery.couriers.manage` |
| Grants | SUPER_ADMIN / PLATFORM_ADMIN: all three; SUPPORT_AGENT: earnings.read + couriers.manage; AUDITOR: earnings.read |
| Feature flags | `delivery.buyer_confirm_required` (on), `delivery.buyer_confirm_from_escrow` (off), `delivery.pickup_pod_required` (off), `delivery.courier_app.enabled` (on), `delivery.analytics.enabled` (on) |
| System settings | `ops.system_settings` table + `delivery.earning.flat_etb` = `0` |
| Analytics readiness | Alert thresholds `delivery.in_transit`, `delivery.pod_pending` |
| OTP | `RegistrationRole.COURIER`; request/verify gated by `delivery.courier_app.enabled` |
| API helper | `DeliveryConfigService` (+ pure `delivery-config.rules`) |

## 2. Migrations

- `identity/026_identity_delivery_phase1_permissions.sql`
- `ops/006_ops_delivery_phase1_config.sql`  
Listed at end of `database/migrations/manifest.json`.

## 3. Staging apply (laptop)

Use **public** Postgres URL only (not `*.railway.internal`):

```sh
# from nahu-platform root, with DATABASE_URL = DATABASE_PUBLIC_URL
node scripts/apply-migrations.mjs
cd apps/api && npx prisma generate
```

Redeploy `nahu-api` after generate/deploy so OTP COURIER is live.

## 4. Smoke checks

1. Admin roles catalog shows new delivery.* permissions (after redeploy).  
2. `POST /api/v1/auth/request-otp` with `{ "phone": "+2519…", "role": "COURIER" }` → OTP sent (dev_otp on staging if bypass enabled).  
3. Verify OTP → JWT `role: COURIER`.  
4. Disable flag `delivery.courier_app.enabled` in Admin System → COURIER OTP returns 403.  
5. Unit: `npm run test:delivery-config-rules` in `apps/api`.

## 5. Explicitly out of D1

Shipments/stops schema, DispatchService, lifecycle event table, Courier Expo app, Admin Delivery UI changes.

## 6. Next

**Pause for review.** On approval → **D2** (schema: shipments as stop collections, geo, POD extensions, availability, immutable earnings, lifecycle_events).
