-- ============================================================================
-- Nahu Platform
-- Migration : 010_farms_activity_types_am_labels.sql
-- Module    : Farms
-- Phase     : Amharic localization follow-up
-- Description:
--     Update activity_types.name_am after farmer Amharic review.
--     Safe to re-run (idempotent UPDATEs).
-- ============================================================================

BEGIN;

UPDATE farms.activity_types SET name_am = 'መትከል' WHERE code = 'PLANTING';
UPDATE farms.activity_types SET name_am = 'ርጭት' WHERE code = 'SPRAYING';
UPDATE farms.activity_types SET name_am = 'አረም ማረም' WHERE code = 'WEEDING';
UPDATE farms.activity_types SET name_am = 'ግርዛት' WHERE code = 'PRUNING';
UPDATE farms.activity_types SET name_am = 'የማሳ ምርመራ' WHERE code = 'SCOUTING';

COMMIT;
