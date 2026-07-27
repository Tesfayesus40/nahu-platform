/**
 * @deprecated Use uat-data-reset.cjs / `pnpm db:reset -- --confirm=UAT_RESET`.
 *
 * This script deletes ALL users (including admins) and does not clear delivery,
 * farms, inventory, or location tables. Kept only for reference.
 *
 * Prefer: docs/08-guides/uat-database-reset.md
 */
import { PrismaClient } from '@prisma/client';

console.error(
  'DEPRECATED: use `pnpm db:reset -- --confirm=UAT_RESET` (see docs/08-guides/uat-database-reset.md)',
);
process.exit(1);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
    },
  },
});
