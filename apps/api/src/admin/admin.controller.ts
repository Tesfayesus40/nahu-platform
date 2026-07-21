import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AdminVerificationService } from '../marketplace/admin-verification.service';
import { AdminListingModerationService } from '../marketplace/admin-listing-moderation.service';
import { AdminDisputesService } from '../orders/admin-disputes.service';

@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verification: AdminVerificationService,
    private readonly listingModeration: AdminListingModerationService,
    private readonly disputes: AdminDisputesService,
  ) {}

  @Get('dashboard/summary')
  @RequirePermissions('admin.dashboard.read')
  async dashboardSummary() {
    const [
      pendingVerifications,
      byType,
      activeListings,
      pendingListingModeration,
      listingsByModeration,
      openDisputes,
      disputesByStatus,
    ] = await Promise.all([
      this.verification.countPending(),
      this.verification.countPendingByType(),
      this.prisma.listing.count({
        where: { status: 'ACTIVE', moderationStatus: 'APPROVED' },
      }),
      this.listingModeration.countActionable(),
      this.listingModeration.countByModerationStatus(),
      this.disputes.countOpen(),
      this.disputes.countByStatus(),
    ]);

    return {
      status: 'ok',
      message: 'Live operational queue counts.',
      asOf: new Date().toISOString(),
      placeholders: {
        pendingVerifications,
        pendingVerificationsByType: byType,
        openDisputes,
        disputesByStatus,
        activeListings,
        pendingListingModeration,
        listingsByModeration,
      },
    };
  }

  @Get('system/health')
  @RequirePermissions('admin.system.health.read')
  async systemHealth() {
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
      dependencies: { database },
    };
  }
}
