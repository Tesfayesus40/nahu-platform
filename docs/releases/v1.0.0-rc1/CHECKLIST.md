# Release checklist — v1.0.0-rc1

Use before declaring the pilot open. Mark each item when verified on **staging**.

## Database migrations

- [ ] Manifest apply completed (ledger checksums match)
- [ ] Includes `delivery/009`, `payments/001`, `identity/029`, `ops/013`
- [ ] Matches [migration-manifest.frozen.json](./migration-manifest.frozen.json)
- [ ] `delivery.dynamic_fee.enabled` is **OFF**
- [ ] `delivery.earning.flat_etb` set or zero-payout accepted in writing

## Docker / API

- [ ] Image builds from root `Dockerfile`
- [ ] Container starts; `GET /health/live` → 200
- [ ] `GET /health/ready` → 200 with DB up; 503 with DB down
- [ ] `/api/v1` routes reachable

## Environment variables

- [ ] `JWT_SECRET` strong (not example default)
- [ ] `ADMIN_MFA_ENCRYPTION_KEY` set when `NODE_ENV=production`
- [ ] `CORS_ORIGINS` includes Admin Web
- [ ] `PUBLIC_API_URL` correct
- [ ] Staging OTP policy documented (`OTP_DEV_BYPASS` or real SMS)

## CI

- [ ] Platform CI green on release commit (`test:rules`, API+Admin build)
- [ ] Gebaya `npm test` green
- [ ] Smoke job documented (`workflow_dispatch` + secrets)

## Staging deployment

- [ ] Nest API deployed (Railway or equivalent)
- [ ] Admin Web pointed at Nest
- [ ] Buyer / Farmer / Courier builds use Nest staging URL
- [ ] Nest-only confirmed (no Express)

## Smoke tests

- [ ] Readiness probe OK
- [ ] Optional `pilot-e2e-smoke.cjs` run once with tokens **or** manual path below signed off
- [ ] Manual pilot path: [PILOT-VERIFICATION.md](./PILOT-VERIFICATION.md)

## Rollback

- [ ] Previous image / deployment identified
- [ ] Rollback steps reviewed ([DEPLOYMENT.md](./DEPLOYMENT.md) §8)
- [ ] On-call knows: do not casually reverse additive migrations

## Version freeze / tags

- [ ] Versions set to `1.0.0-rc1` on API, Admin, Buyer, Farmer, Courier
- [ ] Release docs committed
- [ ] Tags created per [TAGGING.md](./TAGGING.md) (`v1.0.0-rc1` on both repos)
- [ ] Freeze announced to team ([VERSION-FREEZE.md](./VERSION-FREEZE.md))

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Eng lead | | | |
| Ops | | | |
| Pilot owner | | | |
