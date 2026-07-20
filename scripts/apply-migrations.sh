#!/bin/sh
# Apply migrations in manifest order. Requires psql, Node.js, and DATABASE_URL.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is not available on PATH." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is not available on PATH." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="$ROOT/database/migrations"
MANIFEST="$MIGRATIONS_DIR/manifest.json"
A1_FIRST="identity/013_identity_admin_user_columns.sql"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: Migration manifest not found: $MANIFEST" >&2
  exit 1
fi

DEFAULT_APPLIED_BY="$(whoami 2>/dev/null || true)"
APPLIED_BY="${APPLIED_BY:-${DEFAULT_APPLIED_BY:-apply-migrations}}"

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

checksum_file() {
  node -e "const fs=require('fs');const crypto=require('crypto');process.stdout.write(crypto.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" "$1"
}

MIGRATIONS="$(
  node -e '
    const fs = require("fs");
    const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (manifest.version !== 1 || !Array.isArray(manifest.migrations)) {
      throw new Error("Unsupported or invalid migration manifest");
    }
    if (new Set(manifest.migrations).size !== manifest.migrations.length) {
      throw new Error("Migration manifest contains duplicate paths");
    }
    for (const migration of manifest.migrations) {
      if (typeof migration !== "string" || migration.length === 0) {
        throw new Error("Migration paths must be non-empty strings");
      }
      console.log(migration);
    }
  ' "$MANIFEST"
)"

echo "Ensuring public.schema_migrations exists ..."
psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text
);"

LEDGER_COUNT="$(psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.schema_migrations;" | tr -d '[:space:]')"
IDENTITY_USERS_EXISTS="$(psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT to_regclass('identity.users') IS NOT NULL;" | tr -d '[:space:]')"

if [ "${MARK_EXISTING:-0}" = "1" ]; then
  if [ "$LEDGER_COUNT" != "0" ]; then
    echo "ERROR: MARK_EXISTING=1 is allowed only when schema_migrations is empty." >&2
    exit 1
  fi
  if [ "$IDENTITY_USERS_EXISTS" != "t" ]; then
    echo "ERROR: MARK_EXISTING=1 requires an existing identity.users table." >&2
    exit 1
  fi

  echo "Marking pre-A1 migrations as already applied ..."
  while IFS= read -r relative; do
    [ -n "$relative" ] || continue
    [ "$relative" != "$A1_FIRST" ] || break
    migration="$MIGRATIONS_DIR/$relative"
    if [ ! -f "$migration" ]; then
      echo "ERROR: Manifest migration not found: $relative" >&2
      exit 1
    fi
    checksum="$(checksum_file "$migration")"
    escaped_relative="$(sql_escape "$relative")"
    escaped_checksum="$(sql_escape "$checksum")"
    escaped_applied_by="$(sql_escape "$APPLIED_BY")"
    psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "
      INSERT INTO public.schema_migrations (filename, checksum, applied_by)
      VALUES ('$escaped_relative', '$escaped_checksum', '$escaped_applied_by');"
    echo "  MARK $relative"
  done <<EOF
$MIGRATIONS
EOF
fi

echo "Applying migrations from manifest as $APPLIED_BY ..."
while IFS= read -r relative; do
  [ -n "$relative" ] || continue
  migration="$MIGRATIONS_DIR/$relative"
  if [ ! -f "$migration" ]; then
    echo "ERROR: Manifest migration not found: $relative" >&2
    exit 1
  fi

  checksum="$(checksum_file "$migration")"
  escaped_relative="$(sql_escape "$relative")"
  existing_checksum="$(psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
    SELECT checksum
    FROM public.schema_migrations
    WHERE filename = '$escaped_relative';" | tr -d '[:space:]')"

  if [ -n "$existing_checksum" ]; then
    if [ "$existing_checksum" = "$checksum" ]; then
      echo "  SKIP $relative"
      continue
    fi
    echo "ERROR: Checksum mismatch for $relative." >&2
    echo "  recorded: $existing_checksum" >&2
    echo "  current:  $checksum" >&2
    exit 1
  fi

  echo "  APPLY $relative"
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration"

  escaped_checksum="$(sql_escape "$checksum")"
  escaped_applied_by="$(sql_escape "$APPLIED_BY")"
  psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "
    INSERT INTO public.schema_migrations (filename, checksum, applied_by)
    VALUES ('$escaped_relative', '$escaped_checksum', '$escaped_applied_by');"
  echo "  DONE  $relative"
done <<EOF
$MIGRATIONS
EOF

echo "All manifest migrations are current."
