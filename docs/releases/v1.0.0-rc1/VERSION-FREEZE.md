# Version freeze — v1.0.0-rc1

**Effective:** 2026-07-29  
**Policy:** Only **bug fixes** after this freeze until RC1 pilot completes or a patch tag (`v1.0.0-rc1.1`, etc.) is cut.

**Authoritative scope:** [RC1_MANIFEST.md](./RC1_MANIFEST.md)

## Frozen surfaces (on release commits)

| Surface | Package / config version | Repo | On release commit? |
|---------|--------------------------|------|--------------------|
| Monorepo | `nahu-platform@1.0.0-rc1` | nahu-platform | Yes (version) |
| Nest API | `@nahu-platform/api@1.0.0-rc1` | nahu-platform | Yes (version); product code still WIP |
| Admin Web | `@nahu-platform/admin-web@1.0.0-rc1` | nahu-platform | Yes (version); product code still WIP |
| Gebaya root | `nahu-buna-gebaya@1.0.0-rc1` | nahu-buna-gebaya | Yes (version) |
| Buyer | `nahu-buna-buyer@1.0.0-rc1` · Expo `1.0.0-rc1` | nahu-buna-gebaya | Yes (version); Nest WIP uncommitted |
| Farmer | `nahu-buna-farmer@1.0.0-rc1` · Expo `1.0.0-rc1` | nahu-buna-gebaya | Yes (version); Nest WIP uncommitted |
| Shared | No separate semver — follows gebaya root | nahu-buna-gebaya | Partially uncommitted |
| Migrations | Target through `ops/013` ([frozen JSON](./migration-manifest.frozen.json)) | nahu-platform | Target documented; SQL still WIP |

## Explicitly excluded until committed

| Surface | Reason |
|---------|--------|
| **Courier app runtime** (`nahu-buna-courier` source, `package.json`, Expo config) | Only checklist + assets on HEAD; runnable app remains untracked. Working-tree versions are `1.0.0-rc1` but **not** part of the release commit set. Include by committing the full app, then update [RC1_MANIFEST.md](./RC1_MANIFEST.md). |

## Allowed during freeze

- Defect fixes found in [PILOT-VERIFICATION.md](./PILOT-VERIFICATION.md)
- Docs / ops clarifications that do not change product behaviour
- Committing **RC1 required** WIP already implemented (to make the tag reproducible)
- Hotfix CI breakage that blocks the freeze tag itself

## Not allowed

- New marketplace features or verticals  
- Architecture or database redesign  
- UI redesign  
- Live payment providers, notification platform, Honey activation (Tracks A–C)  
- Expanding G8–G10 beyond bugfix  

## Branch suggestion

Do **not** tag until [RC1_MANIFEST.md](./RC1_MANIFEST.md) §10 reads tag-ready. Prefer `main` (platform) and the agreed gebaya release branch after RC1-required code is committed.
