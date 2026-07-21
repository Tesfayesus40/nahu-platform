-- ============================================================================
-- Nahu Platform
-- Migration : marketplace/013_marketplace_verification_workflow.sql
-- Module    : Marketplace
-- Description:
--     Participant verification cases, decision history, and document refs.
--     Subject types: FARMER, BUYER, MERCHANT (cooperative), ORGANIZATION.
-- ============================================================================

BEGIN;

-- Richer status on farmer profiles (boolean `verified` remains for mobile compat).
ALTER TABLE marketplace.farmer_profiles
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (verification_status IN (
            'PENDING', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'SUSPENDED'
        ));

UPDATE marketplace.farmer_profiles
SET verification_status = CASE WHEN verified THEN 'APPROVED' ELSE 'PENDING' END
WHERE verification_status = 'PENDING' AND verified = TRUE;

ALTER TABLE marketplace.cooperatives
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (verification_status IN (
            'PENDING', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'SUSPENDED'
        ));

ALTER TABLE marketplace.cooperatives
    ADD COLUMN IF NOT EXISTS verification_notes VARCHAR(500);

UPDATE marketplace.cooperatives
SET verification_status = CASE WHEN verified THEN 'APPROVED' ELSE 'PENDING' END
WHERE verification_status = 'PENDING' AND verified = TRUE;

CREATE TABLE IF NOT EXISTS marketplace.verification_cases
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_type VARCHAR(20) NOT NULL
        CHECK (subject_type IN ('FARMER', 'BUYER', 'MERCHANT', 'ORGANIZATION')),
    subject_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'SUSPENDED'
        )),
    display_name VARCHAR(255),
    region VARCHAR(100),
    reviewer_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    reviewer_notes TEXT,
    info_request_message TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    CONSTRAINT uq_verification_cases_subject UNIQUE (subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_verification_cases_status
    ON marketplace.verification_cases (status);

CREATE INDEX IF NOT EXISTS idx_verification_cases_subject_type_status
    ON marketplace.verification_cases (subject_type, status);

CREATE INDEX IF NOT EXISTS idx_verification_cases_submitted_at
    ON marketplace.verification_cases (submitted_at DESC);

CREATE TABLE IF NOT EXISTS marketplace.verification_decisions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES marketplace.verification_cases(id) ON DELETE CASCADE,
    decision VARCHAR(20) NOT NULL
        CHECK (decision IN (
            'APPROVE', 'REJECT', 'REQUEST_INFO', 'SUSPEND', 'START_REVIEW', 'NOTE'
        )),
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    reason TEXT,
    notes TEXT,
    actor_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_decisions_case_id
    ON marketplace.verification_decisions (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace.verification_documents
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES marketplace.verification_cases(id) ON DELETE CASCADE,
    label VARCHAR(200) NOT NULL,
    file_url TEXT NOT NULL,
    content_type VARCHAR(100),
    uploaded_by_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_documents_case_id
    ON marketplace.verification_documents (case_id);

-- Backfill farmer cases
INSERT INTO marketplace.verification_cases (
    subject_type, subject_id, status, display_name, region, submitted_at, updated_at, decided_at
)
SELECT
    'FARMER',
    fp.id,
    fp.verification_status,
    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.phone),
    fp.region,
    fp.created_at,
    fp.updated_at,
    CASE WHEN fp.verification_status = 'APPROVED' THEN fp.updated_at ELSE NULL END
FROM marketplace.farmer_profiles fp
JOIN identity.users u ON u.id = fp.user_id
ON CONFLICT (subject_type, subject_id) DO NOTHING;

-- Backfill merchant (cooperative) cases
INSERT INTO marketplace.verification_cases (
    subject_type, subject_id, status, display_name, region, submitted_at, updated_at, decided_at
)
SELECT
    'MERCHANT',
    c.id,
    c.verification_status,
    c.name,
    c.region,
    c.created_at,
    c.updated_at,
    CASE WHEN c.verification_status = 'APPROVED' THEN c.updated_at ELSE NULL END
FROM marketplace.cooperatives c
ON CONFLICT (subject_type, subject_id) DO NOTHING;

-- Backfill buyer cases (users with BUYER role)
INSERT INTO marketplace.verification_cases (
    subject_type, subject_id, status, display_name, region, submitted_at, updated_at
)
SELECT
    'BUYER',
    u.id,
    'PENDING',
    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.email, u.phone),
    NULL,
    u.created_at,
    u.updated_at
FROM identity.users u
JOIN identity.user_roles ur ON ur.user_id = u.id
JOIN identity.roles r ON r.id = ur.role_id AND r.code = 'BUYER'
WHERE u.deleted_at IS NULL
ON CONFLICT (subject_type, subject_id) DO NOTHING;

-- Backfill organization cases
INSERT INTO marketplace.verification_cases (
    subject_type, subject_id, status, display_name, region, submitted_at, updated_at
)
SELECT
    'ORGANIZATION',
    o.id,
    CASE WHEN o.is_active THEN 'PENDING' ELSE 'SUSPENDED' END,
    o.name,
    NULL,
    o.created_at,
    o.updated_at
FROM identity.organizations o
WHERE o.deleted_at IS NULL
ON CONFLICT (subject_type, subject_id) DO NOTHING;

COMMIT;
