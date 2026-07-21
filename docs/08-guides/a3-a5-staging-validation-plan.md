# A3–A5 Staging Validation Plan

**Scope:** End-to-end acceptance for Verification (A3), Listing Moderation (A4), and Dispute Management (A5) on **staging** after migrations + API + Admin Web deploy.  
**Prerequisite:** [`a2-a5-staging-deployment-checklist.md`](./a2-a5-staging-deployment-checklist.md) Steps A–C complete.  
**Production:** Do not run against production.  
**Date:** 2026-07-22  

Design references: `docs/07-decisions/a3-verification-design.md`, `a4-listing-moderation-design.md`, `a5-dispute-management-design.md`.

---

## Roles to use

| Role | Expected access |
|---|---|
| `SUPER_ADMIN` / `PLATFORM_ADMIN` | Full read + manage for A3–A5 |
| `MARKETPLACE_MODERATOR` | Verification (farmer/merchant) + listing moderate; not org/buyer decide unless granted |
| `SUPPORT_AGENT` | Disputes read + manage; dashboard |
| `AUDITOR` | Read-only verification, listings, disputes — **no** decide/moderate/manage |

Use one privileged admin for happy-path actions and an auditor (or stripped role) for negative authz cases.

---

## Shared setup

1. Open Admin Web staging URL; complete MFA login.
2. Confirm Dashboard loads live counts (not `—` / null) for:
   - Pending verifications (+ by type)
   - Pending listing moderation (+ by status links)
   - Open disputes (+ under review / escalated / resolved links)
3. Confirm deep links land on the correct filtered queue.

---

## A3 — Verification (end-to-end)

### A3-1 Queue & filters

| # | Steps | Expected |
|---|---|---|
| V1 | Open **Verification** (`verification.read`) | Queue loads; pending default or filter works |
| V2 | Filter by subject type FARMER / BUYER / MERCHANT / ORGANIZATION | Rows match type |
| V3 | Search by display name / region if data exists | Matching cases only |
| V4 | Dashboard “Pending verifications” link | Opens pending queue with correct count ±1 race |

### A3-2 Case detail & decisions

| # | Steps | Expected |
|---|---|---|
| V5 | Open a PENDING (or IN_REVIEW) farmer case | Subject payload, documents list, decision history visible |
| V6 | **Start review / Approve** with reauth password | Status → APPROVED (or IN_REVIEW then APPROVED); audit event written; farmer `verified` / `verification_status` synced |
| V7 | On another case: **Request info** with reason + reauth | Status → NEEDS_INFO; `infoRequestMessage` set; audit |
| V8 | On another case: **Reject** with reason + reauth | Status → REJECTED; domain sync as designed |
| V9 | Add reviewer note and (optional) document URL | Note/document appear; audit for note/document |

### A3-3 Authorization

| # | Steps | Expected |
|---|---|---|
| V10 | As AUDITOR: open queues and a case | Read OK; decide buttons fail or API 403 |
| V11 | As MARKETPLACE_MODERATOR: farmer/merchant decide | Allowed; buyer/org decide denied if not granted |

### A3-4 Dashboard

| # | Steps | Expected |
|---|---|---|
| V12 | After decisions, refresh Dashboard | Pending count decreases; type breakdown updates |

**A3 pass criteria:** V1–V12 pass (or documented data gaps with screenshots).

---

## A4 — Listing moderation (end-to-end)

### A4-1 Queue & filters

| # | Steps | Expected |
|---|---|---|
| L1 | Open **Listings** | Actionable (pending/flagged) queue loads |
| L2 | Filter PENDING / APPROVED / REJECTED / SUSPENDED / FLAGGED | Correct sets |
| L3 | Dashboard pending listing moderation link | `/listings?queue=pending` with matching count |

### A4-2 Detail actions

| # | Steps | Expected |
|---|---|---|
| L4 | Open a PENDING listing | Seller, region, commercial status, photos, decision history |
| L5 | **Approve** + reauth | `moderationStatus=APPROVED`; listing eligible for public browse |
| L6 | **Flag** another APPROVED listing + reason | `FLAGGED`; still visible in flagged queue |
| L7 | **Suspend** or **Reject** + reason | Moderation status updates; commercial status cancelled per design; **hidden from public buyer search** |
| L8 | **Clear flag** / re-approve where applicable | Returns toward APPROVED / ACTIVE as designed |
| L9 | Add moderator note | Note + timeline/decision NOTE entry; audit |

### A4-3 Bulk

| # | Steps | Expected |
|---|---|---|
| L10 | Select 2+ pending listings → bulk Approve (or Reject) + reauth | Per-id results; succeeded count; audit `marketplace.listing.moderation.bulk` |

### A4-4 Create path (farmer app / API)

| # | Steps | Expected |
|---|---|---|
| L11 | Create a **new** farmer listing after deploy | Starts `PENDING`; not in public browse until approved |
| L12 | Pre-existing listings | Remain `APPROVED` (backfill) unless later moderated |

### A4-5 Authorization

| # | Steps | Expected |
|---|---|---|
| L13 | AUDITOR read-only | Can list/detail; cannot moderate (403) |
| L14 | User without `marketplace.listings.read` | No Listings nav / 403 |

**A4 pass criteria:** L1–L14 pass.

---

## A5 — Dispute management (end-to-end)

### A5-1 Queue & filters

| # | Steps | Expected |
|---|---|---|
| D1 | Open **Disputes** | Open queue (OPEN + UNDER_REVIEW + ESCALATED) loads |
| D2 | Filter Open / Under Review / Resolved / Closed / Escalated | Correct status sets |
| D3 | Dashboard open disputes + under review / escalated / resolved links | Correct deep links and counts |

### A5-2 Open a case (party path)

| # | Steps | Expected |
|---|---|---|
| D4 | From buyer or farmer app (staging): raise dispute on a paid/non-terminal order | Order → `DISPUTED`; dispute case created or reopened `OPEN` with OPENED event |
| D5 | Or use a backfilled DISPUTED order | Case exists from migration backfill |

### A5-3 Detail & admin actions

| # | Steps | Expected |
|---|---|---|
| D6 | Open case detail | Buyer, seller, order totals/payment/delivery, evidence, timeline, internal notes |
| D7 | **Assign to me** + reauth | `assignedToUserId` set; OPEN → UNDER_REVIEW when applicable; audit |
| D8 | **Start review** / **Request info** (reason) | Status UNDER_REVIEW; info message stored; timeline + audit |
| D9 | Add internal note + evidence (label + URL) | Appear on detail; timeline events; audit |
| D10 | **Record refund intent** with amount + reason | `refund_status=RECORDED_PENDING_PROVIDER`; **no** payment-provider call; audit |
| D11 | **Resolve** or **Reject** + reason | Case → RESOLVED; order → COMPLETED; audit |
| D12 | **Escalate** on another open case | Status ESCALATED; `escalatedAt` set |
| D13 | **Close** a resolved (or open) case + reason | Status CLOSED; audit |

### A5-4 Bulk assign

| # | Steps | Expected |
|---|---|---|
| D14 | Select multiple open cases → **Assign to me** | Per-id results; audit `orders.dispute.bulk_assign` |

### A5-5 Authorization

| # | Steps | Expected |
|---|---|---|
| D15 | SUPPORT_AGENT manage path | Can assign/act |
| D16 | AUDITOR | Read OK; manage 403 |
| D17 | Missing `orders.disputes.read` | No Disputes nav / 403 |

**A5 pass criteria:** D1–D17 pass (D4 may use API/order fixture if mobile staging unavailable — note method used).

---

## Cross-cutting checks

| # | Check | Expected |
|---|---|---|
| X1 | Audit log (`audit.read`) after V6, L5, D11 | Events with `verification.*`, `marketplace.listing.moderation.*`, `orders.dispute.*` |
| X2 | Privileged actions without / with wrong reauth password | Denied |
| X3 | CSRF on Admin Web mutating BFF routes | Missing CSRF rejected |
| X4 | System health | Database `up` |

---

## Sign-off

| Area | Tester | Result | Notes |
|---|---|---|---|
| A3 Verification | | Pass / Fail | |
| A4 Listing moderation | | Pass / Fail | |
| A5 Disputes | | Pass / Fail | |
| Cross-cutting | | Pass / Fail | |

**Batch ready for staging acceptance:** Yes / No  
**Production deploy:** Not authorized by this plan.
