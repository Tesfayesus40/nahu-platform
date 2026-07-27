#!/usr/bin/env node
/**
 * Optional DEMO seed — realistic mobile actors for local / staging demos.
 * Never run against production without explicit approval.
 * RC1 staging: do NOT run unless explicitly requested (empty UAT policy).
 *
 * Creates (idempotent upsert by phone):
 *   Farmer  +251911000101  role FARMER  + farmer_profiles row
 *   Buyer   +251911000201  role BUYER
 *   Courier +251911000301  role COURIER + courier_profiles row
 *
 * Does NOT create listings/orders/shipments (those need moderation/payment flows).
 * Use OTP login on mobile apps after seeding (staging returns dev_otp).
 *
 * Usage:
 *   DATABASE_PUBLIC_URL=... node apps/api/scripts/seed-demo.cjs
 *   pnpm db:seed:demo
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

const DEMO = [
  {
    phone: '+251911000101',
    firstName: 'Demo',
    lastName: 'Farmer',
    role: 'FARMER',
    profile: true,
  },
  {
    phone: '+251911000201',
    firstName: 'Demo',
    lastName: 'Buyer',
    role: 'BUYER',
  },
  {
    phone: '+251911000301',
    firstName: 'Demo',
    lastName: 'Courier',
    role: 'COURIER',
    courier: true,
  },
];

async function main() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('Refusing demo seed in production without ALLOW_DEMO_SEED=true');
    process.exit(1);
  }

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

  for (const d of DEMO) {
    const role = await client.query(
      `SELECT id FROM identity.roles WHERE code = $1`,
      [d.role],
    );
    if (!role.rows[0]) {
      throw new Error(`Role ${d.role} missing — run migrations / db:seed first`);
    }
    const roleId = role.rows[0].id;

    const existing = await client.query(
      `SELECT id FROM identity.users WHERE phone = $1`,
      [d.phone],
    );

    let userId;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await client.query(
        `UPDATE identity.users
         SET first_name = $2, last_name = $3, status = 'ACTIVE',
             phone_verified = true, updated_at = NOW()
         WHERE id = $1`,
        [userId, d.firstName, d.lastName],
      );
    } else {
      const ins = await client.query(
        `INSERT INTO identity.users (
           first_name, last_name, phone, status,
           phone_verified, email_verified, mfa_required, authz_version
         ) VALUES ($1, $2, $3, 'ACTIVE', true, false, false, 1)
         RETURNING id`,
        [d.firstName, d.lastName, d.phone],
      );
      userId = ins.rows[0].id;
    }

    await client.query(
      `INSERT INTO identity.user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId],
    );

    if (d.profile) {
      await client.query(
        `INSERT INTO marketplace.farmer_profiles (
           user_id, region, zone, woreda, primary_language, verified
         ) VALUES ($1, 'ስድማ', 'Sidama', 'Yirgalem', 'am', false)
         ON CONFLICT (user_id) DO UPDATE SET
           region = EXCLUDED.region,
           zone = EXCLUDED.zone,
           woreda = EXCLUDED.woreda,
           updated_at = NOW()`,
        [userId],
      );
    }

    if (d.courier) {
      // courier_profiles PK is user_id
      await client.query(
        `INSERT INTO delivery.courier_profiles (
           user_id, availability, active, verified, created_at, updated_at
         ) VALUES ($1, 'OFFLINE', true, false, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           availability = EXCLUDED.availability,
           active = true,
           updated_at = NOW()`,
        [userId],
      );
    }

    console.log(`OK ${d.role} ${d.phone} user=${userId}`);
  }

  console.log('\nDemo seed OK. Login via OTP on mobile (staging returns dev_otp).');
  console.log('Phones: +251911000101 (farmer), +251911000201 (buyer), +251911000301 (courier)');
  await client.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
