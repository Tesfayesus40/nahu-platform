# 29 — G3 API Contract

**Status:** Additive contract  
**Companion:** [27](./27-g3-attribute-foundation.md)

---

## 1. Listing responses (additive)

Every listing shape now includes:

```json
{
  "id": "...",
  "grade": "GRADE_1",
  "qualityGrade": "GRADE_1",
  "processMethod": "WASHED",
  "variety": "Heirloom",
  "extensions": { "coffee": { "...": "..." } },
  "attributes": [
    {
      "code": "quality_grade",
      "nameEn": "Quality Grade",
      "nameAm": "ደረጃ",
      "dataType": "ENUM",
      "value": "GRADE_1",
      "enumCode": "GRADE_1",
      "unitCode": null
    }
  ]
}
```

Legacy fields remain. Clients that ignore `attributes` keep working.

---

## 2. Create / update listing (additive body)

```json
{
  "grade": "GRADE_1",
  "processMethod": "WASHED",
  "region": "Sidama",
  "attributes": [
    { "code": "moisture_pct", "value": 11.5 },
    { "code": "screen_size", "value": "14/15" }
  ]
}
```

Coffee still requires `grade`/`qualityGrade` + `processMethod` via existing validation when `categoryCode=COFFEE`.

---

## 3. Catalog attribute APIs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/categories/:code/attributes` | Definitions for category |
| GET | `/api/v1/catalog/attribute-definitions?categoryCode=` | Same via catalog namespace |
| GET | `/api/v1/catalog/units` | All units of measure |
| GET | `/api/v1/admin/catalog/attribute-definitions?categoryCode=` | Admin read (`catalog.read`) |

### Definition payload

```json
{
  "code": "quality_grade",
  "nameEn": "Quality Grade",
  "dataType": "ENUM",
  "isRequired": true,
  "isFilterable": true,
  "validation": {},
  "legacyColumn": "grade",
  "enumSetCode": "COFFEE_GRADE",
  "enumValues": [{ "code": "GRADE_1", "nameEn": "Grade 1" }]
}
```

---

## 4. Compatibility rules

- No field removals.  
- No renames of existing listing fields.  
- `attributes` always an array (empty if none).  
- Enum codes match Postgres coffee enums for dual-write stability.

---

## 5. Mobile impact

**None required.** Farmer/Buyer apps may keep using grade/process fields. Optional later: display `attributes` for moisture/screen without redesign.
