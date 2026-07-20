-- ============================================================================
-- Nahu Platform
-- Migration : identity/015_identity_mfa_factors.sql
-- Module    : Identity
-- Description:
--     Creates administrator multi-factor authentication factors.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS identity.mfa_factors
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type = 'TOTP'),
    label VARCHAR(100),
    secret_encrypted TEXT NOT NULL,
    verified_at TIMESTAMPTZ,
    disabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mfa_factors_active_user_type
    ON identity.mfa_factors (user_id, type)
    WHERE disabled_at IS NULL;

COMMIT;
