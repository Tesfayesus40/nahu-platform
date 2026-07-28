# 33 — G7 Seller Party Foundation

**Status:** Implemented (backend foundation)  
**Depends on:** [16 — D2 Seller Party](./16-d2-seller-party.md)

---

## What shipped

| Area | Change |
|------|--------|
| Migration | `marketplace/021_marketplace_seller_parties.sql` — types, parties, farmer/listing/order links + backfill |
| Permissions | `identity/028` — `seller.read` / `seller.write` |
| Dual-write | Listing + order create set `seller_party_id`; `farmer_id` retained |
| Farmer map | Profile create / lazy ensure creates `seller_type=FARMER` party |
| APIs | `GET /sellers/types`, `GET/PATCH /sellers/me`, `GET /sellers/:id` |
| Listing shape | Additive `sellerPartyId`, `sellerType` (keeps `farmerId`) |

No Buyer/Farmer UI redesign. Coffee workflows continue via farmer profile + FARMER role.

---

## Seller types (seed)

`FARMER`, `INDIVIDUAL`, `COOPERATIVE`, `BUSINESS`, `COMPANY`, `ORGANISATION`

---

## Tests

```bash
cd apps/api
node --test src/marketplace/seller-party.rules.test.mjs
npx tsc --noEmit
```

---

## Compat

- Existing `/farmers/*` and listing routes unchanged.
- Readers may ignore `sellerPartyId`.
- Backfill maps every farmer → one SellerParty; listings/orders filled where possible.
