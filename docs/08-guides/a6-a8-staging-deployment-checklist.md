# A6–A8 Staging Deployment Checklist (Batch 2)

**Batch:** A6 Dashboard Analytics · A7 Audit Center · A8 System Administration  
**Environment:** Staging only · Production frozen  
**Date:** 2026-07-22  

Related: [`a6-a8-migration-summary.md`](./a6-a8-migration-summary.md) · [`a6-a8-staging-validation-plan.md`](./a6-a8-staging-validation-plan.md)

---

## Pending migrations (order)

| # | File | Milestone |
|---|---|---|
| 1 | `ops/001_ops_schema.sql` | A8 |
| 2 | `ops/002_ops_feature_flags.sql` | A8 |
| 3 | `audit/003_audit_events_filter_indexes.sql` | A7 |
| 4 | `identity/023_identity_batch2_permissions.sql` | A6–A8 perms |

**Depends on:** A1–A5 already applied on staging.

```powershell
cd C:\NahuAI\nahu-platform
$env:DATABASE_URL = "<DATABASE_PUBLIC_URL>"
$env:APPLIED_BY = "staging-a6-a8"
node scripts/apply-migrations.mjs
Remove-Item Env:DATABASE_URL
railway up --service nahu-api -d
railway up --service nahu-admin-web -d
```

Then run the validation plan.
