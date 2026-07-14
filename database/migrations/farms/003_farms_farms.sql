-- ============================================================================
-- Nahu Platform
-- Migration : 003_farms_farms.sql
-- Module    : Farms (Phase 4.1)
-- Description:
--     Farm holdings. Products are NOT owned here — listings/cycles/stock
--     reference catalog.products separately.
-- ============================================================================

BEGIN;

CREATE TABLE farms.farms
(
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code                VARCHAR(40),

    name                VARCHAR(150) NOT NULL,

    name_am             VARCHAR(150),

    tenure_type         farms.tenure_type NOT NULL DEFAULT 'OWNED',

    cooperative_id      UUID,

    status              farms.farm_status NOT NULL DEFAULT 'ACTIVE',

    region              VARCHAR(100) NOT NULL,

    region_en           VARCHAR(100),

    zone                VARCHAR(100),

    woreda              VARCHAR(100),

    kebele              VARCHAR(100),

    altitude_m          NUMERIC(6, 1),

    size_ha             NUMERIC(10, 2),

    centroid_lat        NUMERIC(9, 6),

    centroid_lng        NUMERIC(9, 6),

    boundary_geojson    JSONB,

    boundary_source     VARCHAR(40),

    boundary_updated_at TIMESTAMPTZ,

    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_farms_cooperative
        FOREIGN KEY (cooperative_id)
        REFERENCES marketplace.cooperatives (id)
        ON DELETE SET NULL
);

CREATE INDEX idx_farms_status ON farms.farms (status);

CREATE INDEX idx_farms_cooperative_id ON farms.farms (cooperative_id);

COMMENT ON TABLE farms.farms IS
'Production holdings. Does not own catalog products — listings and cropping cycles reference products.';

COMMIT;
