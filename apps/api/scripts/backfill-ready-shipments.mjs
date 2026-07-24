#!/usr/bin/env node
/**
 * One-shot: create CREATED outbound shipments for READY fulfillments that lack
 * an active outbound shipment. Uses DATABASE_URL (prefer DATABASE_PUBLIC_URL locally).
 *
 * Usage:
 *   railway run --service Postgres-9wYI --environment staging -- \
 *     node -e "process.env.DATABASE_URL=process.env.DATABASE_PUBLIC_URL; require('child_process').spawnSync('node',['scripts/backfill-ready-shipments.mjs'],{stdio:'inherit',env:process.env})"
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACTIVE = [
  'CREATED',
  'AWAITING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'BUYER_CONFIRMED',
];

function pickupAddress(farmer) {
  const parts = [farmer?.region, farmer?.zone, farmer?.woreda]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(', ') : 'Farmer pickup location';
}

function personName(u) {
  const parts = [u?.firstName, u?.lastName]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

async function main() {
  const ready = await prisma.fulfillmentCase.findMany({
    where: { status: 'READY' },
    include: {
      order: {
        include: {
          buyer: { select: { phone: true, firstName: true, lastName: true } },
          farmer: {
            include: {
              user: { select: { phone: true, firstName: true, lastName: true } },
            },
          },
        },
      },
      shipments: {
        where: {
          deletedAt: null,
          shipmentType: 'OUTBOUND',
          currentStatus: { in: ACTIVE },
        },
        select: { id: true },
      },
    },
  });

  let created = 0;
  let skipped = 0;
  for (const f of ready) {
    if (f.shipments.length) {
      skipped += 1;
      continue;
    }
    const farmerUser = f.order.farmer?.user ?? null;
    await prisma.shipment.create({
      data: {
        fulfillmentId: f.id,
        shipmentType: 'OUTBOUND',
        currentStatus: 'CREATED',
        serviceLevel: 'STANDARD',
        metadataJson: {
          source: 'backfill_ready',
          orderId: f.orderId,
        },
        stops: {
          create: [
            {
              sequence: 1,
              stopType: 'PICKUP',
              status: 'PENDING',
              addressText: pickupAddress(f.order.farmer),
              contactName: personName(farmerUser),
              contactPhone: farmerUser?.phone ?? null,
              instructions: f.pickupNotes,
            },
            {
              sequence: 2,
              stopType: 'DROPOFF',
              status: 'PENDING',
              addressText: f.order.deliveryAddress,
              contactName: personName(f.order.buyer),
              contactPhone: f.order.buyer?.phone ?? null,
              instructions: f.deliveryNotes,
            },
          ],
        },
        events: {
          create: {
            eventType: 'delivery.shipment.created',
            fromStatus: null,
            toStatus: 'CREATED',
            message: 'Backfill: outbound shipment from READY fulfillment',
            payloadJson: { fulfillmentId: f.id, source: 'backfill_ready' },
          },
        },
      },
    });
    created += 1;
    console.log(`created shipment for fulfillment ${f.id}`);
  }
  console.log(JSON.stringify({ ready: ready.length, created, skipped }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
