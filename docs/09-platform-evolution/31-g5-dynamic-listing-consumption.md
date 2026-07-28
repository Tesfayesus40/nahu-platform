# 31 — G5 Dynamic Listing Consumption

**Status:** Implemented (Farmer app)  
**Depends on:** G4 Schema APIs ([30](./30-g4-schema-driven-listing-foundation.md))

---

## What shipped

| Area | Change |
|------|--------|
| Shared helpers | `shared/marketplace/listingSchema.js` — validate, hydrate, dual-write payload, presentation groups, client filters |
| Create | Farmer `NewListingScreen` renders `GET /catalog/listing-schemas` via `SchemaListingForm` |
| Edit | `EditListingScreen` same schema; prefill from `attributes[]` + legacy columns |
| Details | `ListingDetailScreen` + Home cards use presentation metadata |
| Search filters | Home consumes `GET /catalog/search-metadata` (client filter of my listings) |
| API client | `getListingSchema`, `getSearchMetadata` |

Coffee dual-write: submit still sends legacy `grade` / `processMethod` / `region` / … **and** `attributes[]`.

No backend redesign. No Buyer dynamic UI. No new category activation.

---

## Tests

```bash
node --test shared/marketplace/listingSchema.test.mjs
```

---

## Compat

- Existing coffee listings hydrate from columns when `attributes` empty.
- Product / stock / pickup / photos remain app chrome (not category form fields).
