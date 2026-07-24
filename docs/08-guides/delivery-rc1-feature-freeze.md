# Delivery Platform RC1 — Feature Freeze

**Effective:** 2026-07-24  
**Status:** ACTIVE  
**Authority:** Architectural approval of Delivery Platform RC1 (D12)

---

## Freeze scope

Delivery Platform code and product behavior across:

- `nahu-platform` — `apps/api/src/delivery/**`, Admin delivery portal, delivery migrations/docs
- `nahu-buna-gebaya` — Courier / Farmer / Buyer delivery UX and `shared/delivery/**`

are **frozen** for new business functionality.

## Allowed changes (only)

| Category | Examples |
|----------|----------|
| Critical bug fixes | Broken happy path, data corruption, incorrect status |
| Security fixes | Authz bypass, secret exposure, injection |
| Performance fixes | Query/index/timeout without behavior change |
| Deployment fixes | Build, migrate, env, health checks |
| Documentation corrections | Checklists, runbooks, architecture notes |

## Forbidden during freeze

- New business features or domains
- Phase 2 items (AI dispatch, Maps, ETA, push, offline, payouts, tax, signature UI, dynamic pricing, batch optimization, accounting)
- Refactors that change service ownership or state machines
- Parallel financial models or competing event buses
- Expanding FulfillmentCase as a second logistics truth

## Process

1. Propose change with freeze category (bug / security / perf / deploy / docs).
2. Confirm no Phase 2 scope.
3. Prefer feature-flag disable over schema rollback for incidents.
4. Update staging validation report if behavior-adjacent.

## Phase 2 (recorded only — do not implement)

See official RC1 Release Summary § Deferred Phase 2.

---

**End of freeze notice.** Lift only by explicit architectural decision.
