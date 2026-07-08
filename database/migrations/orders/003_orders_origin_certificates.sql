-- ============================================================================
-- Nahu Platform
-- Migration : 003_orders_origin_certificates.sql
-- Module    : Orders
-- Author    : Package 004 (Orders & Certificates)
-- Description:
--     Creates orders.origin_certificates. Ported from nahu-buna-gebaya's
--     Knex migration 006_create_origin_certificates, with one fix and one
--     deliberate addition:
--
--     Fix: the original app had two different code paths generating
--     certificates with two different column sets --
--     orders.service.js's generateCertificate() tried to insert `region`
--     and `quantity_kg`, which didn't exist on the original table at all
--     (that insert would have failed at runtime, silently swallowed by a
--     try/catch), while certificates.service.js's getCertificate() only
--     ever inserted the columns the table actually had.
--
--     Addition: `region` and `quantity_kg` are genuinely useful on a
--     coffee origin certificate, so rather than drop them (matching the
--     narrower of the two original code paths), this migration adds them
--     for real, and Package 004's single, consolidated certificate
--     generation path populates them correctly.
-- ============================================================================

BEGIN;

CREATE TABLE orders.origin_certificates
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL UNIQUE,

    cert_number VARCHAR(30) NOT NULL UNIQUE,

    farmer_name VARCHAR(100) NOT NULL,

    farm_location VARCHAR(200) NOT NULL,

    cooperative VARCHAR(200),

    region VARCHAR(100),

    grade VARCHAR(20) NOT NULL,

    process_method VARCHAR(20) NOT NULL,

    harvest_date DATE NOT NULL,

    altitude_m NUMERIC(6,1),

    quantity_kg NUMERIC(8,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_origin_certificates_order
        FOREIGN KEY (order_id)
        REFERENCES orders.orders(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE orders.origin_certificates IS
'Origin certificates issued when an order is marked completed. One per order.';

COMMIT;
