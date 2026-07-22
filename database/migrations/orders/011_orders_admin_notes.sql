-- ============================================================================
-- Nahu Platform
-- Migration : orders/011_orders_admin_notes.sql
-- Module    : Orders
-- Description:
--     Admin-only notes on orders (A9). Does not change commercial status.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS orders.order_admin_notes
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders.orders(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    author_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_admin_notes_order
    ON orders.order_admin_notes (order_id, created_at DESC);

COMMIT;
