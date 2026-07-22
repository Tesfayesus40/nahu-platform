# A9–A11 Staging Validation Plan

## A9 Orders / Payments

| # | Check | Expected |
|---|---|---|
| O1 | Orders nav + queue pending payment | Rows load |
| O2 | Confirm payment simulation + reauth | Status PAID_ESCROW; audit |
| O3 | Cancel unpaid + reauth | CANCELLED; stock restored |
| O4 | Payment panel shows method/provider status | Read-only |
| O5 | Dashboard pending payment / stalled escrow links | Work |

## A10 Delivery

| # | Check | Expected |
|---|---|---|
| L1 | Delivery queue open/exceptions | Loads |
| L2 | Mark ready → in transit → delivered | Status + order align; audit |
| L3 | Raise exception | EXCEPTION + notes |
| L4 | Update carrier/tracking | Persisted for future TMS |

## A11 Promotions / Coops

| # | Check | Expected |
|---|---|---|
| P1 | Create promotion DRAFT→ACTIVE | Saved; audit; UI notes not checkout-applied |
| P2 | Cooperatives list/detail | Farmer rollups visible |
| P3 | Update coop notes/license | Audit |

**RBAC:** AUDITOR read-only; missing perms hide nav / 403.
