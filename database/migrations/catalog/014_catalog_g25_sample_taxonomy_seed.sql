-- ============================================================================
-- Nahu Platform
-- Migration : catalog/014_catalog_g25_sample_taxonomy_seed.sql
-- Module    : Catalog (G2.5 stabilization)
-- Description:
--     Development seed for multi-vertical sample taxonomy. All rows are
--     inactive / not sell-enabled. Validates Marketplace Engine supports
--     Agriculture (Honey, Livestock products), Construction, and Retail
--     without schema changes. Does NOT activate sell-through.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Construction categories (vertical CONSTRUCTION — already inactive)
-- ---------------------------------------------------------------------------
INSERT INTO catalog.categories (
    code, name_en, name_am, description_en, description_am,
    marketplace_vertical_id, listing_kind, sell_enabled, is_active, sort_order
)
SELECT
    v.code,
    v.name_en,
    v.name_am,
    v.description_en,
    v.description_am,
    mv.id,
    'GOODS',
    FALSE,
    FALSE,
    v.sort_order
FROM catalog.marketplace_verticals mv
CROSS JOIN (
    VALUES
        ('CEMENT', 'Cement', 'ሲሚንቶ', 'Construction cement and binders.', NULL, 10),
        ('STEEL',  'Steel',  'ብረት',   'Structural and trade steel products.', NULL, 20)
) AS v(code, name_en, name_am, description_en, description_am, sort_order)
WHERE mv.code = 'CONSTRUCTION'
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Retail categories (vertical RETAIL — already inactive)
-- ---------------------------------------------------------------------------
INSERT INTO catalog.categories (
    code, name_en, name_am, description_en, description_am,
    marketplace_vertical_id, listing_kind, sell_enabled, is_active, sort_order
)
SELECT
    v.code,
    v.name_en,
    v.name_am,
    v.description_en,
    v.description_am,
    mv.id,
    'GOODS',
    FALSE,
    FALSE,
    v.sort_order
FROM catalog.marketplace_verticals mv
CROSS JOIN (
    VALUES
        ('ELECTRONICS', 'Electronics', 'ኤሌክትሮኒክስ', 'Consumer electronics.', NULL, 10),
        ('FURNITURE',   'Furniture',   'ፈርኒቸር',     'Home and office furniture.', NULL, 20)
) AS v(code, name_en, name_am, description_en, description_am, sort_order)
WHERE mv.code = 'RETAIL'
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sample product types (all INACTIVE, not default)
-- ---------------------------------------------------------------------------
INSERT INTO catalog.products (
    category_id, code, name_en, name_am, description_en, description_am,
    default_unit_code, status, is_default, sort_order
)
SELECT c.id, p.code, p.name_en, p.name_am, p.description_en, p.description_am,
       p.unit, 'INACTIVE'::catalog.product_status, FALSE, p.sort_order
FROM catalog.categories c
JOIN (
    VALUES
        -- Agriculture / Coffee already has ACTIVE types — sample specialty only
        ('HONEY',      'RAW_HONEY',           'Raw Honey',           'ጥሬ ማር',           'Unprocessed honey.', NULL, 'KG', 1),
        ('HONEY',      'PROCESSED_HONEY',     'Processed Honey',     'የተቀናበረ ማር',       'Filtered / jarred honey.', NULL, 'JAR', 2),
        ('LIVESTOCK',  'CATTLE',              'Cattle',              'ከብት',             'Live cattle.', NULL, 'HEAD', 1),
        ('LIVESTOCK',  'GOATS',               'Goats',               'ፍየል',             'Live goats.', NULL, 'HEAD', 2),
        ('CEMENT',     'PORTLAND_CEMENT',     'Portland Cement',     'ፖርትላንድ ሲሚንቶ',   'General purpose Portland cement.', NULL, 'KG', 1),
        ('STEEL',      'REBAR',               'Rebar',               'የብረት ዘንግ',        'Reinforcing bar.', NULL, 'KG', 1),
        ('STEEL',      'STRUCTURAL_STEEL',    'Structural Steel',    'መዋቅራዊ ብረት',      'Beams and sections.', NULL, 'KG', 2),
        ('ELECTRONICS','SMARTPHONE',          'Smartphone',          'ስማርትፎን',          'Mobile phones.', NULL, 'PIECE', 1),
        ('FURNITURE',  'SOFA',                'Sofa',                'ሶፋ',              'Living-room sofa.', NULL, 'PIECE', 1),
        ('FURNITURE',  'DINING_TABLE',        'Dining Table',        'የመመገቢያ ጠረጴዛ',   'Dining tables.', NULL, 'PIECE', 2)
) AS p(category_code, code, name_en, name_am, description_en, description_am, unit, sort_order)
  ON c.code = p.category_code
ON CONFLICT (code) DO NOTHING;

-- Sample varieties (inactive products may still carry variety taxonomy)
INSERT INTO catalog.product_varieties (product_id, code, name_en, name_am, is_active, sort_order)
SELECT p.id, v.code, v.name_en, v.name_am, TRUE, v.sort_order
FROM catalog.products p
CROSS JOIN (
    VALUES
        ('FLORAL', 'Floral', 'አበባ', 1),
        ('FOREST', 'Forest', 'ደን', 2)
) AS v(code, name_en, name_am, sort_order)
WHERE p.code = 'RAW_HONEY'
ON CONFLICT (product_id, code) DO NOTHING;

INSERT INTO catalog.product_varieties (product_id, code, name_en, name_am, is_active, sort_order)
SELECT p.id, v.code, v.name_en, v.name_am, TRUE, v.sort_order
FROM catalog.products p
CROSS JOIN (
    VALUES
        ('LOCAL',  'Local breed',  'አካባቢያዊ', 1),
        ('HYBRID', 'Hybrid',       'ድቅል',     2)
) AS v(code, name_en, name_am, sort_order)
WHERE p.code = 'CATTLE'
ON CONFLICT (product_id, code) DO NOTHING;

COMMIT;
