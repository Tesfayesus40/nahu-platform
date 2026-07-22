# A12–A14 Migration Summary (Batch 4)

| Filename | Purpose |
|----------|---------|
| `ops/003_ops_report_jobs.sql` | Report job ledger + CSV artifact column |
| `ops/004_ops_admin_notifications.sql` | Admin notification center table + dedupe |
| `ops/005_ops_alert_thresholds.sql` | Alert thresholds seed + Batch 4 feature flags |
| `identity/025_identity_batch4_permissions.sql` | `reports.*`, `notifications.*`, `monitoring.read` grants |

All listed in `database/migrations/manifest.json` after `identity/024`.
