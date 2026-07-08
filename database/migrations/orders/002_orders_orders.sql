-- ============================================================================
-- Nahu Platform
-- Migration : 002_orders_orders.sql
-- Module    : Orders
-- Author    : Package 004 (Orders & Certificates)
-- Description:
--     Creates orders.orders. Ported from nahu-buna-gebaya's Knex migration
--     005_create_orders (+ its later add_farmer_id_to_orders patch), with
--     one deliberate bug fix:
--
--     In the original app, orders.farmer_id was populated from
--     listing.farmer_id (a farmer_profiles.id), but orders.service.js's
--     getMyOrders() then filtered `orders.farmer_id = req.user.userId`,
--     where req.user.userId is a users.id from the JWT. Those are two
--     different IDs, so a farmer's "my orders" list would never actually
--     match their own orders in production.
--
--     Fixed here by declaring farmer_id as a proper, enforced foreign key
--     to marketplace.farmer_profiles(id) -- matching how it's actually
--     populated at order-creation time -- and having the application layer
--     join through farmer_profiles to find a farmer's orders by their
--     user_id, rather than comparing user_id directly against this column.
-- ============================================================================

BEGIN;

CREATE TYPE orders.order_status AS ENUM
(
    'PENDING_PAYMENT',
    'PAID_ESCROW',
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'DISPUTED',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE orders.payment_method AS ENUM
(
    'TELEBIRR',
    'CBE_BIRR'
);

CREATE TABLE orders.orders
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    listing_id UUID NOT NULL,

    buyer_id UUID NOT NULL,

    -- References marketplace.farmer_profiles(id), NOT identity.users(id).
    -- See migration header for why this matters.
    farmer_id UUID NOT NULL,

    quantity_kg NUMERIC(10,2) NOT NULL,

    total_etb NUMERIC(12,2) NOT NULL,

    commission_etb NUMERIC(12,2) NOT NULL,

    farmer_payout_etb NUMERIC(12,2) NOT NULL,

    status orders.order_status NOT NULL DEFAULT 'PENDING_PAYMENT',

    payment_method orders.payment_method NOT NULL,

    payment_reference VARCHAR(100),

    delivery_address VARCHAR(500) NOT NULL,

    paid_at TIMESTAMPTZ,

    delivered_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_orders_listing
        FOREIGN KEY (listing_id)
        REFERENCES marketplace.listings(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_orders_buyer
        FOREIGN KEY (buyer_id)
        REFERENCES identity.users(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_orders_farmer
        FOREIGN KEY (farmer_id)
        REFERENCES marketplace.farmer_profiles(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_orders_buyer_id ON orders.orders (buyer_id);
CREATE INDEX idx_orders_farmer_id ON orders.orders (farmer_id);
CREATE INDEX idx_orders_status ON orders.orders (status);

COMMENT ON TABLE orders.orders IS
'Buyer purchases of marketplace listings, tracked through payment/delivery lifecycle.';

COMMENT ON COLUMN orders.orders.farmer_id IS
'References marketplace.farmer_profiles(id) -- the farm profile that owns the listing, not the identity.users row directly.';

COMMIT;
