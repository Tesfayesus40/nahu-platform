#!/usr/bin/env node
/**
 * RC1 AD-1 buyer confirmation workflow smoke (staging).
 *
 * Expects an order that already has an active shipment in DELIVERED
 * (courier POD/OTP done). Confirms via buyer OTP session, then asserts:
 *   - order.status === COMPLETED
 *   - shipment events include BUYER_CONFIRMED then COMPLETED
 *   - tracking.canConfirmDelivery === false
 *
 * Env:
 *   PUBLIC_API_URL (default staging)
 *   SMOKE_BUYER_PHONE
 *   SMOKE_ORDER_ID   (required — order with DELIVERED shipment)
 */
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (_) {}

const API = (
  process.env.PUBLIC_API_URL || 'https://nahu-api-staging.up.railway.app'
).replace(/\/$/, '');
const PHONE = process.env.SMOKE_BUYER_PHONE || '+251911000201';
const ORDER_ID = process.env.SMOKE_ORDER_ID;

async function req(method, p, body, token) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${p}`, {
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
  if (!ORDER_ID) {
    console.error('Set SMOKE_ORDER_ID to a buyer order with shipment DELIVERED');
    process.exit(2);
  }
  console.log('API', API, 'order', ORDER_ID, 'phone', PHONE);

  const otpReq = await req('POST', '/api/v1/auth/request-otp', {
    phone: PHONE,
    role: 'BUYER',
  });
  console.log('request-otp', otpReq.status);
  const otp =
    otpReq.data?.dev_otp ||
    otpReq.data?.devOtp ||
    otpReq.data?.otp ||
    process.env.SMOKE_OTP ||
    '123456';

  const verify = await req('POST', '/api/v1/auth/verify-otp', {
    phone: PHONE,
    otp: String(otp),
    role: 'BUYER',
  });
  const token = verify.data?.accessToken || verify.data?.token;
  if (!token) {
    console.error('No buyer token', verify.status, verify.data);
    process.exit(1);
  }

  const trackingBefore = await req(
    'GET',
    `/api/v1/delivery/buyer/orders/${ORDER_ID}/tracking`,
    undefined,
    token,
  );
  console.log(
    'tracking.before',
    trackingBefore.status,
    'canConfirm=',
    trackingBefore.data?.canConfirmDelivery,
    'shipment=',
    trackingBefore.data?.activeShipment?.currentStatus,
  );
  if (!trackingBefore.data?.canConfirmDelivery) {
    console.error('FAIL expected canConfirmDelivery=true before confirm');
    process.exit(1);
  }
  if (trackingBefore.data?.activeShipment?.currentStatus !== 'DELIVERED') {
    console.error('FAIL expected active shipment DELIVERED');
    process.exit(1);
  }

  const confirm = await req(
    'PATCH',
    `/api/v1/orders/${ORDER_ID}/confirm-delivery`,
    {},
    token,
  );
  console.log('confirm-delivery', confirm.status, confirm.data?.status);
  if (confirm.status >= 300 || confirm.data?.status !== 'COMPLETED') {
    console.error('FAIL confirm did not complete order', confirm.data);
    process.exit(1);
  }

  const trackingAfter = await req(
    'GET',
    `/api/v1/delivery/buyer/orders/${ORDER_ID}/tracking`,
    undefined,
    token,
  );
  console.log(
    'tracking.after',
    'canConfirm=',
    trackingAfter.data?.canConfirmDelivery,
    'shipment=',
    trackingAfter.data?.activeShipment?.currentStatus ??
      trackingAfter.data?.shipments?.[0]?.currentStatus,
  );

  const detail = await req(
    'GET',
    `/api/v1/delivery/buyer/shipments/${
      trackingBefore.data.activeShipment.id
    }`,
    undefined,
    token,
  );
  const timeline = detail.data?.timeline || detail.data?.events || [];
  const types = timeline.map((e) => e.eventType || `${e.fromStatus}->${e.toStatus}`);
  console.log('timeline.tail', types.slice(-6));

  const sawBuyerConfirmed = timeline.some(
    (e) =>
      e.toStatus === 'BUYER_CONFIRMED' ||
      e.eventType === 'delivery.shipment.buyer_confirmed',
  );
  const sawCompleted = timeline.some(
    (e) =>
      e.toStatus === 'COMPLETED' ||
      e.eventType === 'delivery.shipment.completed',
  );

  if (!sawBuyerConfirmed) {
    console.error('FAIL missing BUYER_CONFIRMED transition in timeline');
    process.exit(1);
  }
  if (!sawCompleted) {
    console.error('FAIL missing COMPLETED transition in timeline');
    process.exit(1);
  }
  if (trackingAfter.data?.canConfirmDelivery) {
    console.error('FAIL canConfirmDelivery should be false after confirm');
    process.exit(1);
  }

  console.log('PASS AD-1 buyer confirmation e2e');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
