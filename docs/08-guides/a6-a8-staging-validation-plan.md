# A6–A8 Staging Validation Plan

**After** migrations + API + admin-web deploy on staging.

## A6 Dashboard

| # | Check | Expected |
|---|---|---|
| D1 | Open Dashboard as SUPER_ADMIN | KPIs, queues, section charts, trends load (not placeholders/null) |
| D2 | Deep links from queues | Verification / listings / disputes / audit / users |
| D3 | As AUDITOR without dispute manage | Disputes section still readable if `orders.disputes.read` granted; omitted if not |
| D4 | Refresh asOf | Timestamp updates |

## A7 Audit Center

| # | Check | Expected |
|---|---|---|
| A1 | Filters by outcome DENIED | Matching rows |
| A2 | Open event detail | before/after JSON |
| A3 | Summary card | SUCCESS/DENIED/FAILED counts |
| A4 | Export CSV with `audit.export` | File downloads; new `audit.events.export` event appears |
| A5 | Without `audit.export` | Export control hidden / 403 |

## A8 System

| # | Check | Expected |
|---|---|---|
| S1 | Health shows version + uptime | Present |
| S2 | Overview migrations + sessions | Numbers present |
| S3 | Toggle feature flag + reauth | Flag flips; audit `system.feature_flag.update` |
| S4 | List invitations; revoke pending | Status REVOKED; audit event |

**Pass:** D1–D4, A1–A5, S1–S4.
