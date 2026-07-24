# Delivery Platform — Staging Validation Checklist (RC1)

**Purpose:** Manual E2E matrix for D12. Record PASS / FAIL / BLOCKED.  
**Report outcomes in:** `d12-delivery-staging-validation-report.md` (fill after run).

---

## A. Happy path (core)

| # | Step | Surface | Expected | Result |
|---|------|---------|----------|--------|
| A1 | Create/release shipment to AWAITING_ASSIGNMENT | Admin | Status + event | |
| A2 | Manual assign courier | Admin | ASSIGNED; assignment row | |
| A3 | Courier accepts | Courier | ACCEPTED | |
| A4 | startPickup → pickup → transit → arrived | Courier | Status progression; no duplicate pickup_started on retry | |
| A5 | POD capture (per flags) | Courier | DELIVERED; POD row; events | |
| A6 | Complete delivery | Courier | COMPLETED; earning ELIGIBLE | |
| A7 | Admin approve earning | Admin | APPROVED marker; reauth + audit | |
| A8 | Courier earnings visibility | Courier | Today/week/month include amount | |

## B. Exceptions

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| B1 | Courier reject | Back to AWAITING_ASSIGNMENT | |
| B2 | Admin reassign | New active assignment; history kept | |
| B3 | Mark failed → admin retry | AWAITING_ASSIGNMENT | |
| B4 | Admin cancel mid-flight | CANCELLED; assignment deactivated | |
| B5 | Invalid POD OTP | Remains ARRIVED; pod.failed event | |
| B6 | Complete without POD | Blocked / no earning | |
| B7 | Double complete / approve | Idempotent; no duplicate primary earning | |

## C. Cross-app consistency

| # | Check | Result |
|---|-------|--------|
| C1 | Same shipment status wording Admin EN vs Courier EN/AM | |
| C2 | ARRIVED ≠ DELIVERED in Amharic | |
| C3 | Farmer tracking matches shipment status | |
| C4 | Buyer handoff PIN only while ARRIVED (if OTP on) | |
| C5 | No earnings UI on Farmer/Buyer | |

## D. Authz / audit

| # | Check | Result |
|---|-------|--------|
| D1 | Non-courier cannot hit `/delivery/courier/*` | |
| D2 | Farmer cannot read buyer shipment | |
| D3 | Earnings manage without permission → 403 | |
| D4 | Privileged actions require reauth | |
| D5 | Audit rows for approve/adjust/reverse/cancel | |

## E. Config matrix (sample)

| Flag combo | Smoke | Result |
|------------|-------|--------|
| buyer_confirm_required=true | Complete blocked until policy allows | |
| buyer_confirm_required=false | Complete → accrual | |
| photo required only | POD without OTP succeeds | |
| OTP+photo | Both required | |

## F. Observability

| # | Check | Result |
|---|-------|--------|
| F1 | Ops metrics load | |
| F2 | Shipment timeline events present | |
| F3 | Lifecycle events for A1–A6 | |

---

## Defect log

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| | | | |

**Sev-1 open?** Yes / No  
**Staging sign-off:** _________________ Date: _______
