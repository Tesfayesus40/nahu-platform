-- ============================================================================
-- Nahu Platform
-- Migration : audit/003_audit_events_filter_indexes.sql
-- Module    : Audit
-- Description:
--     Extra indexes to support A7 Audit Center filters (outcome, target).
-- ============================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_audit_events_outcome
    ON audit.events (outcome);

CREATE INDEX IF NOT EXISTS idx_audit_events_target
    ON audit.events (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_permission
    ON audit.events (permission_code);

COMMIT;
