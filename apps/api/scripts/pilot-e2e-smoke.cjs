#!/usr/bin/env node
/**
 * Optional staging pilot E2E smoke (PR-C2 / PR-H1).
 *
 * Exits 0 (skip) when PILOT_SMOKE is unset or required tokens/base URL missing.
 * When enabled, walks: create order → confirm-payment → fulfil → settle → ops health.
 *
 * Env:
 *   PILOT_SMOKE=1
 *   API_BASE_URL          e.g. https://host/api/v1
 *   BUYER_TOKEN           JWT
 *   FARMER_TOKEN          JWT (optional — skips seller steps)
 *   COURIER_TOKEN         JWT (optional — skips courier confirms)
 *   ADMIN_TOKEN           JWT (optional — ops dashboard)
 *   SMOKE_LISTING_ID      approved listing UUID (required when running)
 *   SMOKE_QUANTITY        default 1
 *   SMOKE_COURIER_USER_ID courier user UUID for assign (optional)
 */
'use strict';

const API = String(process.env.API_BASE_URL || '')
  .replace(/\/$/, '')
  .replace(/\/api\/v1$/, '');
const BASE = API ? `${API}/api/v1` : '';
const enabled = process.env.PILOT_SMOKE === '1' || process.env.PILOT_SMOKE === 'true';

function skip(msg) {
  console.log(`[pilot-e2e-smoke] skip: ${msg}`);
  process.exit(0);
}

async function req(method, path, body, token) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 300);
  }
  return { status: res.status, data };
}

async function main() {
  if (!enabled) skip('PILOT_SMOKE not set');
  if (!BASE || !process.env.BUYER_TOKEN) {
    skip('API_BASE_URL / BUYER_TOKEN not configured');
  }

  const buyer = process.env.BUYER_TOKEN;
  const farmer = process.env.FARMER_TOKEN;
  const courier = process.env.COURIER_TOKEN;
  const admin = process.env.ADMIN_TOKEN;
  const listingId = process.env.SMOKE_LISTING_ID;
  const qty = Number(process.env.SMOKE_QUANTITY || 1);
  const courierUserId = process.env.SMOKE_COURIER_USER_ID;

  console.log('[pilot-e2e-smoke] base', BASE);

  // Health readiness (unprefixed)
  const readyUrl = `${API}/health/ready`;
  const readyRes = await fetch(readyUrl);
  console.log(`ready ${readyRes.status}`);
  if (!readyRes.ok) {
    console.error('Readiness probe failed');
    process.exit(1);
  }

  if (!listingId) {
    skip('SMOKE_LISTING_ID required for money-path steps (health already ok)');
  }

  const create = await req(
    'POST',
    '/orders',
    {
      listingId,
      quantity: qty,
      paymentMethod: 'TELEBIRR',
      deliveryMethod: 'NAHU_COURIER',
      deliveryAddress: 'RC1 Pilot Dropoff, Bole, Addis Ababa',
    },
    buyer,
  );
  console.log('createOrder', create.status);
  if (create.status < 200 || create.status >= 300) {
    console.error(create.data);
    process.exit(1);
  }
  const orderId =
    create.data?.id ||
    create.data?.data?.id ||
    create.data?.order?.id;
  if (!orderId) {
    console.error('No order id in response', create.data);
    process.exit(1);
  }

  const pay = await req('PATCH', `/orders/${orderId}/confirm-payment`, {}, buyer);
  console.log('confirm-payment', pay.status, pay.data?.paymentStatus || pay.data?.status || '');
  if (pay.status < 200 || pay.status >= 300) {
    console.error(pay.data);
    process.exit(1);
  }

  if (farmer) {
    const accept = await req(
      'POST',
      `/fulfillment/orders/${orderId}/seller-accept`,
      {},
      farmer,
    );
    console.log('seller-accept', accept.status);
    const prep = await req(
      'POST',
      `/fulfillment/orders/${orderId}/preparing`,
      {},
      farmer,
    );
    console.log('preparing', prep.status);
    const ready = await req(
      'POST',
      `/fulfillment/orders/${orderId}/ready-for-pickup`,
      {},
      farmer,
    );
    console.log('ready-for-pickup', ready.status);

    if (courierUserId && admin) {
      const assign = await req(
        'POST',
        `/admin/fulfillment/orders/${orderId}/assign`,
        { courierUserId },
        admin,
      );
      console.log('assign', assign.status);
    }

    if (courier) {
      const pickupCourier = await req(
        'POST',
        `/fulfillment/orders/${orderId}/confirm-pickup`,
        { party: 'COURIER' },
        courier,
      );
      console.log('confirm-pickup courier', pickupCourier.status);
      const pickupSeller = await req(
        'POST',
        `/fulfillment/orders/${orderId}/confirm-pickup`,
        { party: 'SELLER' },
        farmer,
      );
      console.log('confirm-pickup seller', pickupSeller.status);
      await req(
        'POST',
        `/fulfillment/orders/${orderId}/in-transit`,
        {},
        courier,
      );
      const deliveryCourier = await req(
        'POST',
        `/fulfillment/orders/${orderId}/confirm-delivery`,
        { party: 'COURIER' },
        courier,
      );
      console.log('confirm-delivery courier', deliveryCourier.status);
      const deliveryBuyer = await req(
        'POST',
        `/fulfillment/orders/${orderId}/confirm-delivery`,
        { party: 'BUYER' },
        buyer,
      );
      console.log('confirm-delivery buyer', deliveryBuyer.status);
    }

    if (admin) {
      const settle = await req(
        'POST',
        `/admin/fulfillment/orders/${orderId}/settle`,
        {},
        admin,
      );
      console.log('settle', settle.status);
    }
  } else {
    console.log('FARMER_TOKEN unset — skipped fulfilment chain');
  }

  if (admin) {
    const dash = await req('GET', '/admin/ops/dashboard', undefined, admin);
    console.log('ops/dashboard', dash.status);
    const opsHealth = await req('GET', '/admin/ops/health', undefined, admin);
    console.log('ops/health', opsHealth.status);
    if (dash.status >= 400 || opsHealth.status >= 400) {
      process.exit(1);
    }
  } else {
    console.log('ADMIN_TOKEN unset — skipped ops checks');
  }

  console.log('[pilot-e2e-smoke] OK order', orderId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
