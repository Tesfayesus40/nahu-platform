-- ============================================================================
-- Nahu Platform
-- Migration : orders/010_orders_dispute_cases.sql
-- Module    : Orders
-- Description:
--     Admin dispute case model: cases, events/timeline, evidence, notes.
--     Refund actions record intent only (no payment-provider settlement).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS orders.dispute_cases
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders.orders(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN (
            'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED', 'ESCALATED'
        )),
    opened_by_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    opened_by_role VARCHAR(20)
        CHECK (opened_by_role IS NULL OR opened_by_role IN ('BUYER', 'FARMER', 'ADMIN')),
    assigned_to_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    reason_code VARCHAR(50),
    summary TEXT,
    resolution_code VARCHAR(50),
    resolution_notes TEXT,
    info_request_message TEXT,
    refund_status VARCHAR(30) NOT NULL DEFAULT 'NONE'
        CHECK (refund_status IN (
            'NONE', 'REQUESTED', 'RECORDED_PENDING_PROVIDER', 'NOT_APPLICABLE'
        )),
    refund_amount_etb NUMERIC(12, 2),
    refund_notes TEXT,
    escalated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dispute_cases_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_dispute_cases_status
    ON orders.dispute_cases (status);

CREATE INDEX IF NOT EXISTS idx_dispute_cases_assigned
    ON orders.dispute_cases (assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_dispute_cases_opened_at
    ON orders.dispute_cases (opened_at DESC);

CREATE TABLE IF NOT EXISTS orders.dispute_events
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES orders.dispute_cases(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL
        CHECK (event_type IN (
            'OPENED',
            'ASSIGNED',
            'START_REVIEW',
            'REQUEST_INFO',
            'NOTE',
            'EVIDENCE_ADDED',
            'REFUND_RECORDED',
            'RESOLVE',
            'REJECT',
            'CLOSE',
            'ESCALATE',
            'STATUS_CHANGE'
        )),
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    message TEXT,
    actor_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_events_dispute
    ON orders.dispute_events (dispute_id, created_at DESC);

CREATE TABLE IF NOT EXISTS orders.dispute_evidence
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES orders.dispute_cases(id) ON DELETE CASCADE,
    label VARCHAR(200) NOT NULL,
    file_url TEXT NOT NULL,
    content_type VARCHAR(100),
    uploaded_by_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute
    ON orders.dispute_evidence (dispute_id);

CREATE TABLE IF NOT EXISTS orders.dispute_notes
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES orders.dispute_cases(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT TRUE,
    author_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_notes_dispute
    ON orders.dispute_notes (dispute_id, created_at DESC);

-- Backfill open cases for existing DISPUTED orders
INSERT INTO orders.dispute_cases (order_id, status, summary, opened_at, updated_at)
SELECT
    o.id,
    'OPEN',
    'Backfilled from order status DISPUTED',
    o.updated_at,
    o.updated_at
FROM orders.orders o
WHERE o.status = 'DISPUTED'
ON CONFLICT (order_id) DO NOTHING;

INSERT INTO orders.dispute_events (dispute_id, event_type, to_status, message, created_at)
SELECT
    d.id,
    'OPENED',
    'OPEN',
    'Backfilled dispute case',
    d.opened_at
FROM orders.dispute_cases d
WHERE d.summary = 'Backfilled from order status DISPUTED'
  AND NOT EXISTS (
      SELECT 1 FROM orders.dispute_events e WHERE e.dispute_id = d.id
  );

COMMIT;
