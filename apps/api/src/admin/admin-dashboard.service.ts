import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { OPEN_DISPUTE_STATUSES } from '../orders/dispute.rules';
import { ACTIONABLE_MODERATION_STATUSES } from '../marketplace/listing-moderation.rules';
import {
  DASHBOARD_TREND_DAYS,
  disputePressure,
  fillDailySeries,
  sumSeries,
} from './dashboard.rules';

type DayCountRow = { day: Date; count: bigint };

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(admin: AdminRequestUser) {
    const asOf = new Date();
    const since7d = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(asOf.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sinceTrend = new Date(
      asOf.getTime() - DASHBOARD_TREND_DAYS * 24 * 60 * 60 * 1000,
    );

    const canUsers = admin.permissions.includes('identity.users.read');
    const canVerification = admin.permissions.includes('verification.read');
    const canListings = admin.permissions.includes('marketplace.listings.read');
    const canDisputes = admin.permissions.includes('orders.disputes.read');
    const canOrders = admin.permissions.includes('orders.read');
    const canDelivery = admin.permissions.includes('delivery.read');
    const canPromotions = admin.permissions.includes(
      'marketplace.promotions.read',
    );
    const canCoops = admin.permissions.includes(
      'marketplace.cooperatives.read',
    );
    const canAudit = admin.permissions.includes('audit.read');
    const canHealth = admin.permissions.includes('admin.system.health.read');

    const [
      users,
      verification,
      listings,
      disputes,
      marketplace,
      security,
      health,
      trends,
      commerce,
      delivery,
      promotions,
      cooperatives,
    ] = await Promise.all([
      canUsers ? this.userStats(since7d, since30d) : null,
      canVerification ? this.verificationStats() : null,
      canListings ? this.listingStats() : null,
      canDisputes ? this.disputeStats() : null,
      this.marketplaceStats(since7d, since30d),
      canAudit ? this.securityStats(since7d) : null,
      canHealth ? this.healthSnapshot() : null,
      this.trendSeries(sinceTrend, asOf, {
        users: canUsers,
        verification: canVerification,
        disputes: canDisputes,
      }),
      canOrders ? this.commerceStats() : null,
      canDelivery ? this.deliveryStats() : null,
      canPromotions ? this.promotionStats() : null,
      canCoops ? this.cooperativeStats() : null,
    ]);

    const queues = {
      pendingVerifications: verification?.pending ?? null,
      pendingListingModeration: listings?.actionable ?? null,
      openDisputes: disputes?.open ?? null,
      lockedUsers: users?.locked ?? null,
      recentDeniedActions: security?.denied7d ?? null,
      pendingPaymentOrders: commerce?.pendingPayment ?? null,
      stalledEscrowOrders: commerce?.stalledEscrow ?? null,
      openFulfillments: delivery?.open ?? null,
      deliveryExceptions: delivery?.exceptions ?? null,
    };

    const kpis = {
      activeApprovedListings: listings?.byModeration?.APPROVED ?? null,
      activeUsers: users?.byStatus?.ACTIVE ?? null,
      ordersLast7d: marketplace?.ordersCreated7d ?? null,
      disputePressure: disputes ? disputePressure(disputes.byStatus) : null,
      trendOrders14d: sumSeries(trends.ordersCreated),
      activePromotions: promotions?.byStatus?.ACTIVE ?? null,
      verifiedCooperatives: cooperatives?.verified ?? null,
    };

    // Backward-compatible placeholders used by earlier dashboard cards.
    const placeholders = {
      pendingVerifications: verification?.pending ?? null,
      pendingVerificationsByType: verification?.pendingByType ?? null,
      openDisputes: disputes?.open ?? null,
      disputesByStatus: disputes?.byStatus ?? null,
      activeListings: listings?.activeApproved ?? null,
      pendingListingModeration: listings?.actionable ?? null,
      listingsByModeration: listings?.byModeration ?? null,
    };

    return {
      status: 'ok',
      message: 'Live operational analytics from domain tables.',
      asOf: asOf.toISOString(),
      trendDays: DASHBOARD_TREND_DAYS,
      sections: {
        users,
        verification,
        listings,
        disputes,
        marketplace,
        commerce,
        delivery,
        promotions,
        cooperatives,
        security,
        health,
      },
      queues,
      kpis,
      trends,
      placeholders,
    };
  }

  private async userStats(since7d: Date, since30d: Date) {
    const [byStatusRows, total, locked, created7d, created30d, workforce] =
      await Promise.all([
        this.prisma.user.groupBy({
          by: ['status'],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.credential.count({
          where: { lockedUntil: { gt: new Date() } },
        }),
        this.prisma.user.count({
          where: { deletedAt: null, createdAt: { gte: since7d } },
        }),
        this.prisma.user.count({
          where: { deletedAt: null, createdAt: { gte: since30d } },
        }),
        this.prisma.user.count({
          where: {
            deletedAt: null,
            userRoles: {
              some: {
                role: {
                  code: {
                    in: [
                      'SUPER_ADMIN',
                      'PLATFORM_ADMIN',
                      'AUDITOR',
                      'MARKETPLACE_MODERATOR',
                      'SUPPORT_AGENT',
                    ],
                  },
                },
              },
            },
          },
        }),
      ]);

    const byStatus: Record<string, number> = {
      PENDING: 0,
      ACTIVE: 0,
      SUSPENDED: 0,
      LOCKED: 0,
      DEACTIVATED: 0,
    };
    for (const row of byStatusRows) {
      byStatus[row.status] = row._count._all;
    }

    return {
      total,
      byStatus,
      locked,
      workforce,
      created7d,
      created30d,
    };
  }

  private async verificationStats() {
    const pendingStatuses = ['PENDING', 'IN_REVIEW', 'NEEDS_INFO'];
    const [pending, byStatusRows, byTypeRows] = await Promise.all([
      this.prisma.verificationCase.count({
        where: { status: { in: pendingStatuses } },
      }),
      this.prisma.verificationCase.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.verificationCase.groupBy({
        by: ['subjectType'],
        where: { status: { in: pendingStatuses } },
        _count: { _all: true },
      }),
    ]);

    const byStatus: Record<string, number> = {
      PENDING: 0,
      IN_REVIEW: 0,
      NEEDS_INFO: 0,
      APPROVED: 0,
      REJECTED: 0,
      SUSPENDED: 0,
    };
    for (const row of byStatusRows) {
      byStatus[row.status] = row._count._all;
    }

    const pendingByType: Record<string, number> = {
      FARMER: 0,
      BUYER: 0,
      MERCHANT: 0,
      ORGANIZATION: 0,
    };
    for (const row of byTypeRows) {
      pendingByType[row.subjectType] = row._count._all;
    }

    return { pending, byStatus, pendingByType };
  }

  private async listingStats() {
    const [actionable, activeApproved, byModerationRows, byCommercialRows] =
      await Promise.all([
        this.prisma.listing.count({
          where: {
            moderationStatus: { in: [...ACTIONABLE_MODERATION_STATUSES] },
          },
        }),
        this.prisma.listing.count({
          where: { status: 'ACTIVE', moderationStatus: 'APPROVED' },
        }),
        this.prisma.listing.groupBy({
          by: ['moderationStatus'],
          _count: { _all: true },
        }),
        this.prisma.listing.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
      ]);

    const byModeration: Record<string, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      SUSPENDED: 0,
      FLAGGED: 0,
    };
    for (const row of byModerationRows) {
      byModeration[row.moderationStatus] = row._count._all;
    }

    const byCommercial: Record<string, number> = {};
    for (const row of byCommercialRows) {
      byCommercial[row.status] = row._count._all;
    }

    return { actionable, activeApproved, byModeration, byCommercial };
  }

  private async disputeStats() {
    const [open, byStatusRows] = await Promise.all([
      this.prisma.disputeCase.count({
        where: { status: { in: [...OPEN_DISPUTE_STATUSES] } },
      }),
      this.prisma.disputeCase.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const byStatus: Record<string, number> = {
      OPEN: 0,
      UNDER_REVIEW: 0,
      RESOLVED: 0,
      CLOSED: 0,
      ESCALATED: 0,
    };
    for (const row of byStatusRows) {
      byStatus[row.status] = row._count._all;
    }

    return { open, byStatus };
  }

  private async marketplaceStats(since7d: Date, since30d: Date) {
    const [byOrderStatusRows, ordersCreated7d, ordersCreated30d, disputed] =
      await Promise.all([
        this.prisma.order.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.order.count({ where: { createdAt: { gte: since7d } } }),
        this.prisma.order.count({ where: { createdAt: { gte: since30d } } }),
        this.prisma.order.count({ where: { status: 'DISPUTED' } }),
      ]);

    const byOrderStatus: Record<string, number> = {};
    for (const row of byOrderStatusRows) {
      byOrderStatus[row.status] = row._count._all;
    }

    return {
      byOrderStatus,
      ordersCreated7d,
      ordersCreated30d,
      disputedOrders: disputed,
    };
  }

  private async commerceStats() {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const [pendingPayment, stalledEscrow, byStatusRows] = await Promise.all([
      this.prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      this.prisma.order.count({
        where: { status: 'PAID_ESCROW', paidAt: { lte: cutoff } },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);
    const byStatus: Record<string, number> = {};
    for (const row of byStatusRows) byStatus[row.status] = row._count._all;
    return { pendingPayment, stalledEscrow, byStatus };
  }

  private async deliveryStats() {
    const [open, exceptions, byStatusRows] = await Promise.all([
      this.prisma.fulfillmentCase.count({
        where: {
          status: { in: ['PENDING_HANDOFF', 'READY', 'IN_TRANSIT'] },
        },
      }),
      this.prisma.fulfillmentCase.count({ where: { status: 'EXCEPTION' } }),
      this.prisma.fulfillmentCase.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);
    const byStatus: Record<string, number> = {
      PENDING_HANDOFF: 0,
      READY: 0,
      IN_TRANSIT: 0,
      DELIVERED: 0,
      EXCEPTION: 0,
      CLOSED: 0,
    };
    for (const row of byStatusRows) byStatus[row.status] = row._count._all;
    return { open, exceptions, byStatus };
  }

  private async promotionStats() {
    const rows = await this.prisma.promotion.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {
      DRAFT: 0,
      ACTIVE: 0,
      PAUSED: 0,
      ENDED: 0,
    };
    for (const row of rows) byStatus[row.status] = row._count._all;
    return { byStatus };
  }

  private async cooperativeStats() {
    const [total, verified] = await Promise.all([
      this.prisma.cooperative.count(),
      this.prisma.cooperative.count({ where: { verified: true } }),
    ]);
    return { total, verified };
  }

  private async securityStats(since7d: Date) {
    const [denied7d, failed7d, byOutcomeRows] = await Promise.all([
      this.prisma.auditEvent.count({
        where: { outcome: 'DENIED', occurredAt: { gte: since7d } },
      }),
      this.prisma.auditEvent.count({
        where: { outcome: 'FAILED', occurredAt: { gte: since7d } },
      }),
      this.prisma.auditEvent.groupBy({
        by: ['outcome'],
        where: { occurredAt: { gte: since7d } },
        _count: { _all: true },
      }),
    ]);

    const byOutcome7d: Record<string, number> = {
      SUCCESS: 0,
      DENIED: 0,
      FAILED: 0,
    };
    for (const row of byOutcomeRows) {
      byOutcome7d[row.outcome] = row._count._all;
    }

    return { denied7d, failed7d, byOutcome7d };
  }

  private async healthSnapshot() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
    };
  }

  private async trendSeries(
    since: Date,
    asOf: Date,
    opts: { users: boolean; verification: boolean; disputes: boolean },
  ) {
    const ordersRows = await this.prisma.$queryRaw<DayCountRow[]>`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day,
             COUNT(*)::bigint AS count
      FROM orders.orders
      WHERE created_at >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;

    const usersRows = opts.users
      ? await this.prisma.$queryRaw<DayCountRow[]>`
          SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day,
                 COUNT(*)::bigint AS count
          FROM identity.users
          WHERE deleted_at IS NULL AND created_at >= ${since}
          GROUP BY 1
          ORDER BY 1
        `
      : [];

    const disputeRows = opts.disputes
      ? await this.prisma.$queryRaw<DayCountRow[]>`
          SELECT date_trunc('day', opened_at AT TIME ZONE 'UTC') AS day,
                 COUNT(*)::bigint AS count
          FROM orders.dispute_cases
          WHERE opened_at >= ${since}
          GROUP BY 1
          ORDER BY 1
        `
      : [];

    const verificationRows = opts.verification
      ? await this.prisma.$queryRaw<DayCountRow[]>`
          SELECT date_trunc('day', submitted_at AT TIME ZONE 'UTC') AS day,
                 COUNT(*)::bigint AS count
          FROM marketplace.verification_cases
          WHERE submitted_at >= ${since}
          GROUP BY 1
          ORDER BY 1
        `
      : [];

    return {
      ordersCreated: fillDailySeries(ordersRows, DASHBOARD_TREND_DAYS, asOf),
      usersCreated: opts.users
        ? fillDailySeries(usersRows, DASHBOARD_TREND_DAYS, asOf)
        : [],
      disputesOpened: opts.disputes
        ? fillDailySeries(disputeRows, DASHBOARD_TREND_DAYS, asOf)
        : [],
      verificationsSubmitted: opts.verification
        ? fillDailySeries(verificationRows, DASHBOARD_TREND_DAYS, asOf)
        : [],
    };
  }
}
