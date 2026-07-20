-- ============================================================================
-- Nahu Platform
-- Migration : identity/017_identity_admin_sessions.sql
-- Module    : Identity
-- Description:
--     Creates revocable administrator sessions.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS identity.admin_sessions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    authz_version_at_issue INTEGER NOT NULL,
    ip VARCHAR(64),
    user_agent VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    idle_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoke_reason VARCHAR(100),
    replaced_by_session_id UUID REFERENCES identity.admin_sessions(id),
    reauthenticated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id
    ON identity.admin_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_refresh_token_hash
    ON identity.admin_sessions (refresh_token_hash);

COMMIT;
