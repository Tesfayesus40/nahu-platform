-- ============================================================================
-- Nahu Platform — UAT / staging DATA-ONLY truncate list
-- File: database/scripts/uat-data-reset.sql
--
-- Truncates transactional / demo business tables only.
-- Identity preserve + delete is owned by apps/api/scripts/uat-data-reset.cjs
-- (supports --keep-user / --keep-role; always keeps SUPER_ADMIN / PLATFORM_ADMIN).
--
-- PRESERVES (not listed here):
--   • Schema, indexes, constraints, triggers, enums, functions
--   • public.schema_migrations
--   • identity.roles, permissions, role_permissions, users (selected)
--   • catalog.* reference data
--   • ops.feature_flags, system_settings, alert_thresholds
--   • farms.season_codes, activity_types
--
-- Prefer:
--   pnpm db:reset -- --confirm=UAT_RESET
--   pnpm db:reset -- --confirm=UAT_RESET --keep-user=+251911200001 --keep-role=ADMIN
-- ============================================================================

TRUNCATE TABLE
  -- delivery
  delivery.tracking_pings,
  delivery.shipment_pods,
  delivery.shipment_events,
  delivery.shipment_assignments,
  delivery.shipment_earnings,
  delivery.shipment_stops,
  delivery.shipments,
  delivery.fulfillment_events,
  delivery.fulfillment_cases,
  delivery.courier_notifications,
  delivery.courier_verification_documents,
  delivery.courier_verification_cases,
  delivery.courier_payout_accounts,
  delivery.courier_vehicles,
  delivery.courier_profiles,
  -- orders / disputes / payments-as-order-fields
  orders.dispute_notes,
  orders.dispute_evidence,
  orders.dispute_events,
  orders.dispute_cases,
  orders.origin_certificates,
  orders.order_admin_notes,
  orders.orders,
  -- inventory
  inventory.reservations,
  inventory.stock_movements,
  inventory.stock_lots,
  -- farms (leave season_codes + activity_types)
  farms.farm_audit_log,
  farms.farm_party_history,
  farms.farm_translations,
  farms.farm_activities,
  farms.harvest_lines,
  farms.harvest_sessions,
  farms.cropping_cycle_lines,
  farms.cropping_cycles,
  farms.production_units,
  farms.fields,
  farms.plots,
  farms.farm_parties,
  farms.farms,
  -- warehouse
  warehouse.storage_zones,
  warehouse.warehouse_parties,
  warehouse.storage_sites,
  -- marketplace
  marketplace.listing_moderation_decisions,
  marketplace.verification_documents,
  marketplace.verification_decisions,
  marketplace.verification_cases,
  marketplace.promotions,
  marketplace.pickup_locations,
  marketplace.buyer_addresses,
  marketplace.listings,
  marketplace.farmer_profiles,
  marketplace.cooperatives,
  -- ops runtime (keep feature_flags / system_settings / alert_thresholds)
  ops.admin_notifications,
  ops.report_jobs,
  -- audit
  audit.events,
  -- identity runtime (not roles/permissions; users handled by runner)
  identity.otp_codes,
  identity.admin_sessions,
  identity.admin_invitations,
  identity.user_organizations,
  identity.organizations
RESTART IDENTITY CASCADE;
