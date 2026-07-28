# 30 — G4 Schema-Driven Listing Foundation

**Status:** Implemented (backend/API only)  
**Depends on:** G3 Attribute Foundation ([27](./27-g3-attribute-foundation.md)–[29](./29-g3-api-contract.md))  
**Form contract:** [19 — D5](./19-d5-form-schema-specification.md)

---

## What shipped

| Area | Change |
|------|--------|
| Migration | `catalog/021_catalog_attribute_presentation_g4.sql` — help, placeholder, section, control, visibility, editable, sortable, search filter type |
| Validation | Metadata-driven `min` / `max` / `minLength` / `maxLength` / `regex` / enum (`attribute.rules.ts`) |
| Listing schema API | `GET /api/v1/catalog/listing-schemas?categoryCode=&schemaId=` |
| Form schema alias | `GET /api/v1/catalog/form-schemas?categoryCode=&schemaId=` (`nahu.form.v1`) |
| Search metadata | `GET /api/v1/catalog/search-metadata?categoryCode=` |
| Listing details | `attributes[]` now includes `displayValue`, section, enum names, card flag |
| Definitions | Attribute definition payloads include presentation + search fields |

Coffee dual-write and legacy listing columns are unchanged. No mobile form renderer.

---

## Schema response (summary)

Includes: `engine`, `schemaId`, `category`, `attributes`, `validation`, `units`, `enumerations`, `displayOrder`, `sections` (core + attribute sections), `search`.

---

## Tests

```bash
cd apps/api
npm run test:attribute-rules
npm run test:listing-schema-rules
npx tsc --noEmit
```

---

## Compatibility

- Additive APIs and fields only.
- Existing `GET .../attributes` and listing shapes remain valid; presentation fields are extras.
- Future categories define forms via attribute rows — no new listing columns required.
