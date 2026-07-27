#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (_) {}
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_PUBLIC_URL missing');
  const client = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url)
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();
  const sqlPath = path.join(
    __dirname,
    '../../../database/migrations/delivery/008_delivery_courier_crm.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await client.query(sql);

  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='schema_migrations'`,
  );
  console.log(
    'schema_migrations columns:',
    cols.rows.map((r) => r.column_name).join(', '),
  );

  const crypto = require('crypto');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  await client.query(
    `INSERT INTO public.schema_migrations (filename, checksum, applied_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (filename) DO NOTHING`,
    ['delivery/008_delivery_courier_crm.sql', checksum, 'apply-008-courier-crm'],
  );

  const check = await client.query(`
    SELECT
      to_regclass('delivery.courier_vehicles') AS vehicles,
      to_regclass('delivery.courier_payout_accounts') AS payouts,
      to_regclass('delivery.courier_verification_cases') AS kyc,
      to_regclass('delivery.courier_notifications') AS notifications,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'delivery'
          AND table_name = 'courier_profiles'
          AND column_name = 'verification_status'
      ) AS profile_extended
  `);
  console.log('Applied:', check.rows[0]);
  await client.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
