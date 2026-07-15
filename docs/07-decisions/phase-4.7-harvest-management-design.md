# Phase 4.7 — Harvest Management Architecture

**Status:** **Closed** — Nest harvest on staging + Farmer M12 on-device; production held  
**Date:** 2026-07-15 (approved); closed 2026-07-16  
**Version:** 1.1  
**Parent:** [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md) (Approved)  
**Depends on:** Phase 4.1 Farms · 4.2 Inventory · 4.3 Warehouse · 4.4 Listing ↔ Stock · 4.5 Production Planning · 4.6 Dashboards (**Closed** on staging)  
**Next:** Production Nest / mobile cutover remains **explicit**; Amharic UI cleanup is a **separate follow-up**

**Implementation gate:** **Closed on staging** — SQL → Prisma → API → Tests → Docs → Staging smoke → Farmer M12 APK on-device. Production promotion remains explicit.

**Production:** Remains unchanged until an explicit production promotion.

**Program note:** Amharic UI cleanup remains a **separate follow-up** (awaiting corrected translation table).

**v1.1 review refinements (locked):** Harvest Session → Harvest Lines as primary model; harvest independent of inventory until post; post exclusively via Inventory `RECEIVE`; multiple sessions per production plan; manual plan lifecycle; no delete/cancel after post (inventory adjust for corrections); optional crew count only (no labour module); quality qty/date-time/grade/moisture/notes/photos; extensibility for future QC, equipment, payroll, analytics/AI.

---

## 0. Purpose and review goals

Define **field harvest management** for Nahu Farm: how farmers record **what was harvested**, **when**, and **under what quality/ops context**, then **post** that truth into inventory as stock — without redesigning Inventory (4.2), Production Planning (4.5), or Dashboards (4.6).

This review package is intended so product/engineering can verify:

1. **Harvest model:** Session → Lines; multi-session per plan; DRAFT independent of inventory until post  
2. **Inventory integration:** Post → `RECEIVE` only; inventory remains stock system of record  
3. **Quality:** qty, date/time, optional grade, moisture, notes/photos  
4. **Operations:** manual lifecycle; no post-delete; optional crew count only  
5. **Future extensibility:** QC classes, equipment, labour/payroll, analytics/AI without redesign  
6. Multi-commodity readiness (coffee-first)  
7. Mobile UX (M12) additive path  
8. Explicit out-of-scope (payroll module, Buyer, production cutover)

---

## 1. Business objectives and scope

### 1.1 Objectives

1. Give farmers a clear **Harvest Session** flow that matches field practice (one session = one harvest event window with one or more product lines).  
2. Allow **many sessions** against the **same production plan** (cropping cycle) across days or picks.  
3. Keep harvest records **independent of inventory** until an explicit **Post**, then land stock only through Inventory `RECEIVE`.  
4. Keep **inventory** as the sole system of record for on-hand stock.  
5. Keep **plan-vs-actual** ownership in 4.5 (sum of RECEIVE / performance).  
6. Capture MVP quality/context: quantity, date/time, optional grade, moisture, notes, photos; optional crew count.  
7. Prefer **manual** plan/lifecycle management over automatic status changes from harvest post.  
8. Stay coffee-first, multi-commodity via `catalog.products`; Farmer additive; **Buyer unchanged**.  
9. Leave clean hooks for future quality classifications, equipment, labour/payroll, analytics, and AI.

### 1.2 In scope (build after approval + explicit authorize)

| Area | Decision |
|------|----------|
| Domain | **`harvest_sessions` → `harvest_lines`** (primary model) |
| Independence | Lines hold qty/quality in DRAFT; **no lot / no on_hand change** until Post |
| Post | Each eligible line → existing Inventory **`RECEIVE`** → set `stock_lot_id` |
| Planning | Optional `cropping_cycle_id` / line bind; **many sessions per cycle** |
| Quality | Qty · date/time · optional grade · moisture · notes · photos |
| Ops | Manual 4.5 lifecycle; **no delete/cancel after POSTED**; corrections via inventory adjust |
| Labour | Optional `crew_count` only — **no** labour management / payroll in 4.7 |
| Auth | JWT + FARMER; farm-party scoped |
| Mobile (M12) | Additive Harvest UX after staging API smoke |
| Docs | Feature mapping + API README |

### 1.3 Out of scope

| Deferred | When |
|----------|------|
| Labour management, wages, piece-rate, crew roster | Future labour / payroll module |
| Equipment assignment / depreciation | Future equipment module |
| Full quality classification catalogs / lab QC workflows | Future QC track (schema reserved) |
| Farm activity ops (spray, prune, weed) | Future ops module |
| Drying / wet-mill plant as first-class WMS | Later process track |
| Auto `mark-harvested` / auto Complete on post | Not in 4.7 — manual |
| Auto-create marketplace listings from harvest | Explicit future feature |
| Buyer / Delivery | Buyer unchanged; Delivery = Phase 5 |
| Production Nest cutover | Explicit gate |
| Amharic copy cleanup | Separate follow-up |

---

## 2. Domain separation (invariants)

```
DRAFT harvest (4.7)          → Session + lines only (no stock)
POST harvest (4.7 → 4.2)     → Inventory RECEIVE per line → lots
Stock truth (4.2)            → Lots + movements (system of record)
Plan vs actual (4.5)         → Cropping cycle performance (sum RECEIVE)
Dashboard (4.6)              → Read model (may add harvest counts later)
```

| Rule | Meaning |
|------|---------|
| Harvest ≠ inventory until Post | Creating/editing DRAFT does not create lots or change balances |
| Inventory is SoR for stock | No parallel on-hand table in harvest |
| Post → RECEIVE only | Do not invent a harvest-specific stock write path that bypasses inventory |
| Harvest ≠ plan lifecycle | Post does **not** auto `mark-harvested` / complete; farmers manage cycle status manually |
| Many sessions per plan | Same `cropping_cycle_id` may appear on N sessions over time |
| No delete after Post | POSTED sessions immutable for deletion/cancel; fix qty via inventory ADJUST/LOSS |
| Direct Receive remains | Legacy `POST /inventory/receive` still valid for non-session stock intake |

---

## 3. Positioning

```
Identity
  ↓
Farms / Plots / Cropping cycles (plans)
  ↓
Harvest Management (4.7)          ← Session → Lines (DRAFT)
  ↓  (explicit Post)
Inventory RECEIVE / lots (4.2)    ← stock system of record
  ↓
Warehouse · Listings · Dashboard · future QC / payroll / AI
```

**Today’s gap:** Receive Stock is inventory-first. Field practice wants sessions, date/time, quality context, and multi-event harvest against one plan — without mutating stock until the farmer posts.

---

## 4. Current state

| Capability | Status |
|------------|--------|
| `POST /inventory/receive` | Live — creates lot + RECEIVE |
| Optional cycle/line bind | Live (4.5 Tier A) |
| Multiple RECEIVEs per cycle (plan attainment) | Live |
| Receive UI (farm/product/qty/site/note) | Live |
| Prefill receive from cycle detail | Live (M10) |
| Harvest Session / Lines domain | **Not created** |
| DRAFT independent of inventory | **Not created** |
| Moisture / harvest grade / photos / crew on harvest | **Missing** |
| Dedicated harvest history | **Missing** |

---

## 5. Harvest model (locked)

### 5.1 Primary shape

```
Harvest Session
  └── Harvest Line (1..N)
        └── (after Post) → Stock Lot via Inventory RECEIVE
```

| Entity | Role |
|--------|------|
| **Harvest Session** | One field harvest event window (typically a day/shift); farm-scoped; optional plot; optional cropping cycle |
| **Harvest Line** | One product (+ optional variety) qty and quality snapshot within the session |

### 5.2 Multiple sessions per production plan

- Optional `cropping_cycle_id` on the session (nullable).  
- When set, **many** sessions may reference the **same** cycle (multi-day / multi-pick harvest against one plan).  
- Line-level optional `cropping_cycle_line_id` for product-line bind.  
- Plan actuals continue to come from inventory RECEIVE attribution (4.5) once posted — 4.7 does not store a competing actual qty ledger.

### 5.3 Lifecycle (session)

| Status | Meaning | Stock impact |
|--------|---------|--------------|
| `DRAFT` | Editable session + lines | **None** — independent of inventory |
| `POSTED` | Immutable operationally; each line has `stock_lot_id` | Created at post via RECEIVE |
| *(no CANCELLED-after-post)* | Not used for posted sessions in MVP | — |

**DRAFT rules**

- Create / edit / delete session and lines freely (party write).  
- May attach optional cycle / quality / photos / crew_count.  
- Does **not** call inventory.

**POST rules**

- Validates farm access, non-empty lines, positive qty, product/unit, optional cycle bind.  
- For each line: call Inventory receive (same rules as today) with harvest attributes + optional binds.  
- Persist `stock_lot_id` on the line; set session `POSTED` + `posted_at`.  
- **Does not** call 4.5 `mark-harvested` / complete / cancel (manual lifecycle).  
- Existing 4.5 auto **PLANNED → IN_PROGRESS** on first Tier A receive may still apply inside inventory bind (plan “in progress” signal only — not “harvested”).

**After POST (locked)**

| Action | Allowed? |
|--------|----------|
| Delete session | **No** |
| Cancel session | **No** |
| Edit qty / product / quality on lines | **No** |
| Append new lines | **No** (open new DRAFT session instead — supports multi-event) |
| Correct stock qty | **Yes** — via Inventory adjust / loss (traceability preserved) |

### 5.4 Schema sketch (indicative)

```text
farms.harvest_sessions
  id UUID PK
  farm_id UUID NOT NULL → farms.farms
  plot_id UUID NULL → farms.plots
  cropping_cycle_id UUID NULL → farms.cropping_cycles   -- many sessions per plan
  harvested_on DATE NOT NULL
  harvested_at TIMESTAMPTZ NULL                         -- optional time precision
  status harvest_session_status NOT NULL DEFAULT 'DRAFT'  -- DRAFT | POSTED
  notes TEXT NULL
  crew_count INT NULL                                   -- optional MVP only
  photo_urls TEXT[] NULL DEFAULT '{}'                   -- optional photos
  posted_at TIMESTAMPTZ NULL
  created_at, updated_at

farms.harvest_lines
  id UUID PK
  session_id UUID NOT NULL → harvest_sessions ON DELETE CASCADE  -- cascade only while DRAFT
  product_id UUID NOT NULL → catalog.products
  product_variety_id UUID NULL
  qty NUMERIC(14,3) NOT NULL
  unit_code VARCHAR NOT NULL → catalog.units
  moisture_pct NUMERIC(5,2) NULL                        -- optional
  harvest_grade_class VARCHAR(40) NULL                  -- optional; extensible codes
  quality_note TEXT NULL
  photo_urls TEXT[] NULL DEFAULT '{}'                   -- line-level optional photos
  storage_site_id UUID NULL → warehouse.storage_sites
  cropping_cycle_line_id UUID NULL → cropping_cycle_lines
  stock_lot_id UUID NULL → inventory.stock_lots         -- NULL until Post
  sort_order INT NOT NULL DEFAULT 0
  created_at, updated_at
```

**Integrity:** For `POSTED` sessions, `stock_lot_id` NOT NULL on every line (enforced in service). ON DELETE CASCADE from session→lines is safe for DRAFT; Post forbids session delete.

### 5.5 Quality fields (MVP)

| Field | Level | Required | Notes |
|-------|-------|----------|-------|
| Quantity (`qty` + `unit_code`) | Line | **Yes** | Lands in RECEIVE |
| Harvest date (`harvested_on`) | Session | **Yes** | Passed to lot `harvestDate` on post |
| Harvest time (`harvested_at`) | Session | Optional | Stored for ops/analytics; date remains canonical for bind windows |
| Quality grade (`harvest_grade_class`) | Line | Optional | Distinct from marketplace `Listing.grade` |
| Moisture (`moisture_pct`) | Line | Optional | %; range validated e.g. 0–100 |
| Notes | Session and/or line | Optional | Free text |
| Photos (`photo_urls`) | Session and/or line | Optional | Same URL array pattern as listings |

**Harvest grade class (extensible, not a closed forever enum):**

| Example codes (seed) | Use |
|----------------------|-----|
| `CHERRY` | Coffee cherry as harvested |
| `PARCHMENT` | Farm-processed parchment |
| `GREEN` | Green bean (edge case receive) |
| `OTHER` | Catch-all / non-coffee |

Future quality classifications add codes / optional FK to a classifications table **without** renaming Session→Lines.

### 5.6 Quantity truth

| Metric | Source of truth |
|--------|-----------------|
| DRAFT planned intake | Harvest line qty (not stock) |
| Stock on hand | Inventory lots (unchanged) |
| Plan actual | 4.5 performance over RECEIVE (unchanged) |
| Posted session total | Sum of posted line qtys (= receive qtys) |

---

## 6. Inventory integration (locked)

1. **Only** Inventory `RECEIVE` creates/increases stock for harvest posts.  
2. Harvest service **orchestrates** receive; it does not write lot balances itself.  
3. Inventory remains system of record for: on_hand, reserved, movements, quarantine, warehouse site.  
4. Optional attributes (moisture, harvest grade, quality note, photos, harvest date/time, cycle binds, storage site) pass through to lot / movement metadata as supported by inventory DTO extensions.  
5. Direct `POST /inventory/receive` remains for non-harvest or legacy intake (backward compatible).  
6. Post-stock corrections use **inventory ADJUST / LOSS** (and reservation rules unchanged) — not harvest delete.

---

## 7. API design (draft)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/farms/:farmId/harvest-sessions` | List (filter: status, cycleId, date range) |
| `POST` | `/farms/:farmId/harvest-sessions` | Create **DRAFT** session (+ optional lines) |
| `GET` | `/harvest-sessions/:id` | Detail with lines |
| `PATCH` | `/harvest-sessions/:id` | Update **DRAFT** only |
| `DELETE` | `/harvest-sessions/:id` | Delete **DRAFT** only |
| `POST` | `/harvest-sessions/:id/lines` | Add line (**DRAFT**) |
| `PATCH` | `/harvest-lines/:lineId` | Edit line (**DRAFT**) |
| `DELETE` | `/harvest-lines/:lineId` | Delete line (**DRAFT**) |
| `POST` | `/harvest-sessions/:id/post` | Post → Inventory RECEIVE per line |
| `GET` | `/farms/:farmId/harvest-history` | Posted sessions/lines for mobile |

### 7.1 Auth

JWT + `FARMER`. Farm-party write for mutate/post; read for list/history.

### 7.2 Errors

| Case | Code |
|------|------|
| Post with zero lines / invalid qty | 400 |
| Cycle / line bind failure | 400 (same semantics as 4.5) |
| Mutate or delete **POSTED** session/line | 400 |
| Unknown farm / session | 404 |

---

## 8. Operations policy (locked)

| Topic | Policy |
|-------|--------|
| Plan lifecycle | **Manual** — farmer uses 4.5 actions (`plan` / `start` / `mark-harvested` / `complete`); harvest post does not drive those |
| Multi-event harvest | Open additional **DRAFT** sessions against the same cycle |
| After post | No delete / cancel / quantity edit on harvest records |
| Corrections | Inventory adjustments (and notes) preserve ledger traceability |
| Crew | Optional `crew_count` on session; **no** labour management in this phase |

---

## 9. Future extensibility (locked design intent)

Session → Lines remains stable. Later capabilities attach **additively**:

| Future area | Additive hook |
|-------------|---------------|
| Richer quality classifications | New codes or `quality_class_id` FK; keep `harvest_grade_class` |
| Lab / QC samples | Child table keyed by `harvest_line_id` / `stock_lot_id` |
| Equipment | Optional `equipment_id` / usage child table on session |
| Labour / payroll | Crew roster & wage entities referencing `harvest_session_id` — 4.7 only stores `crew_count` |
| Analytics / AI | Stable harvest APIs + posted-lot links as training/read features; dashboards consume later |
| Photos / docs | Already `photo_urls`; later media service IDs without reshaping lines |
| Multi-commodity | `product_id` already generic |

**Non-goals of extensibility:** do not require redesign of Inventory receive or 4.5 performance formulas.

---

## 10. Integration map

| Module | Role |
|--------|------|
| Farms / plots | Session scope |
| Cropping cycles (4.5) | Optional many-sessions-per-plan bind; manual lifecycle |
| Inventory (4.2) | **SoR** — RECEIVE on post; ADJUST for corrections |
| Warehouse (4.3) | Optional `storage_site_id` on line |
| Catalog | Product / variety / units |
| Dashboard (4.6) | Optional later harvest cards; not required in MVP |
| Listings (4.4) | Unchanged; sell-side grade separate from harvest grade |
| Future payroll / equipment / QC / AI | Additive consumers |

---

## 11. Mobile (Farmer M12) — after staging API smoke

1. Entry from Settings / Inventory / Plan detail: **Harvest**.  
2. Create **DRAFT** session: date/time, farm, plot, optional production plan, optional crew count, notes/photos.  
3. Add **lines**: product, qty, optional grade / moisture / note / photos / site.  
4. Explicit **Post** action → inventory stock appears; plan attainment moves if bound.  
5. History of **POSTED** sessions (read-only).  
6. Stock mistakes → Inventory adjust screens (not harvest delete).  
7. Bilingual labels (Amharic cleanup follow-up may land independently).  

Buyer: **no changes**.

---

## 12. Backward compatibility

| Client | Behaviour |
|--------|-----------|
| Old APK `POST /inventory/receive` | Continues to work |
| New Harvest UI | Session DRAFT → Post |
| 4.5 / 4.6 | Additive; no breaking changes |
| Buyer | Unchanged |

---

## 13. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Farmer expects Post to mark plan harvested | Copy + manual lifecycle policy; no auto status |
| Double stock (Post + separate receive of same cherries) | Education + UI; optional later idempotency keys |
| Attempt to delete posted harvest | API 400; guide to inventory adjust |
| Grade confusion (harvest vs listing) | Distinct field names and mobile labels |
| Scope creep into payroll/equipment | Explicit out-of-scope; only crew_count + extension hooks |

---

## 14. Design decisions locked (product)

- [x] Primary model: **Harvest Session → Harvest Lines**  
- [x] **Multiple harvest sessions** supported against a **single production plan**  
- [x] Harvest **independent of inventory until Post**  
- [x] Post exclusively through Inventory **`RECEIVE`**; inventory is stock SoR  
- [x] Quality MVP: **qty**, **date/time**, optional **grade**, **moisture**, **notes/photos**  
- [x] **Manual** plan/lifecycle management (no auto mark-harvested on post)  
- [x] **No delete/cancel after Post**; corrections via **inventory adjustments**  
- [x] Optional **crew_count** only; labour management **out of scope**  
- [x] Extensibility reserved for future QC classes, equipment, labour/payroll, analytics/AI  
- [x] Formal design **Approved**  
- [x] **Implementation authorized** (this document v1.1)

**Approver:** Product / program (chat) **Date:** 2026-07-15

---

## 15. Implementation plan (after approval **and** explicit authorization only)

| Step | Work |
|------|------|
| 1 | SQL (`farms.harvest_sessions` / `harvest_lines`) |
| 2 | Prisma models |
| 3 | Nest Harvest module + post→receive orchestration |
| 4 | Tests (DRAFT isolation, post RECEIVE, multi-session per plan, POSTED immutability) |
| 5 | Documentation + feature mapping |
| 6 | Staging deploy + smoke |
| 7 | Farmer M12 + APK |
| 8 | Validation → Commit → PR → Merge → Tag |
| 9 | Production only when explicitly approved |

---

## 16. Success criteria

- Session → Lines model in API and mobile.  
- DRAFT never changes inventory balances.  
- Post creates stock only via RECEIVE.  
- Multiple posted sessions can bind to one cropping cycle.  
- Quality fields available as specified.  
- POSTED immutable; corrections via inventory.  
- Plan lifecycle remains manual.  
- Buyer unaffected; production held until explicit approval.

---

## 17. Remaining (non-blocking) review notes

1. Photo upload mechanics: reuse listing photo upload path vs deferred client-only URLs.  
2. Whether `harvested_at` is exposed in M12 MVP or date-only first.  
3. Exact seed list for `harvest_grade_class` beyond CHERRY/PARCHMENT/GREEN/OTHER.  

---

## 18. References

- [Phase 4 — Farmer Platform](phase-4-farmer-platform-design.md)  
- [Phase 4.2 — Inventory](phase-4.2-inventory-design.md)  
- [Phase 4.5 — Production planning](phase-4.5-production-planning-design.md)  
- [Phase 4.6 — Dashboards](phase-4.6-dashboards-design.md)  
- [Backend ↔ Mobile feature mapping](../backend-mobile-feature-mapping.md)
