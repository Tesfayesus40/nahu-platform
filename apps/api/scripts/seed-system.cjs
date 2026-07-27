#!/usr/bin/env node
/**
 * System seed — verifies (and documents) migration-seeded platform configuration.
 *
 * Roles, permissions, catalog, ops flags, season/activity lookups are applied by
 * SQL migrations. This script does NOT invent duplicate seeds; it asserts the
 * platform baseline is present after migrate / UAT reset.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL=... node apps/api/scripts/seed-system.cjs
 *   pnpm db:seed
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
} catch {
  /* dotenv optional */
}

const REQUIRED_ROLES = [
  'FARMER',
  'BUYER',
  'COURIER',
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
];

async function main() {
  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_PUBLIC_URL or DATABASE_URL');
    process.exit(1);
  }
  if (String(url).includes('.railway.internal')) {
    console.error('Use DATABASE_PUBLIC_URL (public proxy), not .railway.internal');
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes('localhost') || url.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();

  const roles = await client.query(
    `SELECT code FROM identity.roles ORDER BY code`,
  );
  const roleCodes = roles.rows.map((r) => r.code);
  const missingRoles = REQUIRED_ROLES.filter((c) => !roleCodes.includes(c));

  const counts = {
    roles: roleCodes.length,
    permissions: Number(
      (await client.query(`SELECT count(*)::int AS n FROM identity.permissions`))
        .rows[0].n,
    ),
    role_permissions: Number(
      (
        await client.query(
          `SELECT count(*)::int AS n FROM identity.role_permissions`,
        )
      ).rows[0].n,
    ),
    categories: Number(
      (await client.query(`SELECT count(*)::int AS n FROM catalog.categories`))
        .rows[0].n,
    ),
    products: Number(
      (await client.query(`SELECT count(*)::int AS n FROM catalog.products`))
        .rows[0].n,
    ),
    units: Number(
      (await client.query(`SELECT count(*)::int AS n FROM catalog.units`)).rows[0]
        .n,
    ),
    feature_flags: Number(
      (await client.query(`SELECT count(*)::int AS n FROM ops.feature_flags`))
        .rows[0].n,
    ),
    system_settings: Number(
      (await client.query(`SELECT count(*)::int AS n FROM ops.system_settings`))
        .rows[0].n,
    ),
    season_codes: Number(
      (await client.query(`SELECT count(*)::int AS n FROM farms.season_codes`))
        .rows[0].n,
    ),
    activity_types: Number(
      (await client.query(`SELECT count(*)::int AS n FROM farms.activity_types`))
        .rows[0].n,
    ),
    schema_migrations: Number(
      (
        await client.query(
          `SELECT count(*)::int AS n FROM public.schema_migrations`,
        )
      ).rows[0].n,
    ),
    admins: Number(
      (
        await client.query(`
          SELECT count(DISTINCT u.id)::int AS n
          FROM identity.users u
          JOIN identity.user_roles ur ON ur.user_id = u.id
          JOIN identity.roles r ON r.id = ur.role_id
          WHERE r.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
        `)
      ).rows[0].n,
    ),
  };

  console.log('System seed baseline (from migrations):');
  console.log(counts);
  console.log('Roles:', roleCodes.join(', '));

  if (missingRoles.length) {
    console.error('Missing required roles:', missingRoles.join(', '));
    console.error('Apply pending migrations: node scripts/apply-migrations.mjs');
    process.exit(1);
  }
  if (counts.permissions < 1 || counts.products < 1) {
    console.error('Catalog/RBAC incomplete — apply migrations before UAT.');
    process.exit(1);
  }
  if (counts.admins < 1) {
    console.warn(
      'No SUPER_ADMIN/PLATFORM_ADMIN found. Bootstrap with:\n' +
        '  node apps/api/scripts/bootstrap-admin.cjs --email ... --phone +2519... --password ... --role SUPER_ADMIN',
    );
  } else {
    console.log(`Admin accounts present: ${counts.admins}`);
  }

  console.log('\nSystem seed OK — configuration preserved by migrations.');
  await client.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
