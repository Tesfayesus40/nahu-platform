# Tagging — v1.0.0-rc1

Tags are created **after** freeze versions + this release folder are committed on each repo. Do not tag dirty trees with unrelated WIP if avoidable.

## nahu-platform

```bash
cd nahu-platform
git status   # confirm intended files only
# commit release prep if not yet committed (explicit human request)
git tag -a v1.0.0-rc1 -m "v1.0.0-rc1 — Nest API + Admin Web pilot RC"
git push origin v1.0.0-rc1
# optional: also push the commit
# git push origin HEAD
```

## nahu-buna-gebaya

```bash
cd nahu-buna-gebaya
git status
git tag -a v1.0.0-rc1 -m "v1.0.0-rc1 — Buyer / Farmer / Courier pilot RC"
git push origin v1.0.0-rc1
```

## Verify

```bash
git show v1.0.0-rc1 --stat
# Confirm package.json / app.config versions read 1.0.0-rc1
# Confirm docs/releases/v1.0.0-rc1 present on platform tag
```

## Note

Creating annotated tags and pushing remotes requires an explicit commit/push request from the release owner. This file is the procedure only.
