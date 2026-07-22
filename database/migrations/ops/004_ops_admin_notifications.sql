-- ============================================================================
-- Nahu Platform
-- Migration : ops/004_ops_admin_notifications.sql
-- Module    : Ops / Notifications (A13)
-- Description:
--     In-app admin notification center. source_module supports Farms,
--     Delivery, AI, and other contributors without schema churn.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ops.admin_notifications
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID REFERENCES identity.users(id) ON DELETE CASCADE,
    audience VARCHAR(20) NOT NULL DEFAULT 'BROADCAST'
        CHECK (audience IN ('USER', 'BROADCAST', 'ROLE')),
    audience_role VARCHAR(50),
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO'
        CHECK (severity IN ('INFO', 'WARN', 'CRITICAL')),
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    link_path VARCHAR(300),
    source_module VARCHAR(50) NOT NULL DEFAULT 'platform',
    dedupe_key VARCHAR(120),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_admin_notifications_recipient
    ON ops.admin_notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_admin_notifications_unread
    ON ops.admin_notifications (recipient_user_id, read_at)
    WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_admin_notifications_dedupe
    ON ops.admin_notifications (dedupe_key)
    WHERE dedupe_key IS NOT NULL;

COMMIT;
