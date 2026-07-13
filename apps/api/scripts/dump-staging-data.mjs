/**
 * Read-only staging DB snapshot.
 *   railway environment staging
 *   railway run --service Postgres-9wYI node scripts/dump-staging-data.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
    },
  },
});

const users = await prisma.user.findMany({
  select: {
    phone: true,
    firstName: true,
    middleName: true,
    lastName: true,
    status: true,
    phoneVerified: true,
    createdAt: true,
    userRoles: { select: { role: { select: { code: true } } } },
  },
  orderBy: { createdAt: 'asc' },
});

const farmerProfiles = await prisma.farmerProfile.findMany({
  include: {
    user: { select: { phone: true, firstName: true, middleName: true } },
  },
  orderBy: { createdAt: 'asc' },
});

const listings = await prisma.listing.findMany({
  include: {
    farmer: { include: { user: { select: { phone: true, firstName: true } } } },
  },
  orderBy: { createdAt: 'desc' },
});

const orders = await prisma.order.findMany({
  include: {
    listing: { select: { region: true, grade: true } },
    buyer: { select: { phone: true } },
  },
  orderBy: { createdAt: 'desc' },
});

const recentOtps = await prisma.otpCode.findMany({
  orderBy: { createdAt: 'desc' },
  take: 15,
  select: { phone: true, used: true, expiresAt: true, createdAt: true },
});

console.log(JSON.stringify({ users, farmerProfiles, listings, orders, recentOtps }, null, 2));
await prisma.$disconnect();
