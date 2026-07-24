# Delivery Platform RC1 — Production Readiness Review

**Date:** 2026-07-24  
**Constraint:** No business logic changes (freeze)  
**Companion:** `d12-delivery-deployment-checklist.md`, `delivery-rc1-feature-freeze.md`

---

## 1. Environment configuration

| Item | Expectation | Notes |
|------|-------------|-------|
| API `DATABASE_URL` | Staging/prod Postgres with delivery schema | Apply migrations via manifest |
| JWT / Admin session secrets | Distinct per env | Rotate on incident |
| CORS / mobile API base URL | Apps point at correct env | Courier never calls `/admin/*` |
| Upload / photo URL storage | POD photo URLs resolvable | No new storage in RC1 |

## 2. Feature flags (review before go-live)

| Flag / setting | Default intent | Action |
|----------------|----------------|--------|
| `delivery.courier_app.enabled` | On for staging RC1 | Confirm |
| `delivery.buyer_confirm_required` | Agree policy (true blocks courier complete) | Confirm |
| `delivery.pod.otp_required` | Usually true | Confirm |
| `delivery.pod.photo_required` | Usually true | Confirm |
| `delivery.pod.gps_required` | Usually false | Confirm |
| `delivery.pod.recipient_required` | Usually true | Confirm |
| `delivery.earning.flat_etb` | Non-zero ETB | Confirm |
| `delivery.dispatch.max_active_shipments` | Capacity | Confirm |
| SLA hours (in-transit / POD pending) | D9 thresholds | Confirm |

**Incident lever:** disable `delivery.courier_app.enabled` before schema rollback.

## 3. Migrations & indexes

Must be applied through:

`delivery/003` … `delivery/007`, `ops/006`–`009`, `identity/026`

Critical RC1 objects:

- Immutability triggers on `shipment_events` / `shipment_earnings` (`004`)
- Settlement type/status CHECKs (`006`)
- `uq_shipment_earnings_primary_accrual`
- `uq_shipment_earnings_reference`
- `idx_shipments_status_updated`
- `idx_shipment_earnings_replaces`
- `idx_shipment_events_shipment_type`

## 4. Logging & monitoring

| Area | RC1 state |
|------|-----------|
| Audit events | Privileged Admin mutations (dispatch, earnings, cancel/retry) |
| Ops dashboard | Metrics + alert thresholds (D9) |
| Domain events | Canonical `shipment_events`; in-process fan-out |
| Application logs | Nest defaults — no delivery-specific APM added in freeze |

**Gap (accepted):** no transactional outbox / push pipeline yet.

## 5. Rollback plan

1. Feature-flag disable (courier app / tighten POD).  
2. Redeploy previous API/Admin images (additive SQL stays).  
3. Financial corrections via Admin **REVERSAL** rows — never UPDATE ledger.  
4. Do not drop unique indexes under concurrent accrual.

## 6. Deployment sequence (recommended)

1. Backup / snapshot DB  
2. Apply migrations (manifest order through `007`)  
3. Deploy API  
4. Deploy Admin web  
5. Point mobile apps (or publish builds) at env  
6. Smoke: release → assign → accept → POD → complete → earning → approve  
7. Confirm Farmer/Buyer tracking  
8. Sign staging report → production only after sign-off  

## 7. Readiness verdict

| Gate | Status |
|------|--------|
| Architecture approved | Yes |
| Feature freeze active | Yes |
| Automated regression | Pass |
| Architecture verification | Pass (documented deviations) |
| Live staging E2E sign-off | **Pending operator** |
| Production cutover | **No-go until live staging signed** |
