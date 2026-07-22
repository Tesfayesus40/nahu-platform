# A13 — Notification Center

**Status:** Implemented (Batch 4)  
**Date:** 2026-07-22  
**Depends on:** A0–A11 · ops schema  

## Decision

In-app **Admin Notification Center** backed by `ops.admin_notifications`. Audience: `USER` | `BROADCAST` | `ROLE`. `source_module` and `dedupe_key` let Farms, Delivery, Monitoring, and future AI services publish without duplicate spam. Email/push is stubbed (console in non-production).

Publish requires re-auth + audit. Mark-read is audited.

## Permissions

| Code | Purpose |
|------|---------|
| `notifications.read` | List inbox |
| `notifications.manage` | Mark read / publish |

## API

- `GET /admin/notifications`
- `POST /admin/notifications/read-all` (`notifications.read`)
- `POST /admin/notifications/:id/read` (`notifications.read`)
- `POST /admin/notifications/publish` (`notifications.manage` + reauth)

Mark-read is inbox UX; publish remains privileged.

## Admin Web

Nav **Notifications** → `/notifications`

Dashboard queue: `unreadNotifications`.
