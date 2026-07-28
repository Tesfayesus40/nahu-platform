# Version freeze — v1.0.0-rc1

**Effective:** 2026-07-29  
**Policy:** Only **bug fixes** after tags are cut until pilot completes or a patch tag (`v1.0.0-rc1.1`) is issued.

**Authoritative scope:** [RC1_MANIFEST.md](./RC1_MANIFEST.md)

## Frozen surfaces

| Surface | Package / config version | Repo |
|---------|--------------------------|------|
| Monorepo | `nahu-platform@1.0.0-rc1` | nahu-platform |
| Nest API | `@nahu-platform/api@1.0.0-rc1` | nahu-platform |
| Admin Web | `@nahu-platform/admin-web@1.0.0-rc1` | nahu-platform |
| Gebaya root | `nahu-buna-gebaya@1.0.0-rc1` | nahu-buna-gebaya |
| Buyer | `1.0.0-rc1` (package + Expo) | nahu-buna-gebaya |
| Farmer | `1.0.0-rc1` (package + Expo) | nahu-buna-gebaya |
| Courier | `1.0.0-rc1` (package + Expo) | nahu-buna-gebaya |
| Shared | Follows gebaya root | nahu-buna-gebaya |
| Migrations | Through `ops/013` ([frozen JSON](./migration-manifest.frozen.json)) | nahu-platform |

## Allowed during freeze

- Defect fixes from [PILOT-VERIFICATION.md](./PILOT-VERIFICATION.md)
- Docs / ops clarifications that do not change product behaviour
- Hotfix CI breakage that blocks the tagged release

## Not allowed

- New marketplace features or verticals  
- Architecture or database redesign  
- UI redesign  
- Live payment providers, notification platform, Honey activation (Tracks A–C)  
- Expanding G8–G10 beyond bugfix  

## Branch / tag

Tag from clean `main` (`nahu-platform`) and `chore/farmer-rc1` (`nahu-buna-gebaya`) after owner approval. See [TAGGING.md](./TAGGING.md).
