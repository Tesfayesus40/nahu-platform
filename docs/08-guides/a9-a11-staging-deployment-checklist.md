# A9–A11 Staging Deployment Checklist (Batch 3)

**Do not deploy until the batch is complete and validated locally.**  
**Production:** Frozen.

## Migrations (order)

1. `orders/011_orders_admin_notes.sql`  
2. `delivery/001_delivery_schema.sql`  
3. `delivery/002_delivery_fulfillment_cases.sql`  
4. `marketplace/015_marketplace_promotions.sql`  
5. `identity/024_identity_batch3_permissions.sql`  

Depends on A1–A8 applied.

```powershell
cd C:\NahuAI\nahu-platform
$env:DATABASE_URL = "<DATABASE_PUBLIC_URL>"
$env:APPLIED_BY = "staging-a9-a11"
node scripts/apply-migrations.mjs
Remove-Item Env:DATABASE_URL
railway up --service nahu-api -d
railway up --service nahu-admin-web -d
```

Then run [`a9-a11-staging-validation-plan.md`](./a9-a11-staging-validation-plan.md).
