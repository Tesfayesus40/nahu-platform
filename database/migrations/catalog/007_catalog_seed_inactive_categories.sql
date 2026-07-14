-- ============================================================================
-- Nahu Platform
-- Migration : 007_catalog_seed_inactive_categories.sql
-- Module    : Catalog
-- Phase     : 3 — Product Catalog
-- Description:
--     Seeds inactive category skeleton for Ethiopian agricultural sectors.
--     Activate later with UPDATE + product inserts — no schema redesign.
-- ============================================================================

BEGIN;

INSERT INTO catalog.categories (code, name_en, name_am, description_en, description_am, is_active, sort_order)
VALUES
    ('CEREALS',    'Cereals',    'እህሎች',         'Teff, maize, wheat, sorghum, barley, and other cereals.', NULL, FALSE, 10),
    ('PULSES',     'Pulses',     'ጥራጥሬዎች',       'Beans, peas, chickpeas, lentils, and other pulses.', NULL, FALSE, 20),
    ('OILSEEDS',   'Oilseeds',   'የቅባት ዘሮች',    'Sesame, niger seed, and other oilseeds.', NULL, FALSE, 30),
    ('SPICES',     'Spices',     'ቅመማ ቅመም',     'Berbere, korarima, and other spices.', NULL, FALSE, 40),
    ('FRUITS',     'Fruits',     'ፍራፍሬዎች',       'Fresh and tree fruits.', NULL, FALSE, 50),
    ('VEGETABLES', 'Vegetables', 'አትክልቶች',       'Market vegetables.', NULL, FALSE, 60),
    ('LIVESTOCK',  'Livestock',  'ከብቶች',         'Cattle, goats, sheep, and other livestock.', NULL, FALSE, 70),
    ('DAIRY',      'Dairy',      'የወተት ተዋጽኦ',    'Milk, butter, and other dairy products.', NULL, FALSE, 80),
    ('HONEY',      'Honey',      'ማር',           'Natural and processed honey.', NULL, FALSE, 90),
    ('FISHERIES',  'Fisheries',  'ዓሣ',           'Freshwater and related fishery products.', NULL, FALSE, 100),
    ('FORESTRY',   'Forestry',   'ደን',           'Timber and other forest products.', NULL, FALSE, 110),
    ('OTHER',      'Other',      'ሌላ',           'Other agricultural products.', NULL, FALSE, 200)
ON CONFLICT (code) DO NOTHING;

COMMIT;
