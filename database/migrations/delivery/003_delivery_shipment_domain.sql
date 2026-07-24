-- ============================================================================
-- Nahu Platform
-- Migration : delivery/003_delivery_shipment_domain.sql
-- Module    : Delivery (D2)
-- Description:
--     Shipment aggregate (physical system of record) under A10 fulfillment cases.
--     Tables: courier_profiles, shipments, shipment_stops, shipment_assignments,
--     shipment_events, shipment_pods, shipment_earnings.
--     Supports multi-stop, returns, split/batch shipments without redesign.
--     Schema + constraints only — no APIs / dispatch / consumers (D2).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Courier profile (supporting identity for dispatch; outside shipment aggregate)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.courier_profiles
(
    user_id UUID PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
    display_name VARCHAR(200),
    phone VARCHAR(20),
    vehicle_type VARCHAR(40),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    availability VARCHAR(20) NOT NULL DEFAULT 'OFFLINE'
        CHECK (availability IN ('OFFLINE', 'AVAILABLE', 'BUSY', 'ON_BREAK')),
    service_regions TEXT[] NOT NULL DEFAULT '{}',
    last_lat DOUBLE PRECISION,
    last_lng DOUBLE PRECISION,
    last_accuracy_m DOUBLE PRECISION,
    location_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_courier_profiles_availability
    ON delivery.courier_profiles (availability)
    WHERE deleted_at IS NULL AND active = TRUE;

-- ---------------------------------------------------------------------------
-- Shipment (aggregate root)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.shipments
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fulfillment_id UUID NOT NULL
        REFERENCES delivery.fulfillment_cases(id) ON DELETE RESTRICT,
    -- Future: split legs / batching without redesign
    shipment_type VARCHAR(20) NOT NULL DEFAULT 'OUTBOUND'
        CHECK (shipment_type IN ('OUTBOUND', 'RETURN', 'SPLIT_LEG', 'BATCH_LEG')),
    parent_shipment_id UUID REFERENCES delivery.shipments(id) ON DELETE SET NULL,
    batch_id UUID,
    sequence_no INT NOT NULL DEFAULT 1,
    current_status VARCHAR(30) NOT NULL DEFAULT 'CREATED'
        CHECK (current_status IN (
            'CREATED',
            'AWAITING_ASSIGNMENT',
            'ASSIGNED',
            'ACCEPTED',
            'PICKED_UP',
            'IN_TRANSIT',
            'DELIVERED',
            'BUYER_CONFIRMED',
            'COMPLETED',
            'CANCELLED',
            'RETURNED',
            'FAILED'
        )),
    -- Denormalized active courier (history lives in shipment_assignments)
    courier_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    service_level VARCHAR(20) DEFAULT 'STANDARD',
    vehicle_type VARCHAR(40),
    notes TEXT,
    -- Geospatial / routing readiness (schema only; no engine in D2)
    pickup_lat DOUBLE PRECISION,
    pickup_lng DOUBLE PRECISION,
    dropoff_lat DOUBLE PRECISION,
    dropoff_lng DOUBLE PRECISION,
    estimated_distance_m NUMERIC(12, 2),
    estimated_duration_sec INT,
    delivery_zone VARCHAR(80),
    planned_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    buyer_confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shipments_fulfillment
    ON delivery.shipments (fulfillment_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_status
    ON delivery.shipments (current_status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_courier
    ON delivery.shipments (courier_user_id)
    WHERE deleted_at IS NULL AND courier_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_batch
    ON delivery.shipments (batch_id)
    WHERE batch_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_parent
    ON delivery.shipments (parent_shipment_id)
    WHERE parent_shipment_id IS NOT NULL;

-- At most one "active" outbound shipment per fulfillment (RC1); schema still allows N.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipments_one_active_outbound
    ON delivery.shipments (fulfillment_id)
    WHERE deleted_at IS NULL
      AND shipment_type = 'OUTBOUND'
      AND current_status IN (
          'CREATED',
          'AWAITING_ASSIGNMENT',
          'ASSIGNED',
          'ACCEPTED',
          'PICKED_UP',
          'IN_TRANSIT',
          'DELIVERED',
          'BUYER_CONFIRMED'
      );

-- ---------------------------------------------------------------------------
-- ShipmentStop (1..N per shipment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.shipment_stops
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL
        REFERENCES delivery.shipments(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    stop_type VARCHAR(20) NOT NULL
        CHECK (stop_type IN ('PICKUP', 'DROPOFF', 'RETURN_PICKUP', 'RETURN_DROPOFF')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ARRIVED', 'COMPLETED', 'FAILED', 'SKIPPED')),
    address_text TEXT,
    contact_name VARCHAR(200),
    contact_phone VARCHAR(20),
    instructions TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    accuracy_m DOUBLE PRECISION,
    geofence_radius_m DOUBLE PRECISION,
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_shipment_stops_sequence UNIQUE (shipment_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_shipment_stops_shipment
    ON delivery.shipment_stops (shipment_id, sequence)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_stops_status
    ON delivery.shipment_stops (status)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- ShipmentAssignment (history; reassignment supported)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.shipment_assignments
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL
        REFERENCES delivery.shipments(id) ON DELETE CASCADE,
    courier_user_id UUID NOT NULL
        REFERENCES identity.users(id) ON DELETE RESTRICT,
    assigned_by_user_id UUID
        REFERENCES identity.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    reject_reason TEXT,
    cancel_reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_assignments_shipment
    ON delivery.shipment_assignments (shipment_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_assignments_courier
    ON delivery.shipment_assignments (courier_user_id, assigned_at DESC);

-- At most one active assignment per shipment
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipment_assignments_one_active
    ON delivery.shipment_assignments (shipment_id)
    WHERE is_active = TRUE
      AND cancelled_at IS NULL
      AND rejected_at IS NULL;

-- ---------------------------------------------------------------------------
-- ShipmentEvent (immutable lifecycle / domain events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.shipment_events
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL
        REFERENCES delivery.shipments(id) ON DELETE CASCADE,
    stop_id UUID REFERENCES delivery.shipment_stops(id) ON DELETE SET NULL,
    assignment_id UUID REFERENCES delivery.shipment_assignments(id) ON DELETE SET NULL,
    event_type VARCHAR(80) NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30),
    actor_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    correlation_id UUID,
    message TEXT,
    payload_json JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Intentionally no updated_at / deleted_at: append-only audit trail
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment
    ON delivery.shipment_events (shipment_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_events_type
    ON delivery.shipment_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_events_correlation
    ON delivery.shipment_events (correlation_id)
    WHERE correlation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ShipmentPOD (proof of delivery / pickup attempts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.shipment_pods
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL
        REFERENCES delivery.shipments(id) ON DELETE CASCADE,
    stop_id UUID NOT NULL
        REFERENCES delivery.shipment_stops(id) ON DELETE CASCADE,
    attempt_no INT NOT NULL DEFAULT 1,
    method VARCHAR(40) NOT NULL DEFAULT 'PHOTO'
        CHECK (method IN (
            'PHOTO',
            'SIGNATURE',
            'OTP',
            'PIN',
            'GPS_ONLY',
            'PHOTO_AND_SIGNATURE',
            'PHOTO_AND_OTP'
        )),
    -- Photo / media
    photo_url TEXT,
    media_urls TEXT[] NOT NULL DEFAULT '{}',
    -- Future signature support
    signature_url TEXT,
    signature_payload_json JSONB,
    -- OTP / PIN verification
    otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
    otp_verified_at TIMESTAMPTZ,
    otp_reference VARCHAR(100),
    -- Recipient + geo + time
    recipient_name VARCHAR(200),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    accuracy_m DOUBLE PRECISION,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    captured_by_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    notes TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shipment_pods_stop_attempt UNIQUE (stop_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_shipment_pods_shipment
    ON delivery.shipment_pods (shipment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_pods_stop
    ON delivery.shipment_pods (stop_id);

-- ---------------------------------------------------------------------------
-- ShipmentEarnings (immutable append-only ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.shipment_earnings
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL
        REFERENCES delivery.shipments(id) ON DELETE RESTRICT,
    stop_id UUID REFERENCES delivery.shipment_stops(id) ON DELETE SET NULL,
    courier_user_id UUID NOT NULL
        REFERENCES identity.users(id) ON DELETE RESTRICT,
    earning_type VARCHAR(40) NOT NULL
        CHECK (earning_type IN (
            'DROPOFF_FLAT',
            'PICKUP_FEE',
            'DISTANCE',
            'BONUS',
            'ADJUSTMENT',
            'VOID',
            'OTHER'
        )),
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
    -- Ledger status marker (PAID is ops marker only until Finance exists)
    ledger_status VARCHAR(20) NOT NULL DEFAULT 'ACCRUED'
        CHECK (ledger_status IN ('ACCRUED', 'ADJUSTED', 'PAID', 'VOID')),
    -- Corrections reference prior rows; never UPDATE amount in place
    replaces_earning_id UUID REFERENCES delivery.shipment_earnings(id) ON DELETE SET NULL,
    reference VARCHAR(120),
    policy_code VARCHAR(80),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Intentionally no updated_at: append-only
);

CREATE INDEX IF NOT EXISTS idx_shipment_earnings_courier
    ON delivery.shipment_earnings (courier_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_earnings_shipment
    ON delivery.shipment_earnings (shipment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_earnings_status
    ON delivery.shipment_earnings (ledger_status);

-- ---------------------------------------------------------------------------
-- Optional low-frequency location breadcrumbs (geo readiness)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.tracking_pings
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL
        REFERENCES delivery.shipments(id) ON DELETE CASCADE,
    courier_user_id UUID NOT NULL
        REFERENCES identity.users(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy_m DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_pings_shipment
    ON delivery.tracking_pings (shipment_id, recorded_at DESC);

COMMIT;
