# Delivery Platform — Deployment Checklist (RC1)

**Use:** Staging first. Production only after staging sign-off.

---

## Pre-deploy

- [ ] All D1–D12 migrations applied via manifest (through `delivery/007_delivery_rc1_hardening_indexes.sql`)
- [ ] `prisma generate` / API build green
- [ ] Admin-web build green
- [ ] Courier / Farmer / Buyer apps pointed at staging API
- [ ] Backup staging DB (or snapshot) taken

## Migrations to verify present

- [ ] `identity/026` — COURIER + earnings permissions
- [ ] `ops/006`–`009` — delivery config / dispatch / SLA / POD
- [ ] `delivery/003`–`007` — domain, guards, ARRIVED, settlement types, RC1 indexes
- [ ] Confirm unique index `uq_shipment_earnings_primary_accrual` exists
- [ ] Confirm immutability triggers on `shipment_events` / `shipment_earnings` still active

## Configuration (ops)

- [ ] `delivery.courier_app_enabled` = intended value
- [ ] `delivery.buyer_confirm_required` = intended value
- [ ] POD flags: OTP / photo / GPS / recipient as agreed
- [ ] `delivery.earning.flat_etb` set
- [ ] Dispatch max active shipments / zone settings reviewed
- [ ] SLA / alert thresholds reviewed (D9)

## Roles

- [ ] Test SUPER_ADMIN / PLATFORM_ADMIN can manage delivery + earnings
- [ ] SUPPORT_AGENT has `delivery.read` + earnings read
- [ ] AUDITOR read-only paths
- [ ] Courier OTP login works when flag on

## Post-deploy smoke (staging)

- [ ] Admin ops dashboard loads
- [ ] Release → assign → accept → execute → POD → complete → earning ELIGIBLE
- [ ] Admin approve earning (reauth)
- [ ] Courier Earnings tab shows totals
- [ ] Farmer/Buyer tracking shows consistent status labels

## Rollback considerations

1. **Feature flags first** — disable courier app / POD requirements if incident.
2. **Do not** reverse-migrate unique indexes while concurrent accruals run.
3. API rollback: redeploy previous image; additive migrations stay.
4. If bad accrual rows: append `REVERSAL` via Admin (never UPDATE).

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | | |
| Ops | | |
| Architecture | | |
