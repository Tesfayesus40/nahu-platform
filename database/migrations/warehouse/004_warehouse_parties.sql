-- ============================================================================
-- Nahu Platform
-- Migration : 004_warehouse_parties.sql
-- Module    : Warehouse (Phase 4.3)
-- ============================================================================

BEGIN;

CREATE TABLE warehouse.warehouse_parties
(
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    storage_site_id    UUID NOT NULL,

    farmer_profile_id  UUID,

    cooperative_id     UUID,

    party_role         warehouse.party_role NOT NULL,

    is_primary         BOOLEAN NOT NULL DEFAULT FALSE,

    status             warehouse.party_status NOT NULL DEFAULT 'ACTIVE',

    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_warehouse_parties_site
        FOREIGN KEY (storage_site_id)
        REFERENCES warehouse.storage_sites (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_warehouse_parties_farmer
        FOREIGN KEY (farmer_profile_id)
        REFERENCES marketplace.farmer_profiles (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_warehouse_parties_cooperative
        FOREIGN KEY (cooperative_id)
        REFERENCES marketplace.cooperatives (id)
        ON DELETE CASCADE,

    CONSTRAINT chk_warehouse_party_actor CHECK (
        farmer_profile_id IS NOT NULL OR cooperative_id IS NOT NULL
    )
);

CREATE INDEX idx_warehouse_parties_site_id
    ON warehouse.warehouse_parties (storage_site_id);

CREATE INDEX idx_warehouse_parties_farmer_profile_id
    ON warehouse.warehouse_parties (farmer_profile_id);

CREATE UNIQUE INDEX uq_warehouse_one_primary_party
    ON warehouse.warehouse_parties (storage_site_id)
    WHERE is_primary = TRUE AND status = 'ACTIVE';

COMMENT ON TABLE warehouse.warehouse_parties IS
'Who may access a storage site (farmer owner/manager; coop later).';

COMMIT;
