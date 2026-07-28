-- ============================================================================
-- Nahu Platform
-- Migration : catalog/017_catalog_seed_g3_units.sql
-- Module    : Catalog (G3)
-- Description:
--     Additional units so the platform is not kg-centric.
-- ============================================================================

BEGIN;

INSERT INTO catalog.units (code, name_en, name_am, dimension, sort_order)
VALUES
    ('G',     'Gram',   'ግራም',      'MASS',   8),
    ('ML',    'Millilitre', 'ሚሊሊትር', 'VOLUME', 9),
    ('TONNE', 'Tonne',  'ቶን',       'MASS',   15),
    ('SACK',  'Sack',   'ጆንያ',      'MASS',   16)
ON CONFLICT (code) DO NOTHING;

COMMIT;
