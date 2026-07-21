# A2 — Admin Users slice (People foundation)

**Status:** Implemented — awaiting staging migrate + redeploy + acceptance  
**Date:** 2026-07-21  
**Depends on:** A0 architecture · A1 admin foundation  
**Scope:** User list/detail and privileged identity actions only. Organizations and farmer verification remain deferred.

---

## 1. Decision

Ship an Admin Portal **Users** module that:

- Lists and details **all** `identity.users` (farmers, buyers, workforce).
- Allows status changes for any user (`ACTIVE`, `SUSPENDED`, `LOCKED`, `DEACTIVATED`).
- Restricts role assignment, MFA reset, and password reset to **workforce-capable** users (password credential, `mfaRequired`, admin roles, or MFA factors).
- Audits every privileged mutation with re-authentication.

## 2. Permissions

| Code | SUPER_ADMIN / PLATFORM_ADMIN | AUDITOR |
|------|------------------------------|---------|
| `identity.users.read` | yes | yes |
| `identity.users.status.write` | yes | no |
| `identity.roles.assign` | yes | no |
| `identity.users.mfa.reset` | yes | no |
| `identity.users.password.reset` | yes | no |
| `identity.sessions.revoke` | yes | no |

Seeded in `identity/019_identity_user_management_permissions.sql`.

## 3. API surface

Base: `/api/v1/admin`

- `GET /users` — paginated search/filter/sort
- `GET /users/:id` — detail (no secrets)
- `GET /roles` — role catalog + assignable codes
- `PATCH /users/:id/status`
- `PUT /users/:id/roles`
- `POST /users/:id/mfa/reset` — returns one-time `enrollToken`
- `POST /users/:id/password/reset` — returns one-time `temporaryPassword`
- `POST /users/:id/sessions/revoke`

Mutations require `reauthPassword`. Role assignment never grants `SUPER_ADMIN` via API; existing `SUPER_ADMIN` and non-workforce roles are preserved. Self-targeting privileged actions are rejected. Last active `SUPER_ADMIN` cannot be locked/suspended/deactivated.

## 4. Admin Web

- Nav **Users** → `/users` (`identity.users.read`)
- Detail `/users/[id]` with permission-gated actions
- One-time secrets shown once for MFA enroll / temp password (ops copy out-of-band)

## 5. Deferred (later A2 leftovers)

- Organizations CRUD
- Farmer verification queues
- Buyer/farmer domain detail panels beyond identity fields

## 6. Staging notes

1. Apply migration `identity/019` with public `DATABASE_URL`.
2. Redeploy `nahu-api` and `nahu-admin-web`.
3. Existing SUPER_ADMIN / PLATFORM_ADMIN sessions may need re-login after `authzVersion` changes from role grant seed (permissions are DB-resolved each request; new permission codes appear after migration without authz bump).
