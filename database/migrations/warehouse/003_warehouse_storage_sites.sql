-- ============================================================================
-- Nahu Platform
-- Migration : 003_warehouse_storage_sites.sql
-- Module    : Warehouse (Phase 4.3)
-- ============================================================================

BEGIN;

CREATE TABLE warehouse.storage_sites
(
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code                VARCHAR(40),

    name                VARCHAR(150) NOT NULL,

    name_am             VARCHAR(150),

    site_type           warehouse.site_type NOT NULL,

    status              warehouse.site_status NOT NULL DEFAULT 'ACTIVE',

    farm_id             UUID,

    cooperative_id      UUID,

    region              VARCHAR(100),

    region_en           VARCHAR(100),

    zone                VARCHAR(100),

    woreda              VARCHAR(100),

    kebele              VARCHAR(100),

    centroid_lat        NUMERIC(10, 7),

    centroid_lng        NUMERIC(10, 7),

    capacity            NUMERIC(14, 3),

    capacity_unit_code  VARCHAR(20),

    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_storage_sites_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms.farms (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_storage_sites_cooperative
        FOREIGN KEY (cooperative_id)
        REFERENCES marketplace.cooperatives (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_storage_sites_capacity_unit
        FOREIGN KEY (capacity_unit_code)
        REFERENCES catalog.units (code)
        ON DELETE RESTRICT,

    CONSTRAINT chk_storage_sites_on_farm_has_farm CHECK (
        site_type <> 'ON_FARM' OR farm_id IS NOT NULL
    ),

    CONSTRAINT chk_storage_sites_capacity CHECK (
        capacity IS NULL OR capacity >= 0
    )
);

CREATE INDEX idx_storage_sites_farm_id ON warehouse.storage_sites (farm_id);

CREATE INDEX idx_storage_sites_status ON warehouse.storage_sites (status);

CREATE INDEX idx_storage_sites_site_type ON warehouse.storage_sites (site_type);

COMMENT ON TABLE warehouse.storage_sites IS
'Named hold locations for inventory lots. Farm ≠ warehouse; Product ≠ warehouse.';

COMMIT;
