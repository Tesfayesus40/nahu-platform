-- ============================================================================
-- Nahu Platform
-- Migration : marketplace/014_marketplace_listing_moderation.sql
-- Module    : Marketplace
-- Description:
--     Listing moderation status (separate from commercial listing_status),
--     decision history, and moderator notes.
-- ============================================================================

BEGIN;

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'
        CHECK (moderation_status IN (
            'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'FLAGGED'
        ));

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS moderation_notes TEXT;

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS moderated_by_user_id UUID
        REFERENCES identity.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_listings_moderation_status
    ON marketplace.listings (moderation_status);

CREATE INDEX IF NOT EXISTS idx_listings_moderation_status_created
    ON marketplace.listings (moderation_status, created_at DESC);

-- Existing live inventory stays publicly visible.
UPDATE marketplace.listings
SET moderation_status = 'APPROVED'
WHERE moderation_status = 'PENDING' AND status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS marketplace.listing_moderation_decisions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES marketplace.listings(id) ON DELETE CASCADE,
    decision VARCHAR(20) NOT NULL
        CHECK (decision IN (
            'APPROVE', 'REJECT', 'SUSPEND', 'FLAG', 'CLEAR_FLAG', 'NOTE'
        )),
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    reason TEXT,
    notes TEXT,
    actor_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_moderation_decisions_listing
    ON marketplace.listing_moderation_decisions (listing_id, created_at DESC);

COMMIT;
