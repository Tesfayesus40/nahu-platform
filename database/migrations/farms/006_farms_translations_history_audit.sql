-- ============================================================================
-- Nahu Platform
-- Migration : 006_farms_translations_history_audit.sql
-- Module    : Farms (Phase 4.1)
-- ============================================================================

BEGIN;

CREATE TABLE farms.farm_translations
(
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    farm_id     UUID NOT NULL,

    locale      VARCHAR(15) NOT NULL,

    name        VARCHAR(150) NOT NULL,

    description TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_farm_translations_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms.farms (id)
        ON DELETE CASCADE,

    CONSTRAINT uq_farm_translations_farm_locale
        UNIQUE (farm_id, locale)
);

CREATE INDEX idx_farm_translations_locale ON farms.farm_translations (locale);

CREATE TABLE farms.farm_party_history
(
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    farm_id           UUID NOT NULL,

    farmer_profile_id UUID,

    cooperative_id    UUID,

    party_role        farms.party_role NOT NULL,

    tenure_type       farms.tenure_type,

    valid_from        DATE,

    valid_to          DATE,

    changed_by_user_id UUID,

    reason            VARCHAR(500),

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_farm_party_history_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms.farms (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_farm_party_history_farm_id ON farms.farm_party_history (farm_id);

CREATE TABLE farms.farm_audit_log
(
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_type    farms.audit_entity_type NOT NULL,

    entity_id      UUID NOT NULL,

    farm_id        UUID NOT NULL,

    action         farms.audit_action NOT NULL,

    actor_user_id  UUID,

    before_json    JSONB,

    after_json     JSONB,

    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_farm_audit_log_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms.farms (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_farm_audit_log_farm_id ON farms.farm_audit_log (farm_id);

CREATE INDEX idx_farm_audit_log_entity ON farms.farm_audit_log (entity_type, entity_id);

COMMIT;
