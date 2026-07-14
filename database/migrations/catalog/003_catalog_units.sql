-- ============================================================================
-- Nahu Platform
-- Migration : 003_catalog_units.sql
-- Module    : Catalog
-- Phase     : 3 — Product Catalog
-- Description:
--     Canonical units of measure for products, future inventory, and pricing.
-- ============================================================================

BEGIN;

CREATE TABLE catalog.units
(
    code       VARCHAR(20) PRIMARY KEY,

    name_en    VARCHAR(50) NOT NULL,

    name_am    VARCHAR(50) NOT NULL,

    dimension  VARCHAR(20) NOT NULL
        CHECK (dimension IN ('MASS', 'VOLUME', 'COUNT', 'LENGTH', 'OTHER')),

    sort_order SMALLINT NOT NULL DEFAULT 0
);

COMMENT ON TABLE catalog.units IS
'Canonical units of measure for Nahu Farms products and future inventory.';

COMMENT ON COLUMN catalog.units.dimension IS
'Measurement kind for future conversion rules (MASS, VOLUME, COUNT, LENGTH, OTHER).';

INSERT INTO catalog.units (code, name_en, name_am, dimension, sort_order)
VALUES
    ('KG',      'Kilogram',  'ኪሎግራም',   'MASS',   1),
    ('QUINTAL', 'Quintal',   'ኩንታል',    'MASS',   2),
    ('BAG',     'Bag',       'ከረጢት',    'MASS',   3),
    ('LITER',   'Liter',     'ሊትር',     'VOLUME', 4),
    ('HEAD',    'Head',      'ራስ',      'COUNT',  5),
    ('PIECE',   'Piece',     'ቁራጭ',     'COUNT',  6),
    ('CRATE',   'Crate',     'ሳጥን',     'COUNT',  7),
    ('METER',   'Meter',     'ሜትር',     'LENGTH', 8)
ON CONFLICT (code) DO NOTHING;

COMMIT;
