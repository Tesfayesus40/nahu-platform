import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wraps PrismaClient as a Nest-managed provider.
 *
 * Connection failures are logged, not thrown, at startup — this lets the
 * rest of the API (health check, non-DB routes) come up even if Postgres
 * isn't reachable yet. Individual queries will still fail loudly if the DB
 * is down when they run.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL (identity schema)');
    } catch (err) {
      this.logger.error(
        `Could not connect to the database at startup: ${(err as Error).message}`,
      );
      this.logger.warn(
        'API will continue starting. DB-dependent routes will fail until the connection succeeds.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Lightweight liveness check used by the health module. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
