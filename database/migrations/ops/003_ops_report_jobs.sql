-- ============================================================================
-- Nahu Platform
-- Migration : ops/003_ops_report_jobs.sql
-- Module    : Ops / Reporting (A12)
-- Description:
--     Asynchronous/sync report job ledger. Artifacts may be inline CSV
--     for small exports; domains register exporters without a warehouse.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ops.report_jobs
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
    filters_json JSONB,
    requested_by_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
    row_count INT,
    artifact_csv TEXT,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_report_jobs_requested
    ON ops.report_jobs (requested_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_report_jobs_type_status
    ON ops.report_jobs (report_type, status);

COMMIT;
