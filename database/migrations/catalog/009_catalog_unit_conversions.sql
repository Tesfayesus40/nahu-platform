-- ============================================================================
-- Nahu Platform
-- Migration : 009_catalog_unit_conversions.sql
-- Module    : Catalog
-- Phase     : 4.2 — Inventory
-- Description: Same-dimension unit conversion factors for inventory.
-- ============================================================================

BEGIN;

CREATE TABLE catalog.unit_conversions
(
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    from_unit_code VARCHAR(20) NOT NULL,

    to_unit_code   VARCHAR(20) NOT NULL,

    factor         NUMERIC(18, 6) NOT NULL,

    CONSTRAINT fk_unit_conversions_from
        FOREIGN KEY (from_unit_code)
        REFERENCES catalog.units (code)
        ON DELETE RESTRICT,

    CONSTRAINT fk_unit_conversions_to
        FOREIGN KEY (to_unit_code)
        REFERENCES catalog.units (code)
        ON DELETE RESTRICT,

    CONSTRAINT chk_unit_conversions_factor CHECK (factor > 0),

    CONSTRAINT uq_unit_conversions_pair UNIQUE (from_unit_code, to_unit_code)
);

COMMENT ON TABLE catalog.unit_conversions IS
'Same-dimension conversion: to_qty = from_qty * factor. No cross-dimension conversions.';

INSERT INTO catalog.unit_conversions (from_unit_code, to_unit_code, factor)
VALUES
    ('QUINTAL', 'KG', 100),
    ('KG', 'QUINTAL', 0.01)
ON CONFLICT (from_unit_code, to_unit_code) DO NOTHING;

COMMIT;
