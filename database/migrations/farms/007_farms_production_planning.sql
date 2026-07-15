-- ============================================================================
-- Nahu Platform
-- Migration : 007_farms_production_planning.sql
-- Module    : Farms (Phase 4.5 — Production Planning)
-- Description: Configurable season codes, cropping cycles/lines, audit entity types.
-- ============================================================================

-- ADD VALUE cannot reliably share a transaction with first use on all PG versions.
ALTER TYPE farms.audit_entity_type ADD VALUE IF NOT EXISTS 'CROPPING_CYCLE';
ALTER TYPE farms.audit_entity_type ADD VALUE IF NOT EXISTS 'CROPPING_CYCLE_LINE';

CREATE TYPE farms.cropping_cycle_status AS ENUM
(
    'DRAFT',
    'PLANNED',
    'IN_PROGRESS',
    'HARVESTED',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED'
);

BEGIN;

CREATE TABLE farms.season_codes
(
    code         VARCHAR(40) PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    name_am      VARCHAR(100),
    region_hint  VARCHAR(40),
    sort_order   INT NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    metadata     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO farms.season_codes (code, name, name_am, region_hint, sort_order) VALUES
    ('BELG', 'Belg', NULL, 'ET', 10),
    ('MEHER', 'Meher', NULL, 'ET', 20),
    ('IRRIGATION', 'Irrigation', NULL, NULL, 30),
    ('YEAR_ROUND', 'Year-round', NULL, NULL, 40),
    ('CUSTOM', 'Custom', NULL, NULL, 90)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE farms.cropping_cycles
(
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id            UUID NOT NULL,
    plot_id            UUID,
    field_id           UUID,
    production_unit_id UUID,
    code               VARCHAR(40),
    name               VARCHAR(150) NOT NULL,
    name_am            VARCHAR(150),
    season_year        INT NOT NULL,
    season_code        VARCHAR(40) NOT NULL,
    starts_on          DATE NOT NULL,
    ends_on            DATE NOT NULL,
    status             farms.cropping_cycle_status NOT NULL DEFAULT 'DRAFT',
    notes              TEXT,
    metadata           JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_cropping_cycles_season_year
        CHECK (season_year BETWEEN 1990 AND 2100),
    CONSTRAINT ck_cropping_cycles_window
        CHECK (ends_on >= starts_on),
    CONSTRAINT fk_cropping_cycles_farm
        FOREIGN KEY (farm_id) REFERENCES farms.farms (id) ON DELETE RESTRICT,
    CONSTRAINT fk_cropping_cycles_plot
        FOREIGN KEY (plot_id) REFERENCES farms.plots (id) ON DELETE SET NULL,
    CONSTRAINT fk_cropping_cycles_field
        FOREIGN KEY (field_id) REFERENCES farms.fields (id) ON DELETE SET NULL,
    CONSTRAINT fk_cropping_cycles_production_unit
        FOREIGN KEY (production_unit_id) REFERENCES farms.production_units (id) ON DELETE SET NULL,
    CONSTRAINT fk_cropping_cycles_season_code
        FOREIGN KEY (season_code) REFERENCES farms.season_codes (code) ON DELETE RESTRICT
);

CREATE INDEX idx_cropping_cycles_farm_id ON farms.cropping_cycles (farm_id);
CREATE INDEX idx_cropping_cycles_season ON farms.cropping_cycles (farm_id, season_year, season_code);
CREATE INDEX idx_cropping_cycles_status ON farms.cropping_cycles (status);
CREATE INDEX idx_cropping_cycles_window ON farms.cropping_cycles (starts_on, ends_on);

CREATE TABLE farms.cropping_cycle_lines
(
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id           UUID NOT NULL,
    product_id         UUID NOT NULL,
    product_variety_id UUID,
    planned_qty        NUMERIC(14, 3) NOT NULL,
    unit_code          VARCHAR(20) NOT NULL,
    planned_area_ha    NUMERIC(10, 2),
    sort_order         INT NOT NULL DEFAULT 0,
    notes              TEXT,
    metadata           JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_cropping_cycle_lines_planned_qty
        CHECK (planned_qty > 0),
    CONSTRAINT fk_cropping_cycle_lines_cycle
        FOREIGN KEY (cycle_id) REFERENCES farms.cropping_cycles (id) ON DELETE CASCADE,
    CONSTRAINT fk_cropping_cycle_lines_product
        FOREIGN KEY (product_id) REFERENCES catalog.products (id) ON DELETE RESTRICT,
    CONSTRAINT fk_cropping_cycle_lines_variety
        FOREIGN KEY (product_variety_id) REFERENCES catalog.product_varieties (id) ON DELETE SET NULL,
    CONSTRAINT fk_cropping_cycle_lines_unit
        FOREIGN KEY (unit_code) REFERENCES catalog.units (code) ON DELETE RESTRICT,
    CONSTRAINT uq_cropping_cycle_lines_cycle_product
        UNIQUE (cycle_id, product_id)
);

CREATE INDEX idx_cycle_lines_product ON farms.cropping_cycle_lines (product_id);
CREATE INDEX idx_cycle_lines_cycle ON farms.cropping_cycle_lines (cycle_id);

COMMENT ON TABLE farms.season_codes IS
'Configurable agricultural season codes. Regional expansion = INSERT rows; not a closed enum.';

COMMENT ON TABLE farms.cropping_cycles IS
'Production planning windows (seasons/cycles). Plans do not mutate inventory or listings.';

COMMENT ON TABLE farms.cropping_cycle_lines IS
'Planned product quantities per cropping cycle. Actuals derived from inventory RECEIVE events.';

COMMIT;
