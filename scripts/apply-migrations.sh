#!/bin/sh
# Apply all SQL migrations in sorted order. Requires psql and DATABASE_URL.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Applying migrations from $ROOT/database/migrations ..."

for migration in $(find "$ROOT/database/migrations" -name '*.sql' | sort); do
  echo "  -> $migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Done."
