-- Reset test marketplace data on staging (or local dev).
-- Keeps seeded IAM: roles, permissions, cooperatives structure.
-- Does NOT drop schemas or re-run migrations.
--
-- Run (staging):
--   railway environment staging
--   railway run --service Postgres-9wYI psql "$DATABASE_PUBLIC_URL" -f database/scripts/reset-test-data.sql
--
-- Or paste into Railway → Postgres → Query tab.

BEGIN;

-- Orders (origin_certificates cascade when orders are deleted)
DELETE FROM orders.orders;

-- Listings and farmer profiles (listings also cascade if farmers are removed)
DELETE FROM marketplace.listings;
DELETE FROM marketplace.farmer_profiles;

-- Test users and auth artifacts
DELETE FROM identity.user_roles;
DELETE FROM identity.credentials;
DELETE FROM identity.user_organizations;
DELETE FROM identity.otp_codes;
DELETE FROM identity.users;

COMMIT;

-- Verify empty:
-- SELECT (SELECT count(*) FROM identity.users) AS users,
--        (SELECT count(*) FROM marketplace.listings) AS listings,
--        (SELECT count(*) FROM orders.orders) AS orders;
