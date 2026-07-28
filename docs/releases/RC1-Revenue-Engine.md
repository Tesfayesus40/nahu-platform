# RC1 — Revenue Engine Release Notes

**Document type:** Release / deployment summary  
**Audience:** Future developers and deployment engineers  
**Date:** 2026-07-28  
**Repos:** `nahu-platform` (API, Admin Web, migrations) · `nahu-buna-gebaya` (Buyer / Farmer clients)  
**Status:** Architecture approved · Dynamic delivery fees **gated OFF** · Payment rails are **stubs only**

**Related docs**

| Doc | Role |
|-----|------|
| [`docs/08-guides/revenue-engine-tdd.md`](../08-guides/revenue-engine-tdd.md) | Full technical design |
| [`docs/08-guides/revenue-engine-design-lock.md`](../08-guides/revenue-engine-design-lock.md) | Locked incidence + policy |
| [`docs/08-guides/revenue-engine-roadmap.md`](../08-guides/revenue-engine-roadmap.md) | Deferred follow-ups |
| [`docs/08-guides/migration-manifest.md`](../08-guides/migration-manifest.md) | How to apply migrations |

---

## 1. What was implemented

Accounting-first commercial money: **versioned fee schedules → immutable order snapshots → optional delivery quotes → courier payout snapshots → refund/payment intents**. No live Telebirr/Chapa/CBE money movement.

### Platform (API)

| Area | Deliverable |
|------|-------------|
| Pricing module | `apps/api/src/pricing/` — rules, service, buyer + admin controllers, payment-rails stub |
| Marketplace fees | Buyer % add-on + farmer % deduction from DB schedule (`pricing.v1.enabled`) |
| Order snapshots | New money columns on `orders.orders`; create path uses `PricingService` |
| Delivery quotes | Persist quote + TTL; bind on order create when dynamic fee flag is on |
| Settlement | Accrue courier earning from `orders.courier_payout_etb` when present; else flat config fallback |
| Buyer confirm | Accrual + stub farmer/courier disbursement intents on COMPLETED |
| Disputes | Multi-stream refund allocation + stub `BUYER_REFUND` intent |
| Admin APIs | `GET/PATCH/PUT /admin/pricing/*` |

### Admin Web

- New **Pricing** page (`/pricing`): platform fees, delivery commission, vehicle tariffs  
- Order detail shows fee breakdown + payment intents  
- Dispute detail supports stream refund fields  

### Mobile

- Buyer: `GET /pricing/active`, checkout displays server rates; quote path present but inactive while dynamic fee is off  
- Farmer: earnings copy no longer claims a hardcoded “2%”  
- Payment amount uses `buyer_charge_etb` (goods + buyer fee + delivery when enabled)  

### Locked incidence model

```text
Buyer pays     = goods_subtotal + buyer_platform_fee + delivery_fee
Farmer receives = goods_subtotal − farmer_platform_fee
Courier receives = delivery_fee − delivery_commission   (when dynamic fees on)
Platform revenue = buyer_fee + farmer_fee + delivery_commission
```

Legacy dual-write for older clients:

- `total_etb` = goods subtotal  
- `commission_etb` = farmer platform fee  

---

## 2. What was intentionally deferred

Do **not** enable these in production until the linked roadmap work lands.

| Deferred item | Why | Roadmap |
|---------------|-----|---------|
| Dynamic delivery fees in production | Checkout still lacks real routing distance and vehicle selection | Roadmap #1, #2 |
| Real routing / distance at quote time | Would misprice with placeholder km | #1 |
| Buyer vehicle selection UI | Would hardcode MOTORBIKE | #2 |
| Finance / revenue ledger module | Snapshots only; no first-class revenue ledger | #3 |
| Automated refund policy engine | Manual admin allocation only | #4 |
| Live payment providers | Intents stay `RECORDED_PENDING_PROVIDER` | #5 |
| Promotions / VAT / multi-country | Future extensions on same snapshot model | TDD §11 |

---

## 3. Feature flags and default states

| Flag code | Default | Meaning |
|-----------|---------|---------|
| `pricing.v1.enabled` | **TRUE** | Orders use DB fee schedules for buyer + farmer fees instead of legacy hardcoded commission-only path |
| `delivery.dynamic_fee.enabled` | **FALSE** | When TRUE, `NAHU_COURIER` requires `deliveryQuoteId` and charges delivery fee. **Keep FALSE** until routing + vehicle selection |

**API fail-safe:** if `delivery.dynamic_fee.enabled` row is missing, PricingService treats dynamic delivery as **OFF**.

**Admin:** toggle via System feature flags (`admin.system.config.*`). Pricing rate values are edited only on the Pricing page (`pricing.*` tables), not via env vars.

**With dynamic fee OFF (current production gate):**

- Buyer still pays `goods + buyer_fee` when `pricing.v1` is on  
- `delivery_fee_etb` / `delivery_commission_etb` / `courier_payout_etb` snapshot as **0** for new orders  
- Courier accrual falls back to existing flat earning config when payout snapshot is 0/null  

---

## 4. Database migrations introduced

Apply via `database/migrations/manifest.json` (never filesystem sort alone). See migration-manifest guide.

| File | Schema / action |
|------|-----------------|
| `pricing/001_pricing_schema.sql` | Create `pricing` schema |
| `pricing/002_pricing_fee_schedules.sql` | `fee_schedules`, `platform_fees`, `delivery_tariffs`, `delivery_commissions` + seed schedule (2%/2%, 15% delivery commission, vehicle tariffs) |
| `ops/010_ops_pricing_feature_flags.sql` | Insert feature flags (`pricing.v1` TRUE, `delivery.dynamic_fee` FALSE) |
| `orders/012_orders_revenue_fee_snapshots.sql` | Add order fee snapshot columns; backfill from legacy `total_etb` / `commission_etb` |
| `pricing/003_pricing_delivery_quotes.sql` | `pricing.delivery_quotes` |
| `orders/013_orders_dispute_refund_allocation.sql` | Dispute stream refund columns |
| `pricing/004_pricing_payment_rail_stubs.sql` | `pricing.payment_intents` |
| `ops/011_ops_disable_dynamic_delivery_fee.sql` | Force `delivery.dynamic_fee.enabled = FALSE` on DBs that may have older TRUE seed |

### New / extended tables (summary)

**New:** `pricing.fee_schedules`, `platform_fees`, `delivery_tariffs`, `delivery_commissions`, `delivery_quotes`, `payment_intents`  

**Extended `orders.orders`:** `goods_subtotal_etb`, `buyer_fee_etb`, `farmer_fee_etb`, `delivery_fee_etb`, `delivery_commission_etb`, `courier_payout_etb`, `buyer_charge_etb`, `fee_schedule_id`, `delivery_quote_id`  

**Extended `orders.dispute_cases`:** `refund_goods_etb`, `refund_buyer_fee_etb`, `refund_delivery_etb`, `refund_policy_code`  

---

## 5. Backward compatibility considerations

| Concern | Behaviour |
|---------|-----------|
| Historical orders | Backfill sets `goods_subtotal_etb` / `farmer_fee_etb` / `buyer_charge_etb` from legacy columns; **buyer fee was not charged historically** — `buyer_charge` ≈ old `total` |
| Mobile clients reading `total_etb` | Still goods subtotal; prefer `buyerChargeEtb` for “amount due” |
| Mobile reading `commission_etb` | Still farmer fee (dual-written) |
| Old Admin UI without Pricing page | Safe; rates remain at seed until Admin Pricing is deployed |
| API before migrations | Will fail on missing tables/columns — **migrate before deploy** |
| API after migrate, old mobile | Orders still create; buyer may under-display fee until app update |
| Dynamic fee suddenly enabled | Breaks Buyer checkout unless app sends quotes — **do not enable** until roadmap #1–#2 |
| Courier earnings | Orders with `courier_payout_etb = 0` use flat earning fallback; no forced zero payout policy change for RC1 ops |

**Prisma:** run `npx prisma generate` (API package) after schema pull so clients include pricing models.

---

## 6. Deployment and migration order

### Recommended sequence (staging / production)

```text
1. Merge / release artifacts that include:
   - Migrations listed in §4
   - API with PricingModule
   - Admin Web Pricing page (optional same wave; rates editable once live)
   - Buyer/Farmer apps that call GET /pricing/active (recommended same wave)

2. Apply migrations (DATABASE_URL public host from laptop, or in-network job):
   node scripts/apply-migrations.mjs
   # or ./scripts/apply-migrations.sh
   # Confirm ops/011 applied so dynamic fee is FALSE

3. Verify flags:
   SELECT code, enabled FROM ops.feature_flags
   WHERE code IN ('pricing.v1.enabled', 'delivery.dynamic_fee.enabled');
   -- expect: pricing.v1 = true, delivery.dynamic_fee = false

4. Deploy API (nahu-api), then Admin Web, then mobile builds as scheduled

5. Smoke:
   - Admin → Pricing: read schedule / edit fees (reauth UX)
   - Buyer checkout: subtotal + buyer fee; total due = buyer charge; no delivery line required
   - Create order; confirm payment.amount == buyer_charge_etb
   - Confirm NAHU_COURIER order succeeds WITHOUT deliveryQuoteId
```

### Dependency notes

- `pricing/002` before order/quote migrations that reference schedules  
- `orders/012` before quotes that FK to `orders.orders` and before relying on snapshot columns in API  
- `ops/011` last among this batch so any prior TRUE seed is corrected  

Do **not** edit already-applied SQL files; checksums are stored in `public.schema_migrations`.

---

## 7. Rollback procedure

Migrations in this batch are **additive** (new schema/tables/columns/flags). Prefer **application rollback** over dropping schema in production.

### Soft rollback (preferred)

1. Redeploy previous API + Admin (+ mobile if needed).  
2. Optionally set `pricing.v1.enabled = FALSE` so new orders use legacy fee path (buyer 0% / farmer 2% in current flag-off code).  
3. Keep `delivery.dynamic_fee.enabled = FALSE`.  
4. Leave new columns/tables in place (nullable/defaulted; older code ignores them).  

### Flag-only rollback of marketplace fees

```sql
UPDATE ops.feature_flags
SET enabled = FALSE, updated_at = NOW()
WHERE code = 'pricing.v1.enabled';
```

New orders stop using DB schedule rates; historical snapshots remain valid for audit.

### Hard rollback (dev / empty UAT only — not recommended on shared staging with live data)

Only if the environment can be rebuilt:

1. Stop API writers.  
2. Drop in reverse dependency order if required for a full reset, e.g. `pricing.payment_intents`, quote FKs, then fee tables, then order/dispute columns — **or** restore DB snapshot from before apply.  
3. Delete corresponding rows from `public.schema_migrations` only as part of a controlled rebuild.  
4. Redeploy prior artifacts.

**Never** drop `pricing` or strip order columns on production without a full restore plan and downtime window.

### Payment intents

Rows in `pricing.payment_intents` are accounting stubs. Rolling back the API does not reverse cash (none moved). Leaving the table empty/orphan is harmless.

---

## 8. Post-deploy checklist

| Check | Expected |
|-------|----------|
| Migrations through `ops/011` in `schema_migrations` | Present |
| `delivery.dynamic_fee.enabled` | `false` |
| `pricing.v1.enabled` | `true` (unless deliberately off) |
| Active fee schedule exists | Seed `default` v1 or Admin-edited |
| Admin `/pricing` loads | Schedules + tariffs visible |
| Buyer checkout amount | Goods + buyer fee (no forced delivery quote) |
| Payment rails | Intents recorded; no provider HTTP |

---

## 9. Owner notes

- **Rate changes:** Admin Portal Pricing only — never ship hardcoded % in app releases as source of truth.  
- **Enabling dynamic delivery:** requires roadmap routing + vehicle selection, explicit flag flip, and coordinated Buyer app release.  
- **Live money:** requires payment provider work; stubs must not be mistaken for settled cash.
