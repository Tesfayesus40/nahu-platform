#!/bin/sh
set -e

echo "Applying Nahu Platform SQL migrations..."

for migration in $(find /migrations -name '*.sql' | sort); do
  echo "  -> ${migration}"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migration"
done

echo "Migrations complete."
