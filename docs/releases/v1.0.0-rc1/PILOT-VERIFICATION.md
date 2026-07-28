# Pilot verification — v1.0.0-rc1

**Rule:** Walk this path on staging. **No code changes** unless a defect is found; log defects under Post-RC1 in [BACKLOG.md](./BACKLOG.md).

```
Buyer → Checkout → Payment → Seller → Courier → Delivery → Settlement → Admin inspection → Refund
```

## 1. Buyer

- [ ] OTP login (BUYER)
- [ ] Browse approved coffee listings
- [ ] Open listing detail

## 2. Checkout

- [ ] Platform fees load from `/pricing/active` (no invented %)
- [ ] Quantity + delivery method + address as required
- [ ] Place order succeeds; fee snapshot present on order

## 3. Payment

- [ ] Simulated / stub confirm-payment
- [ ] Order / payment case moves toward **ESCROWED** (platform ledger — not live bank cash)
- [ ] Intent responses labelled stub where exposed

## 4. Seller (Farmer)

- [ ] OTP login (FARMER)
- [ ] See order; seller-accept (G8)
- [ ] Preparing → ready-for-pickup
- [ ] Pickup location available if courier path

## 5. Courier

- [ ] OTP login (COURIER); availability ONLINE
- [ ] Assignment / accept (as configured)
- [ ] Execution through pickup → transit → delivery / POD
- [ ] Earnings: flat ETB or expected zero

## 6. Delivery

- [ ] Dual pickup confirm (seller + courier) when required
- [ ] Dual delivery confirm (courier + buyer) when required
- [ ] Buyer / farmer tracking views consistent with status

## 7. Settlement

- [ ] Admin or orchestration settle after delivery confirm
- [ ] Settlement lines match Revenue Engine snapshot (farmer / courier / platform)

## 8. Admin inspection

- [ ] `/admin/ops/dashboard` and `/admin/ops/health` (or Admin Web equivalents)
- [ ] Order inspection / timeline for the pilot order
- [ ] Payment case escrow + settlement status visible
- [ ] Stub settlement note understood by ops

## 9. Refund

- [ ] Dispute or admin refund path as designed for RC1
- [ ] Refund status updates; escrow refunded amounts coherent
- [ ] No assumption of live provider money movement

## Defect log (copy into BACKLOG Post-RC1)

| ID | Step | Severity | Summary | Owner |
|----|------|----------|---------|-------|
| | | | | |

## Result

- [ ] Pilot path **PASS** — ready for broader UAT  
- [ ] Pilot path **FAIL** — blockers listed above; patch only
