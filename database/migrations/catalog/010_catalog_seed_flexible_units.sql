-- ============================================================================
-- Nahu Platform
-- Migration : 010_catalog_seed_flexible_units.sql
-- Module    : Catalog
-- Phase     : G1 — Marketplace contract generalization
-- Description:
--     Extra units for honey, eggs, vegetables, seedlings, and similar offers.
--     Safe to re-run (ON CONFLICT DO NOTHING).
-- ============================================================================

BEGIN;

INSERT INTO catalog.units (code, name_en, name_am, dimension, sort_order)
VALUES
    ('DOZEN',    'Dozen',    'ደርዘን',     'COUNT',  10),
    ('JAR',      'Jar',      'ማሰሮ',     'COUNT',  11),
    ('TRAY',     'Tray',     'ትሪ',      'COUNT',  12),
    ('BUNDLE',   'Bundle',   'ጥቅል',     'COUNT',  13),
    ('SEEDLING', 'Seedling', 'ችግኝ',     'COUNT',  14)
ON CONFLICT (code) DO NOTHING;

COMMIT;
