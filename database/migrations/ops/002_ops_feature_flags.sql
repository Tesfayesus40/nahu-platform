-- ============================================================================
-- Nahu Platform
-- Migration : ops/002_ops_feature_flags.sql
-- Module    : Ops
-- Description:
--     Feature flags for Admin Portal system administration (A8).
--     Flags gate operational surfaces; they are not a second ledger.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ops.feature_flags
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ops_feature_flags_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_ops_feature_flags_enabled
    ON ops.feature_flags (enabled);

INSERT INTO ops.feature_flags (code, display_name, description, enabled)
VALUES
    (
        'admin.dashboard.trends',
        'Dashboard trends',
        'Show multi-day trend series on the Admin dashboard.',
        TRUE
    ),
    (
        'admin.audit.export',
        'Audit CSV export',
        'Allow authorized roles to export audit events as CSV.',
        TRUE
    ),
    (
        'admin.system.invitations',
        'Invitation management',
        'Show invitation list/revoke on the System page.',
        TRUE
    )
ON CONFLICT (code) DO NOTHING;

COMMIT;
