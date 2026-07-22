# A12–A14 Staging Validation Plan (Batch 4)

## Preconditions

- Migrations `ops/003`–`005` and `identity/025` applied  
- `nahu-api` and `nahu-admin-web` redeployed  
- SUPER_ADMIN or PLATFORM_ADMIN session  

## Checks

1. **RBAC** — AUDITOR can open Reports / Monitoring / Notifications; cannot publish without `notifications.manage` (SUPPORT may only have notifications.read + reports.read).  
2. **Reports** — Open `/reports`, run `orders.summary` export, confirm CSV download and job SUCCEEDED; audit action `reports.export.run`.  
3. **Notifications** — Publish a BROADCAST INFO notice (reauth), see it in list, mark read; unread count decreases on dashboard.  
4. **Monitoring** — Open `/monitoring`, confirm metrics + threshold levels; toggle emit notices and confirm deduped alert notifications appear.  
5. **Dashboard** — Queues show `unreadNotifications` and `alertBreaches` when permitted.  
6. **Flags** — System page shows `admin.reports.enabled`, `admin.notifications.enabled`, `admin.monitoring.alerts`.  

## Rollback

No production cutover. Staging: redeploy previous image; leave migrations in place (additive).
