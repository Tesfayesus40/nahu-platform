# A8 — System Administration

**Status:** Implemented — Batch 2  
**Date:** 2026-07-22  
**Depends on:** A1 health + invitations; ops feature flags  

---

## 1. Decision

Expand System beyond DB ping:

- Health includes version, nodeEnv, uptime
- Overview: active admin sessions, pending invitations, migration ledger tip, feature flags
- Feature flag toggle with reauth + audit (`system.feature_flag.update`)
- Invitation list + revoke (reauth + audit)

## 2. Permissions

| Code | Purpose |
|---|---|
| `admin.system.health.read` | Health endpoint (existing) |
| `admin.system.config.read` | Overview + flag list |
| `admin.system.config.write` | Toggle flags |

Seeded in `identity/023`. Schema: `ops/001`, `ops/002`.

## 3. API

- `GET /admin/system/health`
- `GET /admin/system/overview`
- `GET/PATCH /admin/system/feature-flags`
- `GET /admin/auth/invitations`
- `POST /admin/auth/invitations/:id/revoke`
