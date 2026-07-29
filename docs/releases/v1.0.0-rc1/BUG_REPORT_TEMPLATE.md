# RC1 Bug Report Template

**Release:** `v1.0.0-rc1`  
**Copy this template** for each defect. One bug per report.

---

## Metadata

| Field | Value |
|-------|-------|
| **Bug ID** | RC1-UAT-___ |
| **Date** | YYYY-MM-DD |
| **Reporter** | |
| **App** | Buyer / Farmer / Courier / Admin Web / API |
| **App version** | e.g. `1.0.0-rc1` |
| **Build number** | e.g. Buyer `8` / Farmer `8` / Courier `11` |
| **Device / OS** | e.g. Samsung A14 · Android 14 |
| **Environment** | Staging |
| **API host** | `https://nahu-api-staging.up.railway.app` |
| **Role / account** | Buyer / Farmer / Courier / Admin (phone or email, **no passwords**) |
| **Related order / shipment ID** | |
| **Severity** | S1 / S2 / S3 / S4 |
| **Status** | New / Confirmed / In progress / Fixed / Won’t fix / Duplicate |

---

## Severity definitions

| Sev | Definition | Pilot impact |
|-----|------------|--------------|
| **S1 – Blocker** | Core path cannot complete (login, browse, checkout, stub pay, seller accept, courier deliver, settle, admin inspect). Data corruption or security exposure. | Must fix before continuing that role’s UAT |
| **S2 – Major** | Wrong money/status, missing critical screen, repeated crash with workaround | Continue only with documented workaround |
| **S3 – Minor** | Incorrect UX, missing validation message, non-critical feature gap | Log; does not stop pilot |
| **S4 – Trivial** | Typos, layout, cosmetic | Backlog |

---

## Summary

One sentence: what went wrong?

---

## Steps to reproduce

1.  
2.  
3.  

---

## Expected result

—

---

## Actual result

—

---

## Evidence

- Screenshots / screen recording:  
- Exact API error message (if any):  
- Approx time (UTC+3):  

---

## Frequency

Always / Often / Once / Unknown

---

## Workaround

None / Describe:

---

## Suspected area (optional)

Auth · Listings · Checkout/Fees · Payments (stub) · Fulfillment · Courier/POD · Settlement · Admin · Maps/Location · Other:

---

## Engineering notes (for triage)

| Field | Value |
|-------|-------|
| Reproduced by eng? | Y / N |
| Root cause | |
| Fix commit / PR | |
| Verified on staging? | Y / N |
| Retest owner | |
