-- ============================================================================
-- Nahu Platform
-- Migration : 004_farms_farm_parties.sql
-- Module    : Farms (Phase 4.1)
-- ============================================================================

BEGIN;

CREATE TABLE farms.farm_parties
(
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    farm_id           UUID NOT NULL,

    farmer_profile_id UUID,

    cooperative_id    UUID,

    party_role        farms.party_role NOT NULL,

    tenure_type       farms.tenure_type,

    is_primary        BOOLEAN NOT NULL DEFAULT FALSE,

    valid_from        DATE,

    valid_to          DATE,

    status            farms.farm_status NOT NULL DEFAULT 'ACTIVE',

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_farm_parties_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms.farms (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_farm_parties_farmer
        FOREIGN KEY (farmer_profile_id)
        REFERENCES marketplace.farmer_profiles (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_farm_parties_cooperative
        FOREIGN KEY (cooperative_id)
        REFERENCES marketplace.cooperatives (id)
        ON DELETE CASCADE,

    CONSTRAINT chk_farm_party_actor CHECK (
        farmer_profile_id IS NOT NULL OR cooperative_id IS NOT NULL
    )
);

CREATE INDEX idx_farm_parties_farm_id ON farms.farm_parties (farm_id);

CREATE INDEX idx_farm_parties_farmer_profile_id ON farms.farm_parties (farmer_profile_id);

CREATE UNIQUE INDEX uq_farms_one_primary_party
    ON farms.farm_parties (farm_id)
    WHERE is_primary = TRUE AND status = 'ACTIVE';

COMMENT ON TABLE farms.farm_parties IS
'Who may access a farm (owner, tenant, coop manager, …).';

COMMIT;
