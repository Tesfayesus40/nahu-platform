# RC1 UAT Checklist

**Release:** `v1.0.0-rc1`  
**Environment:** Staging (`https://nahu-api-staging.up.railway.app`)  
**Apps:** Buyer / Farmer / Courier APKs `1.0.0-rc1` · Admin Web staging  
**Use with:** [PILOT_GUIDE.md](./PILOT_GUIDE.md) · [BUG_REPORT_TEMPLATE.md](./BUG_REPORT_TEMPLATE.md)

Mark each item **Pass / Fail / Blocked / N/A**. File defects with the bug template.  
**Do not** use live bank money; Telebirr is **stub** on RC1.

---

## Severity reminder

| Sev | Meaning |
|-----|---------|
| S1 | Blocks core pilot path (login, place order, pay stub, fulfill, settle) |
| S2 | Major wrong result / data integrity; workaround painful |
| S3 | UX / copy / non-blocking functional issue |
| S4 | Cosmetic / nice-to-have |

**Acceptance:** No open **S1**. Open **S2** only with documented workaround and owner. See [RC1_RELEASE_READINESS.md](./RC1_RELEASE_READINESS.md).

---

## A. Pre-flight (Ops / Eng)

| # | Check | Expected | Result | Tester | Notes |
|---|--------|----------|--------|--------|-------|
| A1 | `GET /health/live` | 200 | | | |
| A2 | `GET /health/ready` | 200, DB up | | | |
| A3 | Admin Web `/login` loads | 200 | | | |
| A4 | APKs install on Android test devices | Installs; opens to login | | | |
| A5 | Apps hit Nest staging URL | No legacy Express host | | | |
| A6 | `delivery.dynamic_fee.enabled` | **OFF** | | | |
| A7 | Pilot accounts provisioned | Buyer / Farmer / Courier / Admin MFA | | | |

---

## B. Buyer scenarios

| # | Scenario | Steps (summary) | Expected | Result | Tester | Defect IDs |
|---|----------|-----------------|----------|--------|--------|------------|
| B1 | OTP login | Request OTP → enter code → session | Logged in as BUYER | | | |
| B2 | Browse listings | Home / Browse approved coffee | Only APPROVED/ACTIVE coffee listings | | | |
| B3 | Listing detail | Open listing | Price, grade, process, photos, seller summary | | | |
| B4 | Fee preview | Checkout / pricing active | Fees from platform (not invented %) | | | |
| B5 | Place order (courier) | Qty + address + place order | Order created; fee snapshot present | | | |
| B6 | Stub payment | Confirm / simulate payment | Order → paid/escrowed; **no live bank debit** | | | |
| B7 | Track order | Orders → detail | Status updates match seller/courier progress | | | |
| B8 | Confirm delivery | When delivered | Buyer confirm succeeds; order progresses | | | |
| B9 | Delivery addresses (if used) | Add / select address | Saved and usable at checkout | | | |

---

## C. Farmer (Seller) scenarios

| # | Scenario | Steps (summary) | Expected | Result | Tester | Defect IDs |
|---|----------|-----------------|----------|--------|--------|------------|
| C1 | OTP login | As FARMER | Logged in as FARMER | | | |
| C2 | See new order | Orders list after buyer pay | Paid order visible | | | |
| C3 | Seller accept | Accept order | Status → accepted / orchestration advances | | | |
| C4 | Preparing | Mark preparing | Status updates | | | |
| C5 | Ready for pickup | Mark ready | Eligible for courier assignment | | | |
| C6 | Pickup confirm | Confirm pickup (seller party) | Dual-confirm progress | | | |
| C7 | Listing still sellable | Browse own / public listing | Stock/qty coherent after order | | | |
| C8 | Pickup location (if used) | View/select pickup | Location available to courier path | | | |

---

## D. Courier scenarios

| # | Scenario | Steps (summary) | Expected | Result | Tester | Defect IDs |
|---|----------|-----------------|----------|--------|--------|------------|
| D1 | OTP login | As COURIER | Logged in as COURIER | | | |
| D2 | Go ONLINE | Availability → ONLINE | Can receive assignments | | | |
| D3 | Receive assignment | After admin/seller path assign | Offer / assigned shipment visible | | | |
| D4 | Accept trip | Accept assignment | Status ACCEPTED / executable | | | |
| D5 | Pickup | Confirm pickup / execution | Pickup recorded | | | |
| D6 | In transit | Start transit | Status IN_TRANSIT | | | |
| D7 | Deliver + POD | Complete delivery / POD as configured | Delivered; POD rules respected | | | |
| D8 | Earnings view | Open earnings | Flat ETB or **0** if policy is zero | | | |

---

## E. Admin scenarios

| # | Scenario | Steps (summary) | Expected | Result | Tester | Defect IDs |
|---|----------|-----------------|----------|--------|--------|------------|
| E1 | MFA login | Email + password + TOTP | Session issued | | | |
| E2 | Ops dashboard | Open dashboard | Metrics load | | | |
| E3 | Ops health | Health / monitoring | Healthy or explainable signals | | | |
| E4 | Order inspection | Open pilot order | Fees, payment, fulfillment visible | | | |
| E5 | Payment timeline | Payment / intents on order | Stub Telebirr; escrow/refund states coherent | | | |
| E6 | Assign courier | Assign ONLINE courier | `COURIER_ASSIGNED` | | | |
| E7 | Reassign courier | Reassign with reauth password | Prior assignment cancelled; new active | | | |
| E8 | Audit list | Audit events | Recent admin actions appear | | | |
| E9 | Seller admin | Sellers list / detail | Readable; no crash | | | |
| E10 | Refund (controlled) | Admin refund with allowed reason | Ledger refund; **no live money** | | | |

---

## F. End-to-end happy path (one shared order)

Run once with linked Buyer + Farmer + Courier + Admin:

| Step | Role | Pass? |
|------|------|-------|
| Login all roles | All | |
| Browse → order → stub pay | Buyer | |
| Accept → prepare → ready | Farmer | |
| Assign | Admin | |
| Pickup → transit → deliver | Courier (+ confirms) | |
| Buyer confirm / settle | Buyer / system | |
| Admin inspect | Admin | |
| Optional small refund | Admin | |

**Shared order ID:** ________________  
**Overall E2E:** Pass / Fail  

---

## G. Sign-off

| Role | Name | Date | Verdict |
|------|------|------|---------|
| Pilot owner | | | Ready / Not ready |
| Eng lead | | | Ready / Not ready |
| Ops | | | Ready / Not ready |

**Open S1 count:** ____ **Open S2 count:** ____
