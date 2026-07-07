-- ============================================================================
-- Nahu Platform
-- Migration : 001_identity_schema.sql
-- Module    : Identity
-- Author    : Tesfayesus Yimenu Yirdaw
-- Description:
--     Creates the Identity schema.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS identity;

COMMENT ON SCHEMA identity IS
'Identity and Access Management (IAM) module for Nahu Platform.';

COMMIT;