-- ============================================================================
-- Nahu Platform
-- Migration : 009_orders_unit_fields.sql
-- Module    : Orders
-- Phase     : B1 — Buyer order/certificate unit contract
-- Description:
--     Additive unit-aware quantity/price on orders and certificates.
--     Backfills from quantity_kg (unit_code = KG).
--     Safe to re-run.
-- ============================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- orders.orders
-- -------------------------------------------------------------------------

ALTER TABLE orders.orders
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 3);

ALTER TABLE orders.orders
    ADD COLUMN IF NOT EXISTS unit_code VARCHAR(20);

ALTER TABLE orders.orders
    ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC(12, 2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_orders_unit_code'
          AND conrelid = 'orders.orders'::regclass
    ) THEN
        ALTER TABLE orders.orders
            ADD CONSTRAINT fk_orders_unit_code
            FOREIGN KEY (unit_code)
            REFERENCES catalog.units (code)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_unit_code
    ON orders.orders (unit_code);

COMMENT ON COLUMN orders.orders.quantity IS
'Canonical ordered quantity in unit_code. Dual-written with quantity_kg for legacy clients.';

COMMENT ON COLUMN orders.orders.unit_code IS
'Sale unit snapshot from the listing at order time.';

COMMENT ON COLUMN orders.orders.price_per_unit IS
'Unit price snapshot (ETB) at order time. Dual-related to total_etb = price_per_unit * quantity.';

UPDATE orders.orders
SET
    quantity = quantity_kg,
    unit_code = 'KG',
    price_per_unit = CASE
        WHEN quantity_kg > 0 THEN ROUND(total_etb / quantity_kg, 2)
        ELSE total_etb
    END
WHERE quantity IS NULL
   OR unit_code IS NULL
   OR price_per_unit IS NULL;

-- -------------------------------------------------------------------------
-- orders.origin_certificates
-- -------------------------------------------------------------------------

ALTER TABLE orders.origin_certificates
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 3);

ALTER TABLE orders.origin_certificates
    ADD COLUMN IF NOT EXISTS unit_code VARCHAR(20);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_origin_certificates_unit_code'
          AND conrelid = 'orders.origin_certificates'::regclass
    ) THEN
        ALTER TABLE orders.origin_certificates
            ADD CONSTRAINT fk_origin_certificates_unit_code
            FOREIGN KEY (unit_code)
            REFERENCES catalog.units (code)
            ON DELETE RESTRICT;
    END IF;
END $$;

UPDATE orders.origin_certificates c
SET
    quantity = COALESCE(c.quantity_kg, o.quantity, o.quantity_kg),
    unit_code = COALESCE(o.unit_code, 'KG')
FROM orders.orders o
WHERE c.order_id = o.id
  AND (c.quantity IS NULL OR c.unit_code IS NULL);

UPDATE orders.origin_certificates
SET
    quantity = quantity_kg,
    unit_code = 'KG'
WHERE (quantity IS NULL OR unit_code IS NULL)
  AND quantity_kg IS NOT NULL;

COMMIT;
