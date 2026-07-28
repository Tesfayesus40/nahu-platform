# 32 — G6 Dynamic Buyer Marketplace

**Status:** Implemented (Buyer app)  
**Depends on:** G4 search/presentation APIs · G5 shared `listingSchema` helpers

---

## What shipped

| Area | Change |
|------|--------|
| Browse | Category/product from Catalog APIs; filters from `GET /catalog/search-metadata` |
| Cards | `isListedInCard` / display names / display values / order via `cardAttributeSummary` |
| Details | `ListingAttributesPanel` sections — no `CoffeeExtensionPanel` / grade hard-codes |
| Search | Result cards use presentation attributes |
| Shared | `SchemaSearchFilters`, `ListingAttributesPanel`; `buildBrowseQueryFromSearchFilters` maps enum filters to RC1 query params |
| Sort | Newest / price / attribute sortable fields from metadata |

Purchase / checkout / certificates unchanged. Coffee remains default active category when present.

---

## Tests

```bash
npm run test:listing-schema
```

---

## Compat

- Server query still uses `grade` / `grades` / `processMethod` / `region(s)` when attribute codes map.
- Range filters (e.g. moisture) applied client-side until listing search supports them.
- Legacy listing fields still hydrate card titles when `attributes[]` is empty.
