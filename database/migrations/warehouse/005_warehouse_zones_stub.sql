-- ============================================================================
-- Nahu Platform
-- Migration : 005_warehouse_zones_stub.sql
-- Module    : Warehouse (Phase 4.3)
-- Description: Future zone hierarchy stub — no API in 4.3 MVP.
-- ============================================================================

BEGIN;

CREATE TABLE warehouse.storage_zones
(
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    storage_site_id  UUID NOT NULL,

    code             VARCHAR(40),

    name             VARCHAR(150) NOT NULL,

    status           warehouse.site_status NOT NULL DEFAULT 'ACTIVE',

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_storage_zones_site
        FOREIGN KEY (storage_site_id)
        REFERENCES warehouse.storage_sites (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_storage_zones_site_id ON warehouse.storage_zones (storage_site_id);

COMMENT ON TABLE warehouse.storage_zones IS
'Stub for future WMS zones under a storage site. Unused by Phase 4.3 APIs.';

COMMIT;
