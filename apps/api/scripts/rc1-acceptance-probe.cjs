#!/usr/bin/env node
/**
 * RC1 acceptance probes — read-only DB + HTTP checks.
 * Does not mutate production data except optional smoke with --write-smoke.
 */
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (_) {}
const { Client } = require('pg');

const API = process.env.PUBLIC_API_URL || 'https://nahu-api-staging.up.railway.app';
const base = API.replace(/\/$/, '');

async function http(method, urlPath, body, token) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 200);
  }
  return { status: res.status, data };
}

async function main() {
  const report = { checks: [], ok: 0, fail: 0 };
  const check = (name, pass, detail) => {
    report.checks.push({ name, pass, detail });
    if (pass) report.ok += 1;
    else report.fail += 1;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  };

  // 1) Health
  try {
    const h = await http('GET', '/health');
    check(
      'API /health',
      h.status === 200 && (h.data?.status === 'ok' || h.data?.dependencies?.database === 'up'),
      `HTTP ${h.status} ${JSON.stringify(h.data).slice(0, 120)}`,
    );
  } catch (e) {
    check('API /health', false, e.message);
  }

  // 2) Route reachability (expect 401 without token, not 404)
  for (const p of [
    '/api/v1/delivery/courier/me',
    '/api/v1/delivery/courier/vehicles',
    '/api/v1/delivery/courier/payout-accounts',
    '/api/v1/delivery/courier/notifications',
    '/api/v1/delivery/courier/verification',
    '/api/v1/uploads/courier-media',
    '/api/v1/admin/delivery/courier-verifications',
  ]) {
    try {
      const r = await http(p.includes('uploads') ? 'POST' : 'GET', p);
      const reachable = r.status !== 404 && r.status !== 502 && r.status !== 503;
      check(
        `Route ${p}`,
        reachable,
        `HTTP ${r.status} (401/403/400 expected if not deployed with auth)`,
      );
    } catch (e) {
      check(`Route ${p}`, false, e.message);
    }
  }

  // 3) DB schema
  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!url) {
    check('DB connection', false, 'No DATABASE_URL');
    console.log(JSON.stringify({ summary: report }, null, 2));
    process.exit(report.fail ? 1 : 0);
  }
  const client = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url)
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();
  check('DB connection', true, new URL(url).hostname);

  const mig = await client.query(
    `SELECT filename FROM public.schema_migrations WHERE filename LIKE '%008_delivery_courier%'`,
  );
  check(
    'Migration 008 recorded',
    mig.rows.length > 0,
    mig.rows[0]?.filename || 'missing from schema_migrations',
  );

  const tables = [
    'courier_profiles',
    'courier_vehicles',
    'courier_payout_accounts',
    'courier_verification_cases',
    'courier_verification_documents',
    'courier_notifications',
  ];
  for (const t of tables) {
    const r = await client.query(`SELECT to_regclass('delivery.${t}') AS reg`);
    check(`Table delivery.${t}`, Boolean(r.rows[0].reg), r.rows[0].reg || 'missing');
  }

  // User checklist name vs actual
  const wrong = await client.query(
    `SELECT to_regclass('delivery.courier_identity_verifications') AS reg`,
  );
  check(
    'Note: courier_identity_verifications',
    !wrong.rows[0].reg,
    'Not used — actual table is courier_verification_cases',
  );

  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='delivery' AND table_name='courier_profiles'
      AND column_name IN ('verification_status','photo_url','active_vehicle_id','notification_prefs')
    ORDER BY 1
  `);
  check(
    'courier_profiles CRM columns',
    cols.rows.length >= 4,
    cols.rows.map((r) => r.column_name).join(', '),
  );

  const pk = await client.query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema='delivery'
      AND tc.constraint_type='PRIMARY KEY'
      AND tc.table_name IN (${tables.map((_, i) => `$${i + 1}`).join(',')})
    ORDER BY 1,2
  `, tables);
  check('Primary keys present', pk.rows.length >= 6, `${pk.rows.length} PK columns`);

  const fk = await client.query(`
    SELECT COUNT(*)::int AS n
    FROM information_schema.table_constraints
    WHERE table_schema='delivery' AND constraint_type='FOREIGN KEY'
      AND table_name = ANY($1::text[])
  `, [tables]);
  check('Foreign keys present', fk.rows[0].n >= 3, `${fk.rows[0].n} FKs on CRM tables`);

  const idx = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='delivery'
      AND (
        indexname LIKE '%courier_vehicles_plate%'
        OR indexname LIKE '%courier_notifications%'
        OR indexname LIKE '%courier_verification%'
        OR indexname LIKE '%courier_payout%'
      )
    ORDER BY 1
  `);
  check(
    'CRM indexes',
    idx.rows.length >= 3,
    idx.rows.map((r) => r.indexname).join(', ') || 'none',
  );

  const plate = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname='delivery' AND indexname = 'courier_vehicles_plate_active_uq'
  `);
  check(
    'Plate uniqueness index',
    plate.rows.length === 1 && /unique/i.test(plate.rows[0].indexdef),
    plate.rows[0]?.indexdef?.slice(0, 120) || 'missing',
  );

  await client.end();

  console.log('\n--- Summary ---');
  console.log(`PASS ${report.ok} / FAIL ${report.fail}`);
  if (report.fail) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
