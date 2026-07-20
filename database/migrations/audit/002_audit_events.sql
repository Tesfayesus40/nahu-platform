-- ============================================================================
-- Nahu Platform
-- Migration : audit/002_audit_events.sql
-- Module    : Audit
-- Description:
--     Creates the append-only administrative audit event store.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS audit.events
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID,
    actor_session_id UUID,
    permission_code VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(100),
    request_id VARCHAR(100),
    reason TEXT,
    outcome VARCHAR(20) NOT NULL
        CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILED')),
    before_json JSONB,
    after_json JSONB,
    ip VARCHAR(64),
    user_agent VARCHAR(512),
    metadata_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at
    ON audit.events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_user_id
    ON audit.events (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_action
    ON audit.events (action);

CREATE INDEX IF NOT EXISTS idx_audit_events_request_id
    ON audit.events (request_id);

-- The application database role should receive only INSERT and SELECT on
-- audit.events. No application role name is defined by existing migrations,
-- so grants must be configured by the deployment environment.

COMMIT;
