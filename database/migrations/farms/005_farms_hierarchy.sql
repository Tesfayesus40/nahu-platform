-- ============================================================================
-- Nahu Platform
-- Migration : 005_farms_hierarchy.sql
-- Module    : Farms (Phase 4.1)
-- Description: Plot → Field → Production unit hierarchy tables.
-- ============================================================================

BEGIN;

CREATE TABLE farms.plots
(
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    farm_id             UUID NOT NULL,

    code                VARCHAR(40),

    name                VARCHAR(150) NOT NULL,

    name_am             VARCHAR(150),

    tenure_type         farms.tenure_type,

    status              farms.farm_status NOT NULL DEFAULT 'ACTIVE',

    size_ha             NUMERIC(10, 2),

    centroid_lat        NUMERIC(9, 6),

    centroid_lng        NUMERIC(9, 6),

    boundary_geojson    JSONB,

    boundary_source     VARCHAR(40),

    boundary_updated_at TIMESTAMPTZ,

    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_plots_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms.farms (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_plots_farm_id ON farms.plots (farm_id);

CREATE TABLE farms.fields
(
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    plot_id             UUID NOT NULL,

    code                VARCHAR(40),

    name                VARCHAR(150) NOT NULL,

    name_am             VARCHAR(150),

    status              farms.farm_status NOT NULL DEFAULT 'ACTIVE',

    size_ha             NUMERIC(10, 2),

    centroid_lat        NUMERIC(9, 6),

    centroid_lng        NUMERIC(9, 6),

    boundary_geojson    JSONB,

    boundary_source     VARCHAR(40),

    boundary_updated_at TIMESTAMPTZ,

    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_fields_plot
        FOREIGN KEY (plot_id)
        REFERENCES farms.plots (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_fields_plot_id ON farms.fields (plot_id);

CREATE TABLE farms.production_units
(
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    farm_id             UUID NOT NULL,

    plot_id             UUID,

    field_id            UUID,

    code                VARCHAR(40),

    name                VARCHAR(150) NOT NULL,

    kind                farms.production_unit_kind NOT NULL DEFAULT 'GENERIC',

    status              farms.farm_status NOT NULL DEFAULT 'ACTIVE',

    size_ha             NUMERIC(10, 2),

    centroid_lat        NUMERIC(9, 6),

    centroid_lng        NUMERIC(9, 6),

    boundary_geojson    JSONB,

    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_production_units_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms.farms (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_production_units_plot
        FOREIGN KEY (plot_id)
        REFERENCES farms.plots (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_production_units_field
        FOREIGN KEY (field_id)
        REFERENCES farms.fields (id)
        ON DELETE SET NULL
);

CREATE INDEX idx_production_units_farm_id ON farms.production_units (farm_id);

COMMIT;
