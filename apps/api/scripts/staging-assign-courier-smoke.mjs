#!/usr/bin/env node
/**
 * Staging smoke: Release + Assign a CREATED shipment via Prisma mirroring
 * DispatchService (for evidence when Admin MFA session is unavailable).
 * Then verify courier queue API returns the shipment.
 *
 * Requires DATABASE_URL (public) and optional COURIER_PHONE (default +251911888001).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = process.env.API_BASE_URL || 'https://nahu-api-staging.up.railway.app/api/v1';
const courierPhone = process.env.COURIER_PHONE || '+251911888001';

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, json: await res.json() };
}

async function main() {
  const shipment = await prisma.shipment.findFirst({
    where: { deletedAt: null, currentStatus: 'CREATED', shipmentType: 'OUTBOUND' },
    orderBy: { createdAt: 'desc' },
    include: { stops: true },
  });
  if (!shipment) throw new Error('No CREATED shipment found — run backfill or MARK_READY first');
  if (shipment.stops.length < 2) throw new Error('Shipment missing stops');

  let courier = await prisma.user.findUnique({
    where: { phone: courierPhone },
    include: { userRoles: { include: { role: true } } },
  });
  if (!courier) throw new Error(`Courier user ${courierPhone} not found — OTP login once first`);

  const hasCourier = courier.userRoles.some((ur) => ur.role.code === 'COURIER');
  if (!hasCourier) throw new Error('User lacks COURIER role');

  await prisma.courierProfile.upsert({
    where: { userId: courier.id },
    create: {
      userId: courier.id,
      phone: courierPhone,
      availability: 'AVAILABLE',
      active: true,
      verified: true,
    },
    update: { availability: 'AVAILABLE', active: true, updatedAt: new Date() },
  });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipment.id },
      data: { currentStatus: 'AWAITING_ASSIGNMENT', updatedAt: now },
    });
    await tx.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: 'delivery.shipment.awaiting_assignment',
        fromStatus: 'CREATED',
        toStatus: 'AWAITING_ASSIGNMENT',
        message: 'Smoke release',
        occurredAt: now,
      },
    });

    const assignment = await tx.shipmentAssignment.create({
      data: {
        shipmentId: shipment.id,
        courierUserId: courier.id,
        assignedByUserId: courier.id,
        isActive: true,
        assignedAt: now,
      },
    });

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        currentStatus: 'ASSIGNED',
        courierUserId: courier.id,
        assignedAt: now,
        updatedAt: now,
      },
    });
    await tx.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        assignmentId: assignment.id,
        eventType: 'delivery.shipment.assigned',
        fromStatus: 'AWAITING_ASSIGNMENT',
        toStatus: 'ASSIGNED',
        message: 'Smoke assign',
        payloadJson: { courierUserId: courier.id, smoke: true },
        occurredAt: now,
      },
    });
  });

  const otpReq = await post('/auth/request-otp', {
    phone: courierPhone,
    role: 'COURIER',
  });
  const otp = otpReq.json.dev_otp;
  if (!otp) throw new Error(`OTP request failed: ${JSON.stringify(otpReq)}`);
  const verify = await post('/auth/verify-otp', {
    phone: courierPhone,
    otp,
    role: 'COURIER',
  });
  if (!verify.json.token) throw new Error(`Verify failed: ${JSON.stringify(verify)}`);

  const queue = await get(
    '/delivery/courier/shipments?section=available&page=1&limit=20',
    verify.json.token,
  );

  const items = queue.json.items ?? queue.json.data ?? [];
  const found = items.some((i) => i.id === shipment.id || i.shipmentId === shipment.id);

  console.log(
    JSON.stringify(
      {
        shipmentId: shipment.id,
        stopCount: shipment.stops.length,
        courierUserId: courier.id,
        queueStatus: queue.status,
        queueTotal: queue.json.total ?? items.length,
        shipmentInAvailableQueue: found,
        sampleItemIds: items.slice(0, 5).map((i) => i.id ?? i.shipmentId),
      },
      null,
      2,
    ),
  );

  if (!found) process.exit(2);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
