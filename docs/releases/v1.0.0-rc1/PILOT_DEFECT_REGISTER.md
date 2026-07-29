# RC1 Pilot Defect Register

**Release:** `v1.0.0-rc1`  
**Last updated:** 2026-07-29  
**Severity scale:** Critical · High · Medium · Low  
**Process:** [BUG_REPORT_TEMPLATE.md](./BUG_REPORT_TEMPLATE.md)

| ID | Sev | Area | Summary | Status | Resolution |
|----|-----|------|---------|--------|------------|
| STG-01 | **Critical** | Migrations | `catalog/021` illegal Postgres UPDATE/JOIN blocked apply through `ops/013` | **Resolved** | Fixed `744c510`; applied on staging |
| STG-02 | **Critical** | Admin Web | Next.js slug conflict `[code]` vs `[productCode]` — deploy crash | **Resolved** | Route renamed `744c510`; Admin redeploy success |
| STG-03 | **Medium** | Smoke harness | Wrong `paymentMethod` casing / order id path | **Resolved** | `a133a3e` |
| STG-04 | **Low** | Fulfilment | Explicit settle 400 when dual-confirm already auto-settled | **Accepted** | Document expected behaviour |
| STG-05 | **Low** | Fulfilment/Courier | Assign response `id` is fulfillment case, not shipment | **Open (doc)** | Ops use shipment list ids |
| STG-06 | **Low** | Pilot ops | Demo farmer lacks profile; must use listing owner | **Accepted** | Documented in pilot guide |
| STG-07 | **Low** | Staging DB | Staging was behind RC1 migrations pre-apply | **Resolved** | Manifest current through `ops/013` |
| STG-08 | **Medium** | Staging config | `NODE_ENV` was `development` at validation start | **Resolved** | Set `production` in Phase 3 prep |
| STG-09 | **High** | Staging security | Temporary smoke admin password used during validation | **Resolved** | Password rotated; sessions revoked; MFA required |
| UAT-* | — | Device UAT | Human participant defects | **None filed** | Awaiting formal pilot execution |

## Counts (as of last update)

| Sev | Open | Resolved / Accepted |
|-----|------|---------------------|
| Critical | 0 | 2 |
| High | 0 | 1 |
| Medium | 0 | 2 |
| Low | 1 (doc) | 3 |

**Open Critical:** 0 **Open High:** 0
