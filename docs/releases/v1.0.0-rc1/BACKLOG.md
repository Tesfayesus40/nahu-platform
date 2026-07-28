# Backlog after v1.0.0-rc1

Two lists only. No new capabilities in the RC1 freeze window.

---

## Post-RC1

Critical bugs found during pilot. Fill during / after [PILOT-VERIFICATION.md](./PILOT-VERIFICATION.md).

| ID | Severity | Summary | Found at step | Status |
|----|----------|---------|---------------|--------|
| _(none yet)_ | | | | |

Process: fix on freeze branch → patch tag if needed (`v1.0.0-rc1.1`) → re-run affected pilot steps.

---

## RC2 Candidates

Deferred product tracks — start **only** after tagged RC1 + successful pilot.

### Track A — Real payment integrations

- Telebirr  
- CBE Birr  
- Chapa  

Replace stubs with live authorize/capture/refund; keep escrow/settlement orchestration.

### Track B — Notification platform

- Push  
- SMS (beyond OTP)  
- Email  

### Track C — Activate Honey Marketplace

First proof that the generic marketplace architecture can launch a **second vertical** without major code changes.

### Other candidates (non-blocking ideas)

- Device E2E (Detox/Maestro)  
- OpenAPI / contract docs  
- Global throttler hardening (PR-H9)  
- Finance ledger / tax  
- Automated refund policy engine  

---

## Out of scope for RC1

- New capabilities  
- Architecture changes  
- Database redesign  
- UI redesign  
- Live payments / Honey / full notifications (above tracks)
