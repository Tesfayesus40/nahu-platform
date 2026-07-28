# Version freeze — v1.0.0-rc1

**Effective:** 2026-07-29  
**Policy:** Only **bug fixes** after this freeze until RC1 pilot completes or a patch tag (`v1.0.0-rc1.1`, etc.) is cut.

## Frozen surfaces

| Surface | Package / config version | Repo |
|---------|--------------------------|------|
| Monorepo | `nahu-platform@1.0.0-rc1` | nahu-platform |
| Nest API | `@nahu-platform/api@1.0.0-rc1` | nahu-platform |
| Admin Web | `@nahu-platform/admin-web@1.0.0-rc1` | nahu-platform |
| Gebaya root | `nahu-buna-gebaya@1.0.0-rc1` | nahu-buna-gebaya |
| Buyer | `nahu-buna-buyer@1.0.0-rc1` · Expo `version: 1.0.0-rc1` | nahu-buna-gebaya |
| Farmer | `nahu-buna-farmer@1.0.0-rc1` · Expo `version: 1.0.0-rc1` | nahu-buna-gebaya |
| Courier | `nahu-buna-courier@1.0.0-rc1` · Expo `version: 1.0.0-rc1` | nahu-buna-gebaya |
| Migrations | Manifest frozen at [migration-manifest.frozen.json](./migration-manifest.frozen.json) | nahu-platform |

## Allowed during freeze

- Defect fixes found in [PILOT-VERIFICATION.md](./PILOT-VERIFICATION.md)
- Docs / ops clarifications that do not change product behaviour
- Hotfix CI breakage that blocks the freeze tag itself

## Not allowed

- New marketplace features or verticals  
- Architecture or database redesign  
- UI redesign  
- Live payment providers, notification platform, Honey activation (Tracks A–C)  
- Expanding G8–G10 beyond bugfix  

## Branch suggestion

Prefer tagging from `main` (platform) and the agreed gebaya release branch after RC1 docs + freeze versions are committed. Do not mix unrelated WIP into the tag commit.
