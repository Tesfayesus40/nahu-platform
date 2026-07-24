#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const byStatus = await p.shipment.groupBy({
  by: ['currentStatus'],
  _count: { _all: true },
});
const withStops = await p.shipment.findMany({
  where: { deletedAt: null },
  select: {
    id: true,
    currentStatus: true,
    fulfillmentId: true,
    courierUserId: true,
    _count: { select: { stops: true } },
  },
  orderBy: { createdAt: 'desc' },
});
console.log(JSON.stringify({ byStatus, withStops }, null, 2));
await p.$disconnect();
