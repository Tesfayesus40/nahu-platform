#!/bin/sh
# Apply Pack 2–4 SQL migrations on an existing staging/production database.
# Safe to re-run: uses IF NOT EXISTS / idempotent ALTERs where possible.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PENDING="
$ROOT/database/migrations/marketplace/006_marketplace_widen_primary_language.sql
$ROOT/database/migrations/marketplace/007_marketplace_add_grade_unknown.sql
$ROOT/database/migrations/orders/008_orders_expand_payment_methods.sql
"

echo "Applying pending Pack 2–4 migrations..."

for migration in $PENDING; do
  if [ ! -f "$migration" ]; then
    echo "Missing migration file: $migration" >&2
    exit 1
  fi
  echo "  -> $migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Done."
