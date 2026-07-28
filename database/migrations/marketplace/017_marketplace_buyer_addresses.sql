-- ============================================================================
-- Nahu Platform
-- Migration : marketplace/017_marketplace_buyer_addresses.sql
-- Module    : Marketplace
-- Description:
--     Saved buyer delivery addresses (address book) plus order columns for
--     delivery_address_id / delivery_method. delivery_address text remains
--     required on orders for dual-write / legacy clients.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS marketplace.buyer_addresses
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES identity.users(id) ON DELETE CASCADE,

    name VARCHAR(120),

    recipient_name VARCHAR(150),

    recipient_phone VARCHAR(30),

    address_text VARCHAR(500) NOT NULL,

    lat DECIMAL(10, 7),

    lng DECIMAL(10, 7),

    instructions VARCHAR(500),

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    address_kind VARCHAR(40) NOT NULL DEFAULT 'HOME'
        CHECK (address_kind IN ('HOME', 'OFFICE', 'OTHER')),

    metadata_json JSONB,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_addresses_user
    ON marketplace.buyer_addresses (user_id);

CREATE INDEX IF NOT EXISTS idx_buyer_addresses_user_live
    ON marketplace.buyer_addresses (user_id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_addresses_user_default
    ON marketplace.buyer_addresses (user_id)
    WHERE deleted_at IS NULL AND is_default = TRUE;

COMMENT ON TABLE marketplace.buyer_addresses IS
'Saved delivery addresses for a buyer (identity.users). Soft-deleted via deleted_at.';

ALTER TABLE orders.orders
    ADD COLUMN IF NOT EXISTS delivery_address_id UUID
        REFERENCES marketplace.buyer_addresses(id) ON DELETE SET NULL;

ALTER TABLE orders.orders
    ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(40) NOT NULL DEFAULT 'NAHU_COURIER'
        CHECK (delivery_method IN (
            'NAHU_COURIER', 'SELLER_DELIVERY', 'CUSTOMER_PICKUP'
        ));

CREATE INDEX IF NOT EXISTS idx_orders_delivery_address
    ON orders.orders (delivery_address_id)
    WHERE delivery_address_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_method
    ON orders.orders (delivery_method);

COMMIT;
