# A1 — Admin Portal Foundation Design

**Status:** Approved — 2026-07-19 · implementation complete · awaiting staging validation  
**Date:** 2026-07-19  
**Version:** 1.2 — A1 implemented; stop for user staging acceptance  
**Depends on:** [A0 — Admin Portal Architecture](./a0-admin-portal-architecture.md) (approved 2026-07-19)  
**Suggested tag after merge:** `milestone-admin-a1-foundation`  
**Constraint:** Stop for user staging acceptance before Commit → PR → Merge → Tag and before A2 design. Production remains unchanged until separately approved.

---

## 1. Executive decision

Deliver the **security foundation and Admin Portal shell** as the first implementable Admin milestone:

```text
Migration hygiene (manifest + applied ledger)
        →
Identity workforce auth (invite · password · TOTP · sessions · authz_version)
        →
Permission enforcement + A1 permission seeds
        →
audit.events (append-only)
        →
/api/v1/admin/* auth, session, capability, and health contracts
        →
apps/admin-web (Next.js BFF + login/MFA + permission-derived shell)
        →
Tests · docs · staging validation · commit · PR · merge · tag
```

A1 does **not** ship farmer verification, listing moderation, catalog activation, order transitions, inventory adjustments, or payment actions. Those remain A2+.

---

## 2. Why A1 is shaped this way

Current platform reality (evidence in A0 §21 and repository inspection):

| Area | Today | A1 closes |
|---|---|---|
| Workforce login | Farmer/Buyer OTP only; ADMIN cannot self-register via OTP DTO | Invite + password + mandatory TOTP |
| Authorization | Single JWT `role` string; permissions tables unused | Deny-by-default permission guard |
| Sessions | 7-day bearer JWT; no revocation | Short access token + rotating server sessions |
| Status revalidation | Guards do not reload user/status | ACTIVE user + ACTIVE session + `authz_version` |
| Audit | Farm-specific only | Platform `audit.events` |
| Admin surface | No AdminModule, no admin-web | Shell + auth APIs only |
| Migrations | Recursive `find \| sort`; no ledger | Deterministic manifest + checksum ledger |
| Staging OTP bypass | Universal `123456` when `OTP_DEV_BYPASS=true` | Must never authenticate workforce admins |

A1 therefore prioritizes **trustworthy access control** over operational screens.

---

## 3. Goals and non-goals

### 3.1 Goals

1. Invite-only workforce identities with password + mandatory TOTP MFA.
2. Short-lived access tokens, rotating refresh sessions, and immediate revocation.
3. Runtime permission enforcement using existing `identity.permissions` / `role_permissions`.
4. Append-only `audit.events` for A1 privileged mutations and security events.
5. Same-origin Admin Web BFF with Secure HttpOnly cookies and CSRF protection.
6. Permission-derived portal shell: login, MFA, dashboard skeleton, empty section placeholders.
7. Deterministic, checksummed SQL migration application before new A1 schema.
8. Staging validation with production held.

### 3.2 Non-goals (explicit)

- Farmer/buyer detail, verification, listing moderation, catalog write/activate.
- Order transitions, disputes, inventory adjustments, payment refunds.
- Organization/region scoped grants storage (interfaces accept context; A1 ships GLOBAL grants only).
- Commodity extension panels beyond a stub host registration point.
- Maker-checker, exports, analytics warehouse, Delivery module.
- Changing Farmer or Buyer mobile auth contracts.
- Production deployment.

---

## 4. Locked parameters (configuration defaults)

These are the A1 defaults. They live in configuration (env / Nest config), not scattered literals.

| Parameter | A1 default | Notes |
|---|---|---|
| Password hashing | Argon2id | Prefer Nest/OS crypto libs already approved for the stack; no MD5/SHA1/bcrypt-only if Argon2id is available |
| Access token TTL | 15 minutes | JWT signed by Nest; contains `sub`, `sid`, `authzVersion`, `typ=admin_access` |
| Refresh session absolute TTL | 12 hours | Stored server-side as hash only |
| Refresh idle TTL | 30 minutes | Sliding on successful rotation |
| Refresh rotation | Every use | Old refresh hash invalidated; reuse of old hash → revoke family |
| Invitation TTL | 72 hours | Single-use |
| TOTP step | 30 seconds | RFC 6238; ±1 window |
| Recovery codes | 10 single-use | Stored as salted hashes |
| Failed password threshold | 5 / 15 min | Then lockout |
| Failed MFA threshold | 5 / 15 min | Then lockout |
| Re-auth window | 5 minutes | Required for invite create, role assign, MFA reset (A1 surfaces that exist) |
| CSRF | Double-submit cookie or synchronizer token | Same-site BFF; reject cross-origin |
| Cookie flags | `Secure; HttpOnly; SameSite=Lax` (Strict if same-site always) | Separate cookies for access vs refresh if needed; prefer one opaque session cookie at BFF with Nest token exchange internal |
| CORS for admin | Explicit Admin Web origin only | Never rely on open default CORS for admin |

Break-glass: at least two separately held `SUPER_ADMIN` identities; every break-glass login emits a high-severity security event.

---

## 5. Migration hygiene (prerequisite work inside A1)

### 5.1 Problem

`scripts/apply-migrations.sh` applies `find database/migrations -name '*.sql' | sort`. Lexical path order can violate cross-schema dependencies.

### 5.2 A1 requirement

Before applying any new A1 SQL:

1. Introduce `database/migrations/manifest.json` (or equivalent ordered list) listing every existing migration in a known-good dependency order.
2. Replace or wrap the apply script to:
   - apply only in manifest order;
   - record each applied file in `public.schema_migrations` (or `ops.schema_migrations`) with `filename`, `checksum`, `applied_at`, `applied_by`;
   - refuse to re-apply a file whose checksum differs;
   - skip already-applied matching checksums.
3. Document staging replay steps in `docs/08-guides/` (update or add a short admin/migration note).

### 5.3 Scope boundary

This is platform infrastructure required to ship A1 safely. It does **not** redesign domain schemas. Existing migration files remain; only apply order and ledger change.

---

## 6. Data model additions

SQL-first migrations, then Prisma mappings. Do **not** use `prisma migrate dev` against the SQL-managed database.

### 6.1 `identity.users` additive columns

| Column | Type | Purpose |
|---|---|---|
| `authz_version` | `integer NOT NULL DEFAULT 1` | Bumped on role/permission/status/MFA risk changes; must match access token claim |
| `must_reset_password` | `boolean NOT NULL DEFAULT false` | Invitation / admin-forced reset |
| `mfa_required` | `boolean NOT NULL DEFAULT false` | Workforce users: true |

No duplicate user store. Farmer/Buyer rows remain the same `identity.users` table; workforce is distinguished by roles + invitation path, not a second user table.

### 6.2 `identity.admin_invitations`

| Column | Purpose |
|---|---|
| `id` | UUID PK |
| `email` | Invite target (workforce login identifier for A1) |
| `phone` | Optional; may link/create Identity user |
| `invited_user_id` | Nullable until accepted |
| `role_codes` | Text[] or join table of initial roles (no `SUPER_ADMIN` via ordinary invite) |
| `token_hash` | Single-use invite token hash |
| `invited_by` | Actor user id |
| `expires_at` | |
| `accepted_at` | |
| `revoked_at` | |
| `created_at` | |

Rules:

- Creating an invitation requires `identity.users.invite` (new A1 permission) and recent re-auth.
- Accepting consumes the invitation, sets password, requires TOTP enrollment before first session.
- Farmer/Buyer OTP registration **cannot** assign workforce roles or set `mfa_required`.

### 6.3 `identity.mfa_factors`

| Column | Purpose |
|---|---|
| `id` | UUID PK |
| `user_id` | FK users |
| `type` | `TOTP` for A1 |
| `label` | Optional device label |
| `secret_encrypted` | Application-level encryption (KMS/env key); never plaintext at rest |
| `verified_at` | Null until first successful confirm |
| `disabled_at` | |
| `created_at` | |

Companion: `identity.mfa_recovery_codes` (`user_id`, `code_hash`, `used_at`).

### 6.4 `identity.admin_sessions`

| Column | Purpose |
|---|---|
| `id` | UUID PK (`sid` in access token) |
| `user_id` | FK |
| `refresh_token_hash` | Current rotating refresh |
| `authz_version_at_issue` | Snapshot for diagnostics |
| `ip`, `user_agent` | Bounded length |
| `created_at`, `last_seen_at` | |
| `absolute_expires_at`, `idle_expires_at` | |
| `revoked_at`, `revoke_reason` | |
| `replaced_by_session_id` | Optional rotation chain |

### 6.5 `identity.credentials` usage

A1 activates password login for workforce users using existing `identity.credentials.password_hash`:

- set on invitation accept;
- update `password_changed_at`, `failed_login_attempts`, `locked_until`, `last_login_at`;
- Farmer/Buyer OTP path remains unchanged and does not require passwords.

### 6.6 `audit` schema and `audit.events`

New schema `audit` with append-only `audit.events`:

| Column | Purpose |
|---|---|
| `id` | UUID PK |
| `occurred_at` | timestamptz |
| `actor_user_id` | nullable for anonymous security events |
| `actor_session_id` | |
| `permission_code` | |
| `action` | e.g. `admin.login.success`, `identity.invitation.create` |
| `target_type`, `target_id` | |
| `request_id` | correlation |
| `reason` | required for mutating privileged actions in later phases; optional for pure auth events |
| `outcome` | `SUCCESS` \| `DENIED` \| `FAILED` |
| `before_json`, `after_json` | redacted |
| `ip`, `user_agent` | |
| `metadata_json` | non-secret extras |

Database grants: application role may `INSERT` and `SELECT` with permission checks at API; no `UPDATE`/`DELETE` for the app role. Retention job is out of A1 scope (document only).

### 6.7 Role and permission seeds (A1)

**Roles** (additive; keep existing `ADMIN` for compatibility but do not use it as a bypass):

| Code | A1 use |
|---|---|
| `SUPER_ADMIN` | Break-glass; bootstrap inviter |
| `PLATFORM_ADMIN` | Broad foundation ops (invite, session revoke, audit read) |
| `AUDITOR` | Read-only audit + dashboard |
| Existing `ADMIN` | Deprecated for new grants; map or leave unused by portal |

**A1 permission codes to seed:**

```text
admin.dashboard.read
admin.system.health.read
identity.users.read          # self + limited list for invite UX only if needed
identity.users.invite
identity.sessions.revoke     # self all / admin others with permission
identity.roles.read
audit.read
```

Broader codes from A0 (`farmers.verify`, `listings.moderate`, etc.) may be **seeded as inactive catalog entries** in A1 for forward compatibility, but **no API routes** enforce or expose them yet. Prefer seeding only A1-used codes in A1 to avoid unused surface; A2+ adds seeds with their features.

**Recommendation:** seed only A1-used codes in A1. Document the full A0 catalogue in A0; add codes when the owning slice lands.

### 6.8 Role → permission bundles (A1)

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | all A1 permissions |
| `PLATFORM_ADMIN` | all A1 permissions except may still require re-auth for invite |
| `AUDITOR` | `admin.dashboard.read`, `admin.system.health.read`, `audit.read`, `identity.roles.read` |

---

## 7. Authentication and session design

### 7.1 Identifiers

- **Workforce login identifier for A1:** email + password + TOTP.
- Phone remains on the Identity user for continuity with the platform model but is **not** the A1 admin primary login factor.
- SMS OTP and `OTP_DEV_BYPASS` / universal `123456` **must reject** any user who has a workforce role or `mfa_required=true`.

### 7.2 Invitation accept flow

```text
GET  /accept-invite?token=…     (Admin Web page)
POST /api/v1/admin/auth/invitations/accept
  → validate token hash, expiry, not revoked
  → create or attach Identity user (ACTIVE after enroll)
  → set password (Argon2id)
  → assign invited roles (never SUPER_ADMIN via this path unless explicitly designed break-glass bootstrap)
  → return enrollment session for TOTP setup

POST /api/v1/admin/auth/mfa/enroll/totp
POST /api/v1/admin/auth/mfa/enroll/totp/confirm
  → store encrypted secret; issue recovery codes once
  → mark invitation accepted
  → allow first login
```

Bootstrap of the first `SUPER_ADMIN` is a documented one-time staging procedure (env-gated bootstrap or SQL runbook), not a public self-serve path.

### 7.3 Login flow

```text
POST /api/v1/admin/auth/login
  → email + password
  → lockout / status checks
  → if MFA enrolled: return mfaToken (short-lived, not a full session)
  → else deny (MFA mandatory)

POST /api/v1/admin/auth/mfa/verify
  → mfaToken + TOTP or recovery code
  → create admin_sessions row
  → issue access JWT + refresh
  → BFF sets cookies
  → audit security event login.success
```

### 7.4 Request authentication (Nest)

For `/api/v1/admin/*` (except login/accept/mfa challenge endpoints):

1. Verify access JWT signature and `typ=admin_access`.
2. Load session by `sid`; require not revoked; within absolute and idle expiry.
3. Load user; require `status=ACTIVE`; require `authz_version` match claim.
4. Resolve effective permissions from all roles (not a single JWT role string).
5. `@RequirePermissions(...)` deny by default.
6. Touch `last_seen_at` / idle expiry on refresh path; access path may record last seen throttled.

Mobile `/api/v1/auth/*` and domain routes remain on existing JwtAuthGuard + RolesGuard. Do not break Farmer/Buyer.

### 7.5 Refresh and logout

```text
POST /api/v1/admin/auth/refresh
  → rotate refresh hash; detect reuse → revoke session family + security event
  → issue new access token with current authz_version

POST /api/v1/admin/auth/logout
  → revoke current session

POST /api/v1/admin/auth/logout-all
  → revoke all sessions for user (self) or target (with identity.sessions.revoke)
```

### 7.6 BFF cookie model

Admin Web (Next.js) owns browser cookies:

- Browser never holds the Nest access JWT in `localStorage`.
- BFF route handlers forward to Nest with server-side token material derived from the session cookie.
- CSRF token required on state-changing BFF routes.
- Admin Web never opens a Prisma/PostgreSQL connection.

Exact cookie naming (`nahu_admin_session`, etc.) is an implementation detail; document in Admin Web README at implementation time.

---

## 8. API contracts (A1)

Global prefix remains `/api/v1`. Admin namespace: `/api/v1/admin`.

### 8.1 Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/admin/auth/login` | public | password step |
| POST | `/admin/auth/mfa/verify` | mfaToken | complete login |
| POST | `/admin/auth/refresh` | refresh | rotate |
| POST | `/admin/auth/logout` | session | revoke current |
| POST | `/admin/auth/logout-all` | permission | revoke all |
| POST | `/admin/auth/invitations` | `identity.users.invite` + re-auth | create invite |
| POST | `/admin/auth/invitations/accept` | invite token | accept |
| POST | `/admin/auth/mfa/enroll/totp` | enrollment session | begin TOTP |
| POST | `/admin/auth/mfa/enroll/totp/confirm` | enrollment session | confirm |
| GET | `/admin/auth/me` | session | profile + roles |
| GET | `/admin/auth/capabilities` | session | effective permission codes for nav |

### 8.2 Shell / system

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard/summary` | `admin.dashboard.read` | skeleton KPIs: placeholders / zeros / "coming in A2+" |
| GET | `/admin/system/health` | `admin.system.health.read` | API + DB reachability for portal status panel |
| GET | `/admin/audit/events` | `audit.read` | paginated list; A1 may limit to security/auth actions |

All list endpoints: cursor or page+limit (max page size enforced), stable sort, `requestId` on responses.

### 8.3 Explicitly out of A1 API surface

No `/admin/farmers/*`, `/admin/listings/*`, `/admin/orders/*`, `/admin/catalog/*` write routes. Controllers for those domains are not created in A1.

### 8.4 Module placement

| Concern | Owner |
|---|---|
| Admin auth, sessions, invitations, MFA, capabilities | Identity module (`admin-auth` controllers under Identity) |
| Permission guard / decorator | `common/guards` shared |
| Audit write/read service | new `AuditModule` used by Identity (and later domains) |
| Dashboard summary | thin `AdminModule` read aggregator returning stub metrics in A1 |
| System health for admin | wraps existing health checks with permission |

---

## 9. Frontend design (`apps/admin-web`)

### 9.1 Stack

- Next.js App Router + TypeScript inside `nahu-platform` Turborepo.
- pnpm workspace member; turbo `build`/`dev`/`lint` wired.
- No PostgreSQL client in this app.

### 9.2 Route groups

```text
app/
  (auth)/
    login/
    mfa/
    accept-invite/
    locked/                    # optional messaging
  (portal)/
    layout.tsx                 # shell: nav from capabilities
    page.tsx                   # dashboard
    audit/                     # read-only list if permission
    system/                    # health panel
    account/                   # session details and logout-all
  api/                         # BFF route handlers only
```

People, Participants, Catalog, Marketplace, Commerce, and Operations routes are not created in A1.

### 9.3 Navigation rules

- Build nav exclusively from `GET /admin/auth/capabilities`.
- Hide unauthorized sections entirely (do not show zeroed forbidden modules).
- A1 visible sections: Dashboard, Audit (if permitted), System (if permitted), Account/session controls.
- A0 tree nodes for Participants / Catalog / Marketplace / Commerce / Operations appear as **Coming in A2+** only if product wants discoverability; default is **omit until the slice lands**.

**Recommendation:** omit unfinished sections from nav in A1 to avoid false expectations.

### 9.4 Dashboard skeleton

- Environment badge (staging).
- Priority strip: empty state copy ("Operational queues arrive in A2+").
- KPI cards: placeholder or N/A.
- System status card wired to `/admin/system/health`.
- No fabricated domain metrics.

### 9.5 UX requirements

- Amharic/English i18n scaffolding acceptable if lightweight; full localization polish can follow.
- Every mutating form that exists in A1 (invite, logout-all) captures reason where A0 requires it; login does not.
- Accessible forms; clear lockout and MFA error states.
- No cards-for-decoration; keep operational density consistent with A0 shell intent.

---

## 10. Security controls checklist (implementation gates)

1. Workforce roles cannot be granted by Farmer/Buyer OTP registration.
2. Universal OTP / `OTP_DEV_BYPASS` cannot mint admin sessions.
3. Access token alone is insufficient without server session row.
4. Stale `authz_version` → 401 and force re-login.
5. Permission missing → 403; no `ADMIN` role string bypass.
6. Refresh reuse → revoke family + security event.
7. TOTP secrets encrypted at rest; recovery codes hashed; never logged.
8. Audit JSON redaction denylist (passwords, tokens, TOTP, recovery codes, OTPs).
9. CORS allowlist includes Admin Web origin only for credentialed admin traffic.
10. Helmet + rate limits on login/MFA/invite endpoints.
11. Staging deploy of Admin Web is separate service or path; production not created in A1 unless explicitly approved (default: staging only).

---

## 11. Testing matrix

| Layer | Must cover |
|---|---|
| Unit | password verify, TOTP window, permission resolver, authz_version bump |
| Integration (API) | invite → enroll → login → capabilities; denied without permission; suspended user; revoked session; refresh reuse; OTP bypass cannot admin |
| Audit | login success/failure; invite create; session revoke; mutation+audit atomicity where applicable |
| Migration | manifest order; checksum mismatch refuse; replay idempotent |
| Frontend | login/MFA happy path; nav hides without capability; CSRF rejection |
| Regression | Farmer/Buyer OTP login and existing `@Roles` routes unchanged |

---

## 12. Delivery workflow (after A1 design approval)

```text
1. Architecture / Design
2. User review
3. Explicit user approval
4. Implementation
   → SQL: migration hygiene + A1 schema + Prisma mappings
   → API: guards, Identity admin auth, AuditModule, dashboard shell contracts
   → Frontend: apps/admin-web BFF and portal shell
5. Automated and manual testing
6. Documentation update
7. Staging deployment
8. User validation and feedback                ← mandatory stop
9. Final fixes, if requested
10. Commit
11. Pull request
12. Merge
13. Tag milestone-admin-a1-foundation
14. Begin A2 design only after A1 acceptance
```

No step authorizes the next without completing the prior. The agent stops twice:

- after design/review, before implementation, for explicit approval;
- after staging deployment, before commit/PR/merge/tag, for user validation.

Staging feedback is resolved and revalidated before the A1 commit. A2 does not begin merely
because A1 is deployed. Production remains separately frozen until explicit production approval.

---

## 13. Staging validation plan

### 13.1 Engineering staging checks

1. Apply migration manifest + A1 SQL on staging Postgres.
2. Bootstrap two `SUPER_ADMIN` users via documented runbook.
3. Invite a `PLATFORM_ADMIN` and an `AUDITOR`; complete MFA enrollment.
4. Verify login, refresh, logout, logout-all, lockout, idle expiry, and absolute expiry.
5. Verify capabilities-driven nav; auditor cannot create invitations.
6. Verify audit events for authentication, invitation, denial, and session actions.
7. Verify Farmer/Buyer mobile smoke against the staging API still passes.
8. Verify OTP bypass cannot obtain an admin session.
9. Run responsive and accessibility checks for supported desktop/tablet/mobile widths.
10. Confirm no production Railway service, database, or configuration was changed.

### 13.2 Staging handoff to the user

The validation handoff must provide:

- the Admin Web staging URL;
- staging API and health URLs;
- one safe invitation/bootstrap procedure (credentials are shared out-of-band, never in docs/chat);
- an authenticator setup note for TOTP;
- test roles available (`PLATFORM_ADMIN`, `AUDITOR`) and their expected capabilities;
- known limitations and exact build/commit identifier;
- rollback/redeploy instructions for engineering.

If hosted staging is blocked, provide local run instructions instead, including prerequisites,
environment variable names (never secret values), migration/app startup commands, seeded test-role
procedure, and local URLs. Hosted staging remains required before A1 is finalized.

### 13.3 User acceptance checklist

The user validates:

1. [ ] Invite-only administrator onboarding.
2. [ ] Invitation acceptance and password setup.
3. [ ] Login and clear invalid/locked-account states.
4. [ ] TOTP enrollment, verification, and recovery-code behavior.
5. [ ] Logout, logout-all, refresh, idle expiry, and expired-session handling.
6. [ ] Capability-derived navigation differs correctly by role.
7. [ ] Dashboard shell shows only real A1 information and explicit deferred states.
8. [ ] Health page is understandable and permission-protected.
9. [ ] Audit viewer is read-only, paginated, and redacted.
10. [ ] Unauthorized routes/actions fail safely (UI omission plus API 403/401).
11. [ ] UI/UX, responsive behavior, accessibility, and Nahu branding are acceptable.
12. [ ] Farmer and Buyer staging behavior remains unaffected.

Feedback is recorded, final fixes are applied, and the affected checks are repeated. Commit, PR,
merge, tag, and A2 design begin only after explicit A1 staging acceptance.

---

## 14. Risks specific to A1

| Risk | Mitigation |
|---|---|
| First SUPER_ADMIN bootstrap is a backdoor forever | Env-gated, audited, disabled after bootstrap; dual custody |
| Email delivery for invites unfinished | Staging may use signed link display in secure ops channel; production email provider required before production admin |
| Argon2id cost too high on small containers | Tune memory/time params; load-test login |
| BFF mis-config leaks tokens to JS | HttpOnly only; security review before production |
| Migration ledger blocks old environments | Document backfill of checksums for already-applied files |

---

## 15. Success criteria

A1 is done when:

- [ ] Migration manifest + applied ledger are the only supported apply path.
- [ ] Workforce users authenticate with password + TOTP only via invite.
- [ ] Admin sessions are short-lived, rotating, and revocable.
- [ ] Permissions are enforced deny-by-default on `/api/v1/admin/*`.
- [ ] `audit.events` records A1 security and invite actions.
- [ ] `apps/admin-web` shell works on staging with capability-derived nav.
- [ ] Farmer/Buyer contracts and smoke paths remain green.
- [ ] The user completes the §13.3 acceptance checklist and explicitly accepts A1 staging.
- [ ] Production unchanged; tag `milestone-admin-a1-foundation` applied after merge.

---

## 16. A1 approval checklist

Approved on **2026-07-19**. The design decisions are locked:

1. [x] Migration hygiene (manifest + checksum ledger) lands before or with A1 SQL.
2. [x] A1 SQL limited to invitations, MFA, admin sessions, `authz_version`, and `audit.events` (+ credential password activation for workforce).
3. [x] Workforce auth is email + password + mandatory TOTP; OTP bypass cannot admin.
4. [x] Access token ≤15m; rotating refresh with reuse detection; server-side sessions.
5. [x] Permission guard deny-by-default; A1 seeds only A1-used permission codes and workforce roles.
6. [x] Admin API surface limited to auth, capabilities, dashboard skeleton, system health, audit read.
7. [x] `apps/admin-web` is Next.js BFF + shell only; unfinished A0 nav sections omitted.
8. [x] No farmer/listing/order/catalog/inventory operational commands in A1.
9. [x] Staging handoff includes a URL (or temporary local instructions), test-role procedure, known
       limitations, and the §13.3 acceptance checklist.
10. [x] Stop after staging for user validation; final fixes precede commit/PR/merge/tag and A2.
11. [x] Production remains unchanged without later explicit approval.
12. [x] Suggested release tag: `milestone-admin-a1-foundation`.

**Next:** implement in the order in §12 and stop again after staging deployment for user
acceptance (§13.3). A2 design starts only after explicit A1 staging acceptance and completion of
the commit/PR/merge/tag sequence.

---

## 17. Repository evidence

- A0 approved decisions: `docs/07-decisions/a0-admin-portal-architecture.md`
- Identity OTP/JWT: `apps/api/src/identity/identity.service.ts`
- Guards: `apps/api/src/common/guards/jwt-auth.guard.ts`, `roles.guard.ts`
- Prisma Identity models: `apps/api/prisma/schema.prisma`
- Role seed: `database/migrations/012_identity_seed_core_roles.sql`
- Migration apply: `scripts/apply-migrations.sh`
- Staging: `docs/08-guides/staging-deploy.md`
- CORS/bootstrap: `apps/api/src/main.ts`
