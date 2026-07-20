-- ============================================================================
-- Nahu Platform
-- Migration : identity/014_identity_admin_invitations.sql
-- Module    : Identity
-- Description:
--     Creates administrator invitations.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS identity.admin_invitations
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(25),
    invited_user_id UUID REFERENCES identity.users(id),
    role_codes TEXT[] NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES identity.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_invitations_email
    ON identity.admin_invitations (email);

CREATE INDEX IF NOT EXISTS idx_admin_invitations_expires_at
    ON identity.admin_invitations (expires_at);

COMMIT;
