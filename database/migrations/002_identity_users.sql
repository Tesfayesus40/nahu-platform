-- ============================================================================
-- Nahu Platform
-- Migration : 002_identity_users.sql
-- Module    : Identity
-- Author    : Tesfayesus Yimenu Yirdaw
-- Description:
--     Creates the identity.users table.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE identity.user_status AS ENUM
(
    'PENDING',
    'ACTIVE',
    'SUSPENDED',
    'LOCKED',
    'DEACTIVATED'
);

CREATE TABLE identity.users
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    first_name VARCHAR(100) NOT NULL,

    middle_name VARCHAR(100) NOT NULL,

    last_name VARCHAR(100),

    phone VARCHAR(25) NOT NULL UNIQUE,

    email VARCHAR(255) UNIQUE,

    preferred_language CHAR(2) NOT NULL DEFAULT 'en',

    status identity.user_status NOT NULL DEFAULT 'PENDING',

    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- Column Comments
-- ============================================================================

COMMENT ON TABLE identity.users IS
'Stores the core identity information for every person using Nahu Platform.';

COMMENT ON COLUMN identity.users.phone IS
'Primary login identifier.';

COMMENT ON COLUMN identity.users.preferred_language IS
'Preferred user interface language (en, am, om, ti, so).';

COMMENT ON COLUMN identity.users.status IS
'Current lifecycle status of the user account.';

COMMIT;