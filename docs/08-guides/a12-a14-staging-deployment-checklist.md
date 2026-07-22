# A12–A14 Staging Deployment Checklist (Batch 4)

**Do not deploy until the batch is complete and validated locally.**  
**Production:** Frozen.

## Migrations (order)

1. `ops/003_ops_report_jobs.sql`  
2. `ops/004_ops_admin_notifications.sql`  
3. `ops/005_ops_alert_thresholds.sql`  
4. `identity/025_identity_batch4_permissions.sql`  

Depends on A1–A11 applied.

```powershell
cd C:\NahuAI\nahu-platform
$env:DATABASE_URL = "<DATABASE_PUBLIC_URL>"
$env:APPLIED_BY = "staging-a12-a14"
node scripts/apply-migrations.mjs
Remove-Item Env:DATABASE_URL
railway up --service nahu-api -d
railway up --service nahu-admin-web -d
```

Then run [`a12-a14-staging-validation-plan.md`](./a12-a14-staging-validation-plan.md).
