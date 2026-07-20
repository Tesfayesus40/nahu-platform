#!/usr/bin/env node
/**
 * Local/staging-only bootstrap for the first workforce admin.
 * Creates user + role + password and a pending invitation.
 * Prints an enroll URL with the raw invitation token (NOT a JWT).
 * Nest exchanges that token for an enrollment JWT via
 * POST /admin/auth/invitations/enrollment-session.
 *
 * Usage (from apps/api):
 *   node scripts/bootstrap-admin.cjs --email a@b.com --phone +2519XXXXXXXX --password '...' --role SUPER_ADMIN
 */
const { createHash, randomBytes } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function main() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production' && process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true') {
    console.error('Refusing bootstrap in production without ALLOW_ADMIN_BOOTSTRAP=true');
    process.exit(1);
  }

  const email = (arg('email') ?? '').trim().toLowerCase();
  const phone = arg('phone');
  const password = arg('password');
  const roleCode = arg('role', 'SUPER_ADMIN');
  const firstName = arg('firstName', 'Bootstrap');
  const lastName = arg('lastName', 'Admin');
  const adminWebOrigin = (
    arg('adminOrigin') ??
    process.env.ADMIN_WEB_ORIGIN ??
    'http://localhost:3001'
  ).replace(/\/$/, '');

  if (!email || !phone || !password) {
    console.error('Required: --email --phone --password [--role SUPER_ADMIN]');
    process.exit(1);
  }
  if (!/^\+251[0-9]{9}$/.test(phone)) {
    console.error('Phone must be Ethiopian format +251XXXXXXXXX');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      throw new Error(`Role ${roleCode} not found — apply A1 permission seed migration first`);
    }

    const passwordHash = await argon2.hash(password);
    const inviteToken = randomBytes(32).toString('hex');

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { OR: [{ email }, { phone }] },
      });
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              email,
              phone,
              firstName,
              lastName,
              status: 'PENDING',
              emailVerified: true,
              phoneVerified: true,
              mfaRequired: true,
            },
          })
        : await tx.user.create({
            data: {
              email,
              phone,
              firstName,
              lastName,
              status: 'PENDING',
              emailVerified: true,
              phoneVerified: true,
              mfaRequired: true,
            },
          });

      await tx.credential.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          passwordHash,
          passwordChangedAt: new Date(),
        },
        update: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });

      const invitation = await tx.adminInvitation.create({
        data: {
          email,
          phone,
          invitedUserId: user.id,
          roleCodes: [roleCode],
          tokenHash: hashToken(inviteToken),
          invitedBy: user.id,
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });

      return { user, invitation };
    });

    // Invitation token only — Nest signs the enrollment JWT at enrollment-session.
    const enrollUrl = `${adminWebOrigin}/enroll-mfa?token=${encodeURIComponent(inviteToken)}`;

    console.log(
      JSON.stringify(
        {
          ok: true,
          userId: result.user.id,
          email: result.user.email,
          phone: result.user.phone,
          role: roleCode,
          enrollUrl,
          note: 'Open enrollUrl out-of-band, complete TOTP, save recovery codes, then login. Do not commit this output. JWT_SECRET is not required for bootstrap.',
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
