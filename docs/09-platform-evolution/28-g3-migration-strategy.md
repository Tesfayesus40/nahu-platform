# 28 — G3 Migration Strategy

**Status:** Active  
**Companion:** [27](./27-g3-attribute-foundation.md)

---

## 1. Principles

1. **Additive first** — new tables only; no drop of coffee columns.  
2. **Dual-write** — coffee create/update writes listing columns **and** `listing_attribute_values`.  
3. **Dual-read** — responses include legacy fields **and** `attributes[]`.  
4. **Backfill** — existing coffee rows populated from columns (migration 020).  
5. **Softening** — `grade` / `process_method` nullable for future non-coffee listings; coffee path still always sets them.

---

## 2. Phases

```text
G3.0 (this wave)
  DDL + coffee seed + backfill + dual-write + attributes[] API

G3.1 (optional follow-up)
  Admin CRUD for attribute definitions (beyond read)

G4
  Form schemas consume definitions (no hard-coded coffee screens)

G5
  Stop requiring coffee columns; deprecate writers; optional column drop
```

---

## 3. Dual-write map

| Listing column | Attribute code |
|----------------|----------------|
| `grade` | `quality_grade` |
| `process_method` | `process_method` |
| `variety` | `variety` |
| `region` | `origin_region` |
| `washing_station` | `washing_station` |
| `altitude_m` | `altitude_m` |
| `cup_score` | `cup_score` |

Client may also send `attributes: [{ code, value }]` (e.g. `moisture_pct`) without new columns.

---

## 4. Rollback

1. Stop deploying Nest build that dual-writes (columns remain source of truth).  
2. Tables `listing_attribute_values` / definitions can remain unused (no FK from core coffee path).  
3. Do **not** re-add NOT NULL on grade/process without verifying no NULL rows exist.

---

## 5. Non-coffee categories

Attribute definitions may exist while `sell_enabled=false`.  
**Do not** activate Honey/Cement sell-through until listing create no longer requires coffee enums for non-COFFEE categories (already gated by categoryCode checks) and product/category flags are intentionally flipped.
