-- ============================================================================
-- Nahu Platform
-- Migration : identity/013_identity_admin_user_columns.sql
-- Module    : Identity
-- Description:
--     Adds authorization and administrator security state to users.
-- ============================================================================

BEGIN;

ALTER TABLE identity.users
    ADD COLUMN IF NOT EXISTS authz_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
