/**
 * Delete all test users, listings, orders, and OTP codes.
 * Keeps seeded roles, permissions, and schema intact.
 *
 * Staging:
 *   railway environment staging
 *   pnpm --filter @nahu-platform/api db:reset-staging
 *
 * Local (with DATABASE_URL in apps/api/.env):
 *   pnpm --filter @nahu-platform/api db:reset-staging
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const before = {
    users: await prisma.user.count(),
    listings: await prisma.listing.count(),
    orders: await prisma.order.count(),
    otps: await prisma.otpCode.count(),
  };

  console.log('Before:', before);

  await prisma.$transaction(async (tx) => {
    await tx.originCertificate.deleteMany();
    await tx.order.deleteMany();
    await tx.listing.deleteMany();
    await tx.farmerProfile.deleteMany();
    await tx.userRole.deleteMany();
    await tx.credential.deleteMany();
    await tx.userOrganization.deleteMany();
    await tx.otpCode.deleteMany();
    await tx.user.deleteMany();
  });

  const after = {
    users: await prisma.user.count(),
    listings: await prisma.listing.count(),
    orders: await prisma.order.count(),
    otps: await prisma.otpCode.count(),
    roles: await prisma.role.count(),
  };

  console.log('After:', after);
  console.log('Test data cleared. Log out mobile apps and sign in again.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
