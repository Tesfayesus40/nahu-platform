# 19 — D5: Form Schema Specification

**Status:** Design locked — specification complete; implementation in G4  
**Resolves:** [12 — Design Validation](./12-design-validation.md) § D5  
**Parent:** [Platform Evolution index](./README.md)  
**Depends on:** [18 — Attribute strategy](./18-d4-attribute-extension-strategy.md)  
**Consumed by:** [14 — Marketplace Engine](./14-marketplace-engine-design.md)

---

## 1. Purpose

Buyer and Seller apps (and Admin) eventually render **listing create/edit and filter forms from configuration**, not hard-coded coffee screens.

This document is the **contract**. G2/G3 may proceed without a live renderer; G4 implements it.

---

## 2. Schema identity & versioning

```text
FormSchema
  schemaId        string   -- e.g. "listing.create"
  verticalCode    string   -- AGRICULTURE
  categoryCode    string   -- COFFEE | TEFF | …
  locale          string   -- en | am
  version         semver   -- "1.2.0"
  minAppBuild?    number   -- optional client gate
  engine         "nahu.form.v1"
  publishedAt     iso8601
```

**Versioning rules:**

| Change | Version bump | Client behavior |
|--------|--------------|-----------------|
| Add optional field | MINOR | Render if type known; ignore unknown types safely |
| Add required field | MAJOR | Old apps must be blocked or server soft-requires only on new publishes |
| Remove / rename field key | MAJOR | Keep server accept alias ≥1 release |
| Change field type | MAJOR | New schemaId segment or major |
| Copy / i18n only | PATCH | |

Clients send `X-Form-Schema-Version` or body `formSchemaVersion` on submit; server validates against that version’s rules **or** latest compatible.

---

## 3. JSON schema (`engine: nahu.form.v1`)

### 3.1 Top level

```json
{
  "engine": "nahu.form.v1",
  "schemaId": "listing.create",
  "verticalCode": "AGRICULTURE",
  "categoryCode": "COFFEE",
  "version": "1.0.0",
  "listingKind": "GOODS",
  "i18n": {
    "titleKey": "forms.listing.create.title"
  },
  "sections": [],
  "submit": {
    "buildPayload": "listing.v1"
  }
}
```

### 3.2 Section

```json
{
  "id": "quality",
  "titleKey": "forms.listing.sections.quality",
  "descriptionKey": null,
  "fields": []
}
```

### 3.3 Field

```json
{
  "key": "qualityGrade",
  "binding": {
    "type": "attribute",
    "attributeCode": "quality_grade"
  },
  "control": "select",
  "valueType": "string",
  "required": true,
  "labelKey": "attrs.quality_grade",
  "helpKey": "attrs.quality_grade.help",
  "placeholderKey": null,
  "options": {
    "source": "enum",
    "enumSetCode": "coffee_grade"
  },
  "validators": [
    { "type": "required" },
    { "type": "inEnum", "enumSetCode": "coffee_grade" }
  ],
  "visibleWhen": null,
  "requiredWhen": null,
  "unit": null,
  "search": { "facet": true, "filterControl": "select" }
}
```

### 3.4 Binding types

| `binding.type` | Maps to |
|----------------|---------|
| `core` | Listing core path (`quantity`, `unitCode`, `pricePerUnit`, `offerDate`, `businessProfileId`, …) |
| `attribute` | Attribute definition by `attributeCode` |
| `extension` | Legacy `extensions.<family>.<path>` — coffee dual-write era only |
| `media` | Photo slots |
| `computed` | Read-only display |

### 3.5 Controls (`control`)

`text` | `textarea` | `number` | `select` | `multiSelect` | `boolean` | `date` | `datetime` | `unitQuantity` | `money` | `geo` | `businessProfilePicker` | `photo` | `hidden`

Unknown controls: client skips field and must not submit inventing values; show “Update app” if field `required`.

### 3.6 Conditional visibility

```json
"visibleWhen": {
  "op": "and",
  "clauses": [
    { "field": "listingKind", "equals": "GOODS" }
  ]
}
```

Supported ops: `and`, `or`, `not`, `equals`, `in`, `exists`. Keep minimal for v1.

---

## 4. Validation

**Client:** run `validators` for UX.  
**Server:** source of truth — revalidate from attribute defs + core rules; never trust client-only checks.

Validator types (v1): `required`, `min`, `max`, `regex`, `inEnum`, `unitAllowed`, `decimalPlaces`.

---

## 5. Mobile rendering

1. Fetch `GET /catalog/form-schemas?categoryCode=&schemaId=listing.create`.  
2. Cache by `(categoryCode, version)` with ETag.  
3. Render sections in order; bind state map `key → value`.  
4. On submit, map bindings → API payload (`core` + `attributes[]` + optional `extensions`).  
5. Feature-detect controls; degrade gracefully.

**Buyer search filters** use same engine with `schemaId: listing.search`.

Hard-coded coffee screens remain until G4 cutover per category.

---

## 6. Admin editor

Admin **Form builder** (post-G3):

- Load attribute defs for category  
- Drag fields into sections  
- Set required / facet / visibility  
- Publish new schema version  
- Preview pane  

MVP Admin may edit JSON with validation against `nahu.form.v1` meta-schema before a visual builder ships.

Permission: `catalog.form_schema.publish`.

---

## 7. Backward compatibility

| Case | Handling |
|------|----------|
| Old app + new optional fields | Ignore |
| Old app + new required fields | Server: allow draft; block ACTIVE publish with clear error **or** require minAppBuild |
| New app + old schema cached | Prefer ETag revalidate; allow stale ≤ TTL for offline draft |
| Removed field | Server ignores unknown keys; stops requiring removed codes |
| Extension bindings | Valid only while coffee dual-write active |

Payload builder `listing.v1` remains stable; schema versions evolve independently.

---

## 8. Example (coffee excerpt)

```json
{
  "engine": "nahu.form.v1",
  "schemaId": "listing.create",
  "verticalCode": "AGRICULTURE",
  "categoryCode": "COFFEE",
  "version": "1.0.0",
  "listingKind": "GOODS",
  "sections": [
    {
      "id": "core",
      "titleKey": "forms.listing.sections.core",
      "fields": [
        {
          "key": "quantity",
          "binding": { "type": "core", "path": "quantity" },
          "control": "unitQuantity",
          "valueType": "number",
          "required": true,
          "labelKey": "fields.quantity"
        },
        {
          "key": "offerDate",
          "binding": { "type": "core", "path": "offerDate" },
          "control": "date",
          "valueType": "string",
          "required": false,
          "labelKey": "fields.harvestDate"
        }
      ]
    },
    {
      "id": "coffee",
      "titleKey": "forms.listing.sections.coffee",
      "fields": [
        {
          "key": "processMethod",
          "binding": {
            "type": "attribute",
            "attributeCode": "process_method"
          },
          "control": "select",
          "valueType": "string",
          "required": true,
          "labelKey": "attrs.process_method",
          "options": { "source": "enum", "enumSetCode": "coffee_process_method" }
        }
      ]
    }
  ]
}
```

---

## 9. Delivery to G4

G4 builds the renderer + endpoint. This spec is **complete enough** to begin G2/G3 without blocking; attribute `is_filterable` / form publish can land late G3 as seeds.
