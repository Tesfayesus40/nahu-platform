# A11 — Promotions & Marketplace Administration

**Status:** Implemented — Batch 3 (dev)  
**Date:** 2026-07-22  

---

## Decision

1. **Promotions registry** (`marketplace.promotions`) — admin CRUD for codes/scopes/status. **Not applied at checkout** until a future Commerce decision wires discount evaluation.  
2. **Cooperatives directory** — list/detail + limited directory field updates (notes, license, union). Verification decisions remain A3.

## Permissions

`marketplace.promotions.read/manage` · `marketplace.cooperatives.read/manage`

## API

- `/admin/promotions` CRUD-ish (POST create, PATCH update)  
- `/admin/cooperatives` list/detail/PATCH

SQL: `marketplace/015_marketplace_promotions.sql`
