-- ============================================================================
-- Nahu Platform
-- Migration : 009_farms_farm_activities.sql
-- Module    : Farms (Phase 4.8 — Farm Activities)
-- Description: Activity type lookup + farm activity ops log (no inventory writes).
-- ============================================================================

ALTER TYPE farms.audit_entity_type ADD VALUE IF NOT EXISTS 'FARM_ACTIVITY';

CREATE TYPE farms.farm_activity_status AS ENUM
(
    'PLANNED',
    'COMPLETED',
    'CANCELLED'
);

BEGIN;

CREATE TABLE farms.activity_types
(
    code            VARCHAR(40) PRIMARY KEY,
    name_en         VARCHAR(100) NOT NULL,
    name_am         VARCHAR(100) NOT NULL,
    description_en  TEXT,
    description_am  TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO farms.activity_types (code, name_en, name_am, sort_order) VALUES
    ('PLANTING', 'Planting', 'መዝራት', 10),
    ('FERTILIZER', 'Fertilizer', 'ማዳበሪያ', 20),
    ('IRRIGATION', 'Irrigation', 'መስኖ', 30),
    ('SPRAYING', 'Spraying', 'መርጨት', 40),
    ('WEEDING', 'Weeding', 'አረም ማጽዳት', 50),
    ('PRUNING', 'Pruning', 'መቁረጥ', 60),
    ('SCOUTING', 'Scouting', 'ምልከታ', 70),
    ('HARVESTING_SUPPORT', 'Harvesting support', 'የመከር ድጋፍ', 80),
    ('OTHER', 'Other', 'ሌላ', 90)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE farms.farm_activities
(
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id             UUID NOT NULL,
    plot_id             UUID,
    cropping_cycle_id   UUID,
    harvest_session_id  UUID,
    activity_type_code  VARCHAR(40) NOT NULL,
    status              farms.farm_activity_status NOT NULL DEFAULT 'COMPLETED',
    occurred_on         DATE,
    scheduled_on        DATE,
    occurred_at         TIMESTAMPTZ,
    notes               TEXT,
    attachment_urls     TEXT[] NOT NULL DEFAULT '{}',
    measure_qty         NUMERIC(14, 3),
    measure_unit_code   VARCHAR(20),
    area_ha             NUMERIC(10, 2),
    product_id          UUID,
    crew_count          INT,
    metadata            JSONB,
    created_by_user_id  UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_farm_activities_crew_count
        CHECK (crew_count IS NULL OR crew_count >= 0),
    CONSTRAINT ck_farm_activities_measure_qty
        CHECK (measure_qty IS NULL OR measure_qty > 0),
    CONSTRAINT ck_farm_activities_area_ha
        CHECK (area_ha IS NULL OR area_ha >= 0),
    CONSTRAINT ck_farm_activities_measure_pair
        CHECK (
            (measure_qty IS NULL AND measure_unit_code IS NULL)
            OR (measure_qty IS NOT NULL AND measure_unit_code IS NOT NULL)
        ),
    CONSTRAINT ck_farm_activities_completed_date
        CHECK (status <> 'COMPLETED' OR occurred_on IS NOT NULL),
    CONSTRAINT ck_farm_activities_planned_date
        CHECK (status <> 'PLANNED' OR scheduled_on IS NOT NULL),
    CONSTRAINT fk_farm_activities_farm
        FOREIGN KEY (farm_id) REFERENCES farms.farms (id) ON DELETE RESTRICT,
    CONSTRAINT fk_farm_activities_plot
        FOREIGN KEY (plot_id) REFERENCES farms.plots (id) ON DELETE SET NULL,
    CONSTRAINT fk_farm_activities_cycle
        FOREIGN KEY (cropping_cycle_id) REFERENCES farms.cropping_cycles (id) ON DELETE SET NULL,
    CONSTRAINT fk_farm_activities_harvest_session
        FOREIGN KEY (harvest_session_id) REFERENCES farms.harvest_sessions (id) ON DELETE SET NULL,
    CONSTRAINT fk_farm_activities_type
        FOREIGN KEY (activity_type_code) REFERENCES farms.activity_types (code) ON DELETE RESTRICT,
    CONSTRAINT fk_farm_activities_unit
        FOREIGN KEY (measure_unit_code) REFERENCES catalog.units (code) ON DELETE RESTRICT,
    CONSTRAINT fk_farm_activities_product
        FOREIGN KEY (product_id) REFERENCES catalog.products (id) ON DELETE SET NULL,
    CONSTRAINT fk_farm_activities_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES identity.users (id) ON DELETE SET NULL
);

CREATE INDEX ix_farm_activities_farm ON farms.farm_activities (farm_id);
CREATE INDEX ix_farm_activities_farm_occurred ON farms.farm_activities (farm_id, occurred_on DESC);
CREATE INDEX ix_farm_activities_type ON farms.farm_activities (activity_type_code);
CREATE INDEX ix_farm_activities_cycle ON farms.farm_activities (cropping_cycle_id);
CREATE INDEX ix_farm_activities_plot ON farms.farm_activities (plot_id);
CREATE INDEX ix_farm_activities_status ON farms.farm_activities (status);
CREATE INDEX ix_farm_activities_harvest_session ON farms.farm_activities (harvest_session_id);

COMMIT;
