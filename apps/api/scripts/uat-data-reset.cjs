#!/usr/bin/env node
/**
 * Safe UAT / staging DATA-ONLY reset.
 *
 * Preserves schema, migrations ledger, RBAC seeds, catalog/ops lookups,
 * and selected users (default: SUPER_ADMIN + PLATFORM_ADMIN).
 *
 * Usage:
 *   pnpm db:reset -- --confirm=UAT_RESET
 *   pnpm db:reset -- --confirm=UAT_RESET --keep-user=+251911200001 --keep-user=+251911300001
 *   pnpm db:reset -- --confirm=UAT_RESET --keep-role=ADMIN --keep-role=SUPPORT_AGENT
 *   pnpm db:reset -- --dry-run --keep-user=uat.farmer@example.com
 *
 * Options:
 *   --confirm=UAT_RESET   Required safety gate (unless --dry-run)
 *   --dry-run             Print counts + preserve list only (no writes)
 *   --keep-user=<phone|email>   Repeatable; keep that account (+ roles/credentials/MFA)
 *   --keep-role=<ROLE_CODE>     Repeatable; keep all users with that role
 *   --sql=path            Override truncate SQL (default database/scripts/uat-data-reset.sql)
 *
 * Default keep roles (always applied): SUPER_ADMIN, PLATFORM_ADMIN
 * Business data is always cleared (listings, orders, shipments, profiles, …).
 * Kept mobile accounts remain as login shells for the next UAT cycle.
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

const DEFAULT_KEEP_ROLES = ['SUPER_ADMIN', 'PLATFORM_ADMIN'];

function arg(name, fallback) {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? true;
}

/** Collect repeatable --name=value and --name value flags. */
function argsAll(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    const a = process.argv[i];
    if (a.startsWith(`--${name}=`)) {
      out.push(a.slice(name.length + 3));
    } else if (a === `--${name}` && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
      out.push(process.argv[i + 1]);
      i += 1;
    }
  }
  return out.map((v) => String(v).trim()).filter(Boolean);
}

function normalizeKeepUser(raw) {
  const v = String(raw).trim();
  if (v.includes('@')) return { kind: 'email', value: v.toLowerCase() };
  return { kind: 'phone', value: v };
}

async function main() {
  const confirm = arg('confirm', '');
  const dryRun = process.argv.includes('--dry-run');
  const keepUsersRaw = argsAll('keep-user');
  const keepRolesExtra = argsAll('keep-role').map((r) => r.toUpperCase());
  const keepRoles = [...new Set([...DEFAULT_KEEP_ROLES, ...keepRolesExtra])];
  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

  if (!url) {
    console.error('Set DATABASE_PUBLIC_URL (or DATABASE_URL) to the target Postgres.');
    process.exit(1);
  }
  if (String(url).includes('.railway.internal')) {
    console.error('Use DATABASE_PUBLIC_URL (public proxy), not .railway.internal');
    process.exit(1);
  }
  if (!dryRun && confirm !== 'UAT_RESET') {
    console.error('Refusing to run without --confirm=UAT_RESET (or pass --dry-run).');
    process.exit(1);
  }

  const root = path.resolve(__dirname, '../../..');
  const sqlPath = path.resolve(
    root,
    arg('sql', 'database/scripts/uat-data-reset.sql'),
  );
  if (!fs.existsSync(sqlPath)) {
    console.error('SQL file not found:', sqlPath);
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes('localhost') || url.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected:', new URL(url).hostname);

  const before = await snapshot(client);
  console.log('Before:', before);

  const { preserveIds, preserveRows, missingUsers, missingRoles } =
    await resolvePreserveSet(client, keepUsersRaw, keepRoles);

  console.log('Keep roles:', keepRoles.join(', '));
  if (keepUsersRaw.length) {
    console.log('Keep users (requested):', keepUsersRaw.join(', '));
  }

  console.log(`Users that will be preserved (${preserveRows.length}):`);
  if (preserveRows.length === 0) {
    console.warn('  (none — after reset you must bootstrap-admin again)');
  } else {
    for (const row of preserveRows) {
      console.log(
        `  ${row.roles || '—'}  ${row.email || '—'}  ${row.phone || '—'}`,
      );
    }
  }
  if (missingRoles.length) {
    console.log('Unknown --keep-role (ignored):', missingRoles.join(', '));
  }
  if (missingUsers.length) {
    console.log('No matching user for --keep-user:', missingUsers.join(', '));
  }

  if (dryRun) {
    console.log('Dry run only — no changes applied.');
    await client.end();
    return;
  }

  const truncateSql = stripSqlComments(fs.readFileSync(sqlPath, 'utf8')).trim();
  if (!/^TRUNCATE\b/i.test(truncateSql)) {
    console.error('Expected truncate-only SQL in', sqlPath);
    process.exit(1);
  }

  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TEMP TABLE _uat_preserve_users (
        id uuid PRIMARY KEY
      ) ON COMMIT DROP
    `);

    if (preserveIds.length) {
      await client.query(
        `INSERT INTO _uat_preserve_users (id)
         SELECT DISTINCT x::uuid FROM unnest($1::uuid[]) AS x`,
        [preserveIds],
      );
    }

    await client.query(truncateSql);

    // Keep all role links for preserved users; drop everyone else's.
    await client.query(`
      DELETE FROM identity.user_roles
      WHERE user_id NOT IN (SELECT id FROM _uat_preserve_users)
    `);
    await client.query(`
      DELETE FROM identity.mfa_recovery_codes
      WHERE user_id NOT IN (SELECT id FROM _uat_preserve_users)
    `);
    await client.query(`
      DELETE FROM identity.mfa_factors
      WHERE user_id NOT IN (SELECT id FROM _uat_preserve_users)
    `);
    await client.query(`
      DELETE FROM identity.credentials
      WHERE user_id NOT IN (SELECT id FROM _uat_preserve_users)
    `);
    await client.query(`
      DELETE FROM identity.users
      WHERE id NOT IN (SELECT id FROM _uat_preserve_users)
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  const after = await snapshot(client);
  console.log('After:', after);

  const preserved = await client.query(
    `SELECT count(*)::int AS n FROM identity.roles`,
  );
  const perms = await client.query(
    `SELECT count(*)::int AS n FROM identity.permissions`,
  );
  const products = await client.query(
    `SELECT count(*)::int AS n FROM catalog.products`,
  );
  const migrations = await client.query(
    `SELECT count(*)::int AS n FROM public.schema_migrations`,
  );

  console.log('Preserved config:');
  console.log({
    roles: preserved.rows[0].n,
    permissions: perms.rows[0].n,
    products: products.rows[0].n,
    schema_migrations: migrations.rows[0].n,
    kept_users: after.users,
    admin_users: after.admin_users,
  });

  if (after.listings !== 0 || after.orders !== 0 || after.shipments !== 0) {
    console.error('Reset incomplete — business tables not empty.');
    process.exit(1);
  }
  if (preserved.rows[0].n < 1 || perms.rows[0].n < 1) {
    console.error('RBAC seeds missing — migrations may not be applied.');
    process.exit(1);
  }
  if (preserveIds.length && after.users < preserveIds.length) {
    console.error('Some preserve-set users were lost during reset.');
    process.exit(1);
  }

  console.log('\nUAT data reset OK. Schema + migrations unchanged.');
  console.log(
    'RC1 staging: do not run db:seed:demo unless explicitly requested.',
  );
  await client.end();
}

async function resolvePreserveSet(client, keepUsersRaw, keepRoles) {
  const roleCheck = await client.query(
    `SELECT code FROM identity.roles WHERE code = ANY($1::text[])`,
    [keepRoles],
  );
  const foundRoles = new Set(roleCheck.rows.map((r) => r.code));
  const missingRoles = keepRoles.filter((r) => !foundRoles.has(r));
  const effectiveRoles = keepRoles.filter((r) => foundRoles.has(r));

  const byRole =
    effectiveRoles.length === 0
      ? { rows: [] }
      : await client.query(
          `
        SELECT DISTINCT u.id
        FROM identity.users u
        JOIN identity.user_roles ur ON ur.user_id = u.id
        JOIN identity.roles r ON r.id = ur.role_id
        WHERE r.code = ANY($1::text[])
        `,
          [effectiveRoles],
        );

  const idSet = new Set(byRole.rows.map((r) => r.id));
  const missingUsers = [];

  for (const raw of keepUsersRaw) {
    const spec = normalizeKeepUser(raw);
    const found =
      spec.kind === 'email'
        ? await client.query(
            `SELECT id FROM identity.users WHERE lower(email) = $1`,
            [spec.value],
          )
        : await client.query(
            `SELECT id FROM identity.users WHERE phone = $1`,
            [spec.value],
          );
    if (!found.rows[0]) {
      missingUsers.push(raw);
      continue;
    }
    idSet.add(found.rows[0].id);
  }

  const preserveIds = [...idSet];
  let preserveRows = [];
  if (preserveIds.length) {
    const detail = await client.query(
      `
      SELECT
        u.id,
        u.email,
        u.phone,
        string_agg(DISTINCT r.code, ', ' ORDER BY r.code) AS roles
      FROM identity.users u
      LEFT JOIN identity.user_roles ur ON ur.user_id = u.id
      LEFT JOIN identity.roles r ON r.id = ur.role_id
      WHERE u.id = ANY($1::uuid[])
      GROUP BY u.id, u.email, u.phone
      ORDER BY u.email NULLS LAST, u.phone
      `,
      [preserveIds],
    );
    preserveRows = detail.rows;
  }

  return { preserveIds, preserveRows, missingUsers, missingRoles };
}

function stripSqlComments(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

async function snapshot(client) {
  const q = async (sqlText) => {
    try {
      const r = await client.query(sqlText);
      return Number(r.rows[0].n);
    } catch {
      return -1;
    }
  };
  return {
    users: await q('SELECT count(*)::int AS n FROM identity.users'),
    admin_users: await q(`
      SELECT count(DISTINCT u.id)::int AS n
      FROM identity.users u
      JOIN identity.user_roles ur ON ur.user_id = u.id
      JOIN identity.roles r ON r.id = ur.role_id
      WHERE r.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
    `),
    listings: await q('SELECT count(*)::int AS n FROM marketplace.listings'),
    orders: await q('SELECT count(*)::int AS n FROM orders.orders'),
    shipments: await q('SELECT count(*)::int AS n FROM delivery.shipments'),
    pickup_locations: await q(
      'SELECT count(*)::int AS n FROM marketplace.pickup_locations',
    ),
    buyer_addresses: await q(
      'SELECT count(*)::int AS n FROM marketplace.buyer_addresses',
    ),
    otps: await q('SELECT count(*)::int AS n FROM identity.otp_codes'),
  };
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
