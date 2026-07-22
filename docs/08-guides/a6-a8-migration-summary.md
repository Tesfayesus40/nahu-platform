# A6–A8 Migration Summary

| Order | File | What it does |
|---|---|---|
| 1 | `ops/001_ops_schema.sql` | Creates `ops` schema for system administration |
| 2 | `ops/002_ops_feature_flags.sql` | Feature flags table + seed (dashboard trends, audit export, invitations UI) |
| 3 | `audit/003_audit_events_filter_indexes.sql` | Indexes on outcome, target, permission for Audit Center filters |
| 4 | `identity/023_identity_batch2_permissions.sql` | Seeds `audit.export`, `admin.system.config.read`, `admin.system.config.write` |

A6 dashboard analytics requires **no** new tables — live queries over existing modules.
