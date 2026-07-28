-- ============================================================================
-- Nahu Platform
-- Migration : marketplace/021_marketplace_seller_parties.sql
-- Module    : Marketplace (G7 Seller Party Foundation)
-- Description:
--     Generic seller_parties + seller_types; link farmers/listings/orders
--     via additive seller_party_id with RC1 dual-write backfill.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS marketplace.seller_types (
    code         VARCHAR(40) PRIMARY KEY,
    name_en      VARCHAR(100) NOT NULL,
    name_am      VARCHAR(100),
    description  TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order   SMALLINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO marketplace.seller_types (code, name_en, name_am, sort_order)
VALUES
    ('FARMER', 'Farmer', 'አርሶ አደር', 10),
    ('INDIVIDUAL', 'Individual', 'ግለሰብ', 20),
    ('COOPERATIVE', 'Cooperative', 'ህብረት ሥራ', 30),
    ('BUSINESS', 'Business', 'ንግድ', 40),
    ('COMPANY', 'Company', 'ኩባንያ', 50),
    ('ORGANISATION', 'Organisation', 'ድርጅት', 60)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS marketplace.seller_parties (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id        UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    seller_type_code     VARCHAR(40) NOT NULL REFERENCES marketplace.seller_types(code) ON DELETE RESTRICT,
    display_name         VARCHAR(200) NOT NULL,
    legal_name           VARCHAR(200),
    description          TEXT,
    logo_url             VARCHAR(500),
    contact_email        VARCHAR(255),
    contact_phone        VARCHAR(30),
    address_text         VARCHAR(500),
    organization_id      UUID,
    business_profile_id  UUID,
    status               VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    verified             BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status  VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    verification_notes   VARCHAR(500),
    metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_seller_parties_status
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
    CONSTRAINT ck_seller_parties_verification_status
        CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'))
);

CREATE INDEX IF NOT EXISTS idx_seller_parties_owner_user
    ON marketplace.seller_parties (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_seller_parties_type
    ON marketplace.seller_parties (seller_type_code);

CREATE INDEX IF NOT EXISTS idx_seller_parties_status
    ON marketplace.seller_parties (status);

COMMENT ON TABLE marketplace.seller_parties IS
'G7 generic seller actor. FarmerProfile is an agri specialization linked 1:1 for RC1.';

-- Farmer specialization link
ALTER TABLE marketplace.farmer_profiles
    ADD COLUMN IF NOT EXISTS seller_party_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_farmer_profiles_seller_party'
    ) THEN
        ALTER TABLE marketplace.farmer_profiles
            ADD CONSTRAINT fk_farmer_profiles_seller_party
            FOREIGN KEY (seller_party_id)
            REFERENCES marketplace.seller_parties(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_farmer_profiles_seller_party
    ON marketplace.farmer_profiles (seller_party_id)
    WHERE seller_party_id IS NOT NULL;

-- Listing ownership bridge
ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS seller_party_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_listings_seller_party'
    ) THEN
        ALTER TABLE marketplace.listings
            ADD CONSTRAINT fk_listings_seller_party
            FOREIGN KEY (seller_party_id)
            REFERENCES marketplace.seller_parties(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_seller_party
    ON marketplace.listings (seller_party_id);

-- Order seller bridge
ALTER TABLE orders.orders
    ADD COLUMN IF NOT EXISTS seller_party_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_seller_party'
    ) THEN
        ALTER TABLE orders.orders
            ADD CONSTRAINT fk_orders_seller_party
            FOREIGN KEY (seller_party_id)
            REFERENCES marketplace.seller_parties(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_seller_party
    ON orders.orders (seller_party_id);

-- Backfill: one FARMER seller party per existing farmer profile
INSERT INTO marketplace.seller_parties (
    id,
    owner_user_id,
    seller_type_code,
    display_name,
    contact_phone,
    address_text,
    status,
    verified,
    verification_status,
    verification_notes,
    metadata
)
SELECT
    gen_random_uuid(),
    fp.user_id,
    'FARMER',
    COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''),
        CONCAT('Farmer — ', fp.region)
    ),
    u.phone,
    CONCAT_WS(', ', fp.woreda, fp.zone, fp.region),
    'ACTIVE',
    fp.verified,
    COALESCE(fp.verification_status, 'PENDING'),
    fp.verification_notes,
    jsonb_build_object('source', 'g7_farmer_backfill', 'farmerProfileId', fp.id)
FROM marketplace.farmer_profiles fp
JOIN identity.users u ON u.id = fp.user_id
WHERE fp.seller_party_id IS NULL;

UPDATE marketplace.farmer_profiles fp
SET seller_party_id = sp.id,
    updated_at = NOW()
FROM marketplace.seller_parties sp
WHERE fp.seller_party_id IS NULL
  AND sp.owner_user_id = fp.user_id
  AND sp.seller_type_code = 'FARMER'
  AND (sp.metadata->>'farmerProfileId') = fp.id::text;

-- Dual-write existing listings / orders
UPDATE marketplace.listings l
SET seller_party_id = fp.seller_party_id,
    updated_at = NOW()
FROM marketplace.farmer_profiles fp
WHERE l.farmer_id = fp.id
  AND l.seller_party_id IS NULL
  AND fp.seller_party_id IS NOT NULL;

UPDATE orders.orders o
SET seller_party_id = fp.seller_party_id
FROM marketplace.farmer_profiles fp
WHERE o.farmer_id = fp.id
  AND o.seller_party_id IS NULL
  AND fp.seller_party_id IS NOT NULL;

COMMIT;
