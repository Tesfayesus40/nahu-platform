import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminSystemService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'nahu-platform-api',
      timestamp: new Date().toISOString(),
      version: this.releaseVersion(),
      nodeEnv: process.env.NODE_ENV ?? 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: { database },
    };
  }

  async getOverview() {
    const health = await this.getHealth();
    const [activeAdminSessions, pendingInvitations, flags, migrationLatest] =
      await Promise.all([
        this.prisma.adminSession.count({
          where: { revokedAt: null, absoluteExpiresAt: { gt: new Date() } },
        }),
        this.prisma.adminInvitation.count({
          where: {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
        this.prisma.featureFlag.findMany({
          orderBy: { code: 'asc' },
        }),
        this.latestMigration(),
      ]);

    return {
      health,
      activeAdminSessions,
      pendingInvitations,
      featureFlags: flags.map((f) => ({
        id: f.id,
        code: f.code,
        displayName: f.displayName,
        description: f.description,
        enabled: f.enabled,
        updatedAt: f.updatedAt,
        updatedByUserId: f.updatedByUserId,
      })),
      migrations: migrationLatest,
    };
  }

  private releaseVersion(): string {
    const sha =
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.GIT_COMMIT_SHA ||
      process.env.COMMIT_SHA;
    if (sha) return sha.slice(0, 12);

    try {
      const pkgPath = join(__dirname, '..', '..', 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        version?: string;
      };
      return pkg.version ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async latestMigration(): Promise<{
    appliedCount: number;
    latestFilename: string | null;
    latestAppliedAt: string | null;
  }> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ filename: string; applied_at: Date; cnt: bigint }>
      >`
        SELECT filename, applied_at,
               (SELECT COUNT(*) FROM public.schema_migrations)::bigint AS cnt
        FROM public.schema_migrations
        ORDER BY applied_at DESC
        LIMIT 1
      `;
      if (!rows.length) {
        return {
          appliedCount: 0,
          latestFilename: null,
          latestAppliedAt: null,
        };
      }
      return {
        appliedCount: Number(rows[0].cnt),
        latestFilename: rows[0].filename,
        latestAppliedAt: rows[0].applied_at.toISOString(),
      };
    } catch {
      return {
        appliedCount: 0,
        latestFilename: null,
        latestAppliedAt: null,
      };
    }
  }
}
