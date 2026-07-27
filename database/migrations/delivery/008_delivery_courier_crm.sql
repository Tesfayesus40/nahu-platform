-- delivery/008_delivery_courier_crm.sql
-- Courier profile CRM: KYC, vehicles, payout accounts, in-app notifications.

-- ---------------------------------------------------------------------------
-- Extend courier_profiles
-- ---------------------------------------------------------------------------
ALTER TABLE delivery.courier_profiles
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(25),
  ADD COLUMN IF NOT EXISTS preferred_language CHAR(2) NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{
    "shipmentAssigned": true,
    "shipmentAccepted": true,
    "pickupReminder": true,
    "pickupConfirmed": true,
    "deliveryStarted": true,
    "deliveryCompleted": true,
    "paymentReleased": true,
    "verification": true,
    "accountMessages": true,
    "systemAnnouncements": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS active_vehicle_id UUID;

ALTER TABLE delivery.courier_profiles
  DROP CONSTRAINT IF EXISTS courier_profiles_verification_status_check;

ALTER TABLE delivery.courier_profiles
  ADD CONSTRAINT courier_profiles_verification_status_check
  CHECK (verification_status IN ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'));

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.courier_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(20) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  year INT,
  colour VARCHAR(60),
  plate_number VARCHAR(40) NOT NULL,
  registration_number VARCHAR(80),
  insurance_expiry DATE,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT courier_vehicles_type_check CHECK (
    vehicle_type IN ('MOTORCYCLE', 'BICYCLE', 'CAR', 'VAN', 'PICKUP', 'TRUCK')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS courier_vehicles_plate_active_uq
  ON delivery.courier_vehicles (upper(plate_number))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS courier_vehicles_courier_idx
  ON delivery.courier_vehicles (courier_user_id)
  WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_profiles_active_vehicle_fk'
  ) THEN
    ALTER TABLE delivery.courier_profiles
      ADD CONSTRAINT courier_profiles_active_vehicle_fk
      FOREIGN KEY (active_vehicle_id)
      REFERENCES delivery.courier_vehicles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Payout accounts (storage only — no live rails)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.courier_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  method_type VARCHAR(30) NOT NULL,
  bank_name VARCHAR(120),
  account_name VARCHAR(200) NOT NULL,
  account_number VARCHAR(80),
  phone_number VARCHAR(25),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT courier_payout_method_check CHECK (
    method_type IN ('BANK_ACCOUNT', 'TELEBIRR', 'CBE_BIRR', 'CHAPA', 'COMMERCIAL_BANK')
  )
);

CREATE INDEX IF NOT EXISTS courier_payout_courier_idx
  ON delivery.courier_payout_accounts (courier_user_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS courier_payout_one_default_uq
  ON delivery.courier_payout_accounts (courier_user_id)
  WHERE is_default = true AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Identity verification (KYC)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.courier_verification_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL,
  document_number VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES identity.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT courier_verification_doc_type_check CHECK (
    document_type IN ('NATIONAL_ID', 'DRIVING_LICENCE', 'PASSPORT')
  ),
  CONSTRAINT courier_verification_status_check CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS courier_verification_one_pending_uq
  ON delivery.courier_verification_cases (courier_user_id)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS courier_verification_status_idx
  ON delivery.courier_verification_cases (status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS delivery.courier_verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES delivery.courier_verification_cases(id) ON DELETE CASCADE,
  side VARCHAR(20) NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT courier_verification_side_check CHECK (
    side IN ('FRONT', 'BACK', 'SELFIE')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS courier_verification_case_side_uq
  ON delivery.courier_verification_documents (case_id, side);

-- ---------------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery.courier_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title_en VARCHAR(200) NOT NULL,
  title_am VARCHAR(200) NOT NULL,
  body_en TEXT NOT NULL,
  body_am TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS courier_notifications_inbox_idx
  ON delivery.courier_notifications (courier_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS courier_notifications_unread_idx
  ON delivery.courier_notifications (courier_user_id)
  WHERE deleted_at IS NULL AND read_at IS NULL;
