-- ============================================================================
-- Nahu Platform
-- Migration : pricing/002_pricing_fee_schedules.sql
-- Module    : Pricing
-- Description:
--     Fee schedules, platform fees, delivery tariffs, delivery commissions.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pricing.fee_schedules
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fee_schedules_code_version UNIQUE (code, version)
);

CREATE INDEX IF NOT EXISTS idx_fee_schedules_active
    ON pricing.fee_schedules (is_active)
    WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS pricing.platform_fees
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_schedule_id UUID NOT NULL REFERENCES pricing.fee_schedules(id) ON DELETE CASCADE,
    buyer_fee_pct NUMERIC(8, 4) NOT NULL DEFAULT 0
        CHECK (buyer_fee_pct >= 0 AND buyer_fee_pct <= 100),
    farmer_fee_pct NUMERIC(8, 4) NOT NULL DEFAULT 0
        CHECK (farmer_fee_pct >= 0 AND farmer_fee_pct <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_platform_fees_schedule UNIQUE (fee_schedule_id)
);

CREATE TABLE IF NOT EXISTS pricing.delivery_tariffs
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_schedule_id UUID NOT NULL REFERENCES pricing.fee_schedules(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(40) NOT NULL,
    base_fare_etb NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_fare_etb >= 0),
    per_km_etb NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (per_km_etb >= 0),
    per_kg_etb NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (per_kg_etb >= 0),
    per_m3_etb NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (per_m3_etb >= 0),
    min_fare_etb NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_fare_etb >= 0),
    max_fare_etb NUMERIC(12, 2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_delivery_tariffs_schedule_vehicle UNIQUE (fee_schedule_id, vehicle_type),
    CONSTRAINT chk_delivery_tariffs_max_fare
        CHECK (max_fare_etb IS NULL OR max_fare_etb >= min_fare_etb)
);

CREATE INDEX IF NOT EXISTS idx_delivery_tariffs_schedule
    ON pricing.delivery_tariffs (fee_schedule_id);

CREATE TABLE IF NOT EXISTS pricing.delivery_commissions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_schedule_id UUID NOT NULL REFERENCES pricing.fee_schedules(id) ON DELETE CASCADE,
    commission_type VARCHAR(20) NOT NULL DEFAULT 'PERCENT'
        CHECK (commission_type IN ('PERCENT', 'FIXED')),
    commission_value NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_delivery_commissions_schedule UNIQUE (fee_schedule_id)
);

-- Default active schedule (2% / 2%) — editable via Admin; not hardcoded in app clients.
INSERT INTO pricing.fee_schedules (id, code, display_name, version, is_active, effective_from)
VALUES (
    'a0000000-0000-4000-8000-000000000001',
    'default',
    'Default Nahu fee schedule',
    1,
    TRUE,
    NOW()
)
ON CONFLICT (code, version) DO NOTHING;

INSERT INTO pricing.platform_fees (fee_schedule_id, buyer_fee_pct, farmer_fee_pct)
VALUES ('a0000000-0000-4000-8000-000000000001', 2.0000, 2.0000)
ON CONFLICT (fee_schedule_id) DO NOTHING;

INSERT INTO pricing.delivery_commissions (fee_schedule_id, commission_type, commission_value)
VALUES ('a0000000-0000-4000-8000-000000000001', 'PERCENT', 15.0000)
ON CONFLICT (fee_schedule_id) DO NOTHING;

INSERT INTO pricing.delivery_tariffs
    (fee_schedule_id, vehicle_type, base_fare_etb, per_km_etb, per_kg_etb, per_m3_etb, min_fare_etb, max_fare_etb)
VALUES
    ('a0000000-0000-4000-8000-000000000001', 'BICYCLE',    40.00,  5.00, 0.50, 0, 40.00,  500.00),
    ('a0000000-0000-4000-8000-000000000001', 'MOTORBIKE',  60.00,  8.00, 1.00, 0, 60.00, 1500.00),
    ('a0000000-0000-4000-8000-000000000001', 'CAR',       100.00, 12.00, 1.50, 0, 100.00, 3000.00),
    ('a0000000-0000-4000-8000-000000000001', 'PICKUP',    150.00, 15.00, 2.00, 5.00, 150.00, 5000.00),
    ('a0000000-0000-4000-8000-000000000001', 'VAN',       200.00, 18.00, 2.50, 8.00, 200.00, 8000.00),
    ('a0000000-0000-4000-8000-000000000001', 'TRUCK',     300.00, 25.00, 3.00, 12.00, 300.00, 15000.00),
    ('a0000000-0000-4000-8000-000000000001', 'OTHER',      80.00, 10.00, 1.50, 0, 80.00, 4000.00)
ON CONFLICT (fee_schedule_id, vehicle_type) DO NOTHING;

COMMIT;
