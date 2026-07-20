-- ============================================================================
-- Nahu Platform
-- Migration : identity/016_identity_mfa_recovery_codes.sql
-- Module    : Identity
-- Description:
--     Creates hashed MFA recovery codes.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS identity.mfa_recovery_codes
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
