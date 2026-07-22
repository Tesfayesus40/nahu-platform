# RC1 — Platform Stabilization Report

**Status:** Complete (stabilization pass; no new business features)  
**Date:** 2026-07-23  
**Scope:** Admin Portal A2–A14 (Nest API + admin-web BFF + docs/tests)  
**Constraint:** Production remains frozen until explicit promotion; staging may receive this commit after review.

---

## 1. Executive verdict

RC1 audited the Admin Portal end-to-end and applied **security, RBAC, audit, correctness, and UX consistency** fixes without adding product capabilities. The platform is closer to production-ready for the A2–A14 surface, with remaining debt explicitly tracked below.

---

## 2. Improvements shipped in RC1

### Security & authz
- **CORS fail-closed in production** when `CORS_ORIGINS` is unset (`apps/api/src/main.ts`). Non-production reflects origin with a warning.
- **`logout-all` requires reauth**; cross-user revoke still requires `identity.sessions.revoke`. Removed fail-open `PermissionsGuard` on that route.
- **`PermissionsGuard` deny-by-default** when attached without `@RequirePermissions` / `@RequireAnyPermissions` metadata.
- **`RequireAnyPermissions` (OR)** for verification read/decide paths aligned with subject verify codes.
- **Report job download scoped** to requester or holders of `reports.export`.
- **Monitoring no longer mutates on GET**; `POST /admin/monitoring/emit-notices` is audited.

### Audit & privileged mutations
- Reauth added for **verification documents** and **dispute evidence**.
- Notification **mark-read** uses `notifications.read` (inbox); publish remains `notifications.manage` + reauth.
- Audit controller now uses **ThrottlerGuard**; CSV export shares `toCsv` helper.

### Correctness
- Fixed wrong status literal **`INFO_REQUESTED` → `NEEDS_INFO` / `PENDING_VERIFICATION_STATUSES`** in dashboard, monitoring, and reporting.
- Dashboard **order aggregates & trends gated** by `orders.read`.

### Admin-web UX / a11y / BFF
- Audit page gated on `audit.read`.
- Users queue hydrates `?status=` from dashboard deep-links (Suspense + `useSearchParams`).
- System nav visible with health **or** config **or** invite.
- `ConfirmActionModal`: Escape, focus password field, block backdrop close while submitting.
- `StatusBadge` tone map expanded for common portal statuses; Nav `aria-current`.
- Account “sign out everywhere” uses ConfirmActionModal + reauth.
- Download/export BFF routes persist **rotated session cookies** via `applySessionCookies`.
- Monitoring emit notices via CSRF-protected POST.

### Shared primitives
- `adminRequestMeta()` helper.
- Shared `toCsv` used by audit export.
- Docs updated for A13/A14 API contracts.

---

## 3. Remaining technical debt (not blocking RC1 merge)

| Priority | Debt | Notes |
|----------|------|-------|
| P1 | Set `CORS_ORIGINS` on staging/production Railway | Staging currently `NODE_ENV=development`; production must set allowlist before promote. |
| P1 | Invite **create** BFF + System UI | Nest `POST /admin/auth/invitations` exists; portal can only list/revoke. |
| P1 | Report / audit export **reauth** | Exports are audited but still passwordless; consider POST+reauth for production policy. |
| P2 | Extract shared list-queue / `bffDownload` client helpers | Duplicated across ~8 portal pages. |
| P2 | Deduplicate metric collectors / notification visibility filters | Monitoring vs dashboard still parallel. |
| P2 | Composite DB indexes for stalled escrow / notification broadcast inbox | Performance under load. |
| P2 | Store report CSV outside Postgres or size-limit aggressively | `artifact_csv` on job rows. |
| P2 | PermissionsGuard loads full role graph every request | Cache/authzVersion already helps; consider permission snapshot. |
| P2 | Focus-trap in ConfirmActionModal | Escape + initial focus done; full focus trap still open. |
| P2 | Uniform deny/loading empty states across all pages | Partially improved. |
| P3 | Path naming consistency (`admin/listings` vs `admin/verification/cases`) | Cosmetic. |
| P3 | Integration tests beyond rules unit tests | No e2e admin suite yet. |

---

## 4. Test coverage updates

- Rules tests remain the primary regression net (`reporting`, `monitoring`, `dashboard`, domain rules).
- RC1 adds/extends: `hasAnyPermission` in auth rules tests; monitoring pending-status assertions in reporting/monitoring rules docs via code path using `PENDING_VERIFICATION_STATUSES`.
- Still missing: PermissionsGuard contract tests, notification visibility unit module, invite-create UI tests.

Run locally:

```powershell
cd apps/api
npm run test:admin-auth-rules
npm run test:reporting-rules
npm run test:monitoring-rules
npm run test:admin-dashboard-rules
npx nest build
cd ../admin-web
npx tsc --noEmit
```

---

## 5. Staging / production readiness checklist

1. Apply no new migrations in RC1 (schema-compatible).
2. Ensure Railway `CORS_ORIGINS` includes admin-web origin before setting `NODE_ENV=production`.
3. Redeploy `nahu-api` + `nahu-admin-web`.
4. Smoke: logout-all with reauth; verification document attach; dispute evidence; monitoring emit notices; report download as non-exporter vs exporter; audit page deny without `audit.read`; dashboard Users deep-link `?status=ACTIVE`.
5. Production promotion remains a separate explicit decision.

---

## 6. What RC1 intentionally did **not** do

- No new A15+ modules or Farms/Delivery/AI product features.
- No production cutover.
- No large UI redesign or design-system rewrite.
- No warehouse / async job queue for reporting.
