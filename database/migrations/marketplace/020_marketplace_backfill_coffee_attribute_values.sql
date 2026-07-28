-- ============================================================================
-- Nahu Platform
-- Migration : marketplace/020_marketplace_backfill_coffee_attribute_values.sql
-- Module    : Marketplace (G3)
-- Description:
--     Backfill listing_attribute_values from existing coffee listing columns
--     for definitions that declare legacy_column. Idempotent.
-- ============================================================================

BEGIN;

-- Text / enum-as-text dual-write from varchar/enum columns
INSERT INTO marketplace.listing_attribute_values (
    listing_id, attribute_definition_id, value_text, enum_value_id
)
SELECT
    l.id,
    ad.id,
    CASE ad.legacy_column
        WHEN 'grade' THEN l.grade::text
        WHEN 'process_method' THEN l.process_method::text
        WHEN 'variety' THEN l.variety
        WHEN 'region' THEN l.region
        WHEN 'washing_station' THEN l.washing_station
        ELSE NULL
    END,
    ev.id
FROM marketplace.listings l
JOIN catalog.attribute_definitions ad
  ON ad.category_id = l.category_id
 AND ad.legacy_column IN ('grade', 'process_method', 'variety', 'region', 'washing_station')
 AND ad.is_active = TRUE
LEFT JOIN catalog.attribute_enum_values ev
  ON ad.enum_set_id = ev.enum_set_id
 AND ev.code = CASE ad.legacy_column
        WHEN 'grade' THEN l.grade::text
        WHEN 'process_method' THEN l.process_method::text
        ELSE NULL
     END
WHERE l.category_id IS NOT NULL
  AND CASE ad.legacy_column
        WHEN 'grade' THEN l.grade IS NOT NULL
        WHEN 'process_method' THEN l.process_method IS NOT NULL
        WHEN 'variety' THEN l.variety IS NOT NULL
        WHEN 'region' THEN l.region IS NOT NULL
        WHEN 'washing_station' THEN l.washing_station IS NOT NULL
        ELSE FALSE
      END
ON CONFLICT (listing_id, attribute_definition_id) DO NOTHING;

-- Numeric dual-write
INSERT INTO marketplace.listing_attribute_values (
    listing_id, attribute_definition_id, value_num
)
SELECT
    l.id,
    ad.id,
    CASE ad.legacy_column
        WHEN 'altitude_m' THEN l.altitude_m
        WHEN 'cup_score' THEN l.cup_score
        ELSE NULL
    END
FROM marketplace.listings l
JOIN catalog.attribute_definitions ad
  ON ad.category_id = l.category_id
 AND ad.legacy_column IN ('altitude_m', 'cup_score')
 AND ad.is_active = TRUE
WHERE l.category_id IS NOT NULL
  AND CASE ad.legacy_column
        WHEN 'altitude_m' THEN l.altitude_m IS NOT NULL
        WHEN 'cup_score' THEN l.cup_score IS NOT NULL
        ELSE FALSE
      END
ON CONFLICT (listing_id, attribute_definition_id) DO NOTHING;

COMMIT;
