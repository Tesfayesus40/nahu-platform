# A9–A11 Migration Summary

| File | Purpose |
|---|---|
| `orders/011_orders_admin_notes.sql` | Internal admin notes on orders |
| `delivery/001_delivery_schema.sql` | Creates `delivery` schema for future Nahu Delivery |
| `delivery/002_delivery_fulfillment_cases.sql` | Fulfillment cases + events; backfill from non-unpaid orders; carrier/tracking extension columns |
| `marketplace/015_marketplace_promotions.sql` | Promotions registry (admin-only; not checkout-wired) |
| `identity/024_identity_batch3_permissions.sql` | Orders/payments/delivery/promotions/cooperatives permissions + role grants |
