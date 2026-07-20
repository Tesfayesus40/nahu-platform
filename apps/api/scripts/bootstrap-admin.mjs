#!/usr/bin/env node
/**
 * ESM entry that delegates to bootstrap-admin.cjs (CommonJS + Prisma).
 * Prefer: node scripts/bootstrap-admin.cjs ...
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
require(join(scriptDir, 'bootstrap-admin.cjs'));
