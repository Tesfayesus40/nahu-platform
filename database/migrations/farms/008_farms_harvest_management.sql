-- ============================================================================
-- Nahu Platform
-- Migration : 008_farms_harvest_management.sql
-- Module    : Farms (Phase 4.7 — Harvest Management)
-- Description: Harvest sessions + lines; post into inventory RECEIVE (stock SoR).
-- ============================================================================

ALTER TYPE farms.audit_entity_type ADD VALUE IF NOT EXISTS 'HARVEST_SESSION';
ALTER TYPE farms.audit_entity_type ADD VALUE IF NOT EXISTS 'HARVEST_LINE';

CREATE TYPE farms.harvest_session_status AS ENUM
(
    'DRAFT',
    'POSTED'
);

BEGIN;

CREATE TABLE farms.harvest_sessions
(
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id            UUID NOT NULL,
    plot_id            UUID,
    cropping_cycle_id  UUID,
    harvested_on       DATE NOT NULL,
    harvested_at       TIMESTAMPTZ,
    status             farms.harvest_session_status NOT NULL DEFAULT 'DRAFT',
    notes              TEXT,
    crew_count         INT,
    photo_urls         TEXT[] NOT NULL DEFAULT '{}',
    posted_at          TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_harvest_sessions_crew_count
        CHECK (crew_count IS NULL OR crew_count >= 0),
    CONSTRAINT fk_harvest_sessions_farm
        FOREIGN KEY (farm_id) REFERENCES farms.farms (id) ON DELETE RESTRICT,
    CONSTRAINT fk_harvest_sessions_plot
        FOREIGN KEY (plot_id) REFERENCES farms.plots (id) ON DELETE SET NULL,
    CONSTRAINT fk_harvest_sessions_cycle
        FOREIGN KEY (cropping_cycle_id) REFERENCES farms.cropping_cycles (id) ON DELETE SET NULL
);

CREATE INDEX ix_harvest_sessions_farm ON farms.harvest_sessions (farm_id);
CREATE INDEX ix_harvest_sessions_status ON farms.harvest_sessions (status);
CREATE INDEX ix_harvest_sessions_cycle ON farms.harvest_sessions (cropping_cycle_id);
CREATE INDEX ix_harvest_sessions_farm_date ON farms.harvest_sessions (farm_id, harvested_on DESC);

CREATE TABLE farms.harvest_lines
(
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID NOT NULL,
    product_id              UUID NOT NULL,
    product_variety_id      UUID,
    qty                     NUMERIC(14, 3) NOT NULL,
    unit_code               VARCHAR(20) NOT NULL,
    moisture_pct            NUMERIC(5, 2),
    harvest_grade_class     VARCHAR(40),
    quality_note            TEXT,
    photo_urls              TEXT[] NOT NULL DEFAULT '{}',
    storage_site_id         UUID,
    cropping_cycle_line_id  UUID,
    stock_lot_id            UUID,
    sort_order              INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_harvest_lines_qty
        CHECK (qty > 0),
    CONSTRAINT ck_harvest_lines_moisture
        CHECK (moisture_pct IS NULL OR (moisture_pct >= 0 AND moisture_pct <= 100)),
    CONSTRAINT fk_harvest_lines_session
        FOREIGN KEY (session_id) REFERENCES farms.harvest_sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_harvest_lines_product
        FOREIGN KEY (product_id) REFERENCES catalog.products (id) ON DELETE RESTRICT,
    CONSTRAINT fk_harvest_lines_variety
        FOREIGN KEY (product_variety_id) REFERENCES catalog.product_varieties (id) ON DELETE SET NULL,
    CONSTRAINT fk_harvest_lines_unit
        FOREIGN KEY (unit_code) REFERENCES catalog.units (code) ON DELETE RESTRICT,
    CONSTRAINT fk_harvest_lines_storage_site
        FOREIGN KEY (storage_site_id) REFERENCES warehouse.storage_sites (id) ON DELETE SET NULL,
    CONSTRAINT fk_harvest_lines_cycle_line
        FOREIGN KEY (cropping_cycle_line_id) REFERENCES farms.cropping_cycle_lines (id) ON DELETE SET NULL,
    CONSTRAINT fk_harvest_lines_stock_lot
        FOREIGN KEY (stock_lot_id) REFERENCES inventory.stock_lots (id) ON DELETE SET NULL
);

CREATE INDEX ix_harvest_lines_session ON farms.harvest_lines (session_id);
CREATE INDEX ix_harvest_lines_product ON farms.harvest_lines (product_id);
CREATE INDEX ix_harvest_lines_stock_lot ON farms.harvest_lines (stock_lot_id);

COMMIT;
