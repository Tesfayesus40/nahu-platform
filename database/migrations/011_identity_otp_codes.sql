-- ============================================================================
-- Nahu Platform
-- Migration : 011_identity_otp_codes.sql
-- Module    : Identity
-- Author    : Package 002 (Identity & Auth)
-- Description:
--     Creates identity.otp_codes, storing one-time SMS verification codes
--     used for phone-based login and registration. Mirrors the otp_codes
--     table already proven out in nahu-buna-gebaya (Knex migration
--     007_create_otp_codes), moved into the Identity schema so all Nahu
--     Platform modules share one auth mechanism.
-- ============================================================================

BEGIN;

CREATE TABLE identity.otp_codes
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    phone VARCHAR(25) NOT NULL,

    code VARCHAR(6) NOT NULL,

    used BOOLEAN NOT NULL DEFAULT FALSE,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_codes_phone ON identity.otp_codes (phone);

-- ============================================================================
-- Table Comments
-- ============================================================================

COMMENT ON TABLE identity.otp_codes IS
'One-time SMS verification codes used for phone-based login and registration.';

COMMENT ON COLUMN identity.otp_codes.phone IS
'The phone number this code was issued to. Not a foreign key -- a code may be requested before identity.users has a row for this phone.';

COMMENT ON COLUMN identity.otp_codes.used IS
'Set true once the code has been successfully verified. Codes are single-use.';

COMMENT ON COLUMN identity.otp_codes.expires_at IS
'Code is invalid after this timestamp, regardless of the used flag.';

COMMIT;
