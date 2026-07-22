import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminSystemService } from './admin-system.service';
import { AdminNotificationsService } from './admin-notifications.service';
import { evaluateThreshold } from './monitoring.rules';
import { PENDING_VERIFICATION_STATUSES } from '../marketplace/verification.rules';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import type { AdminRequestMeta } from '../common/admin/admin-request-meta';

/** Metric collectors — domains (Farms / Delivery / AI) can extend this registry. */
@Injectable()
export class AdminMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly system: AdminSystemService,
    private readonly notifications: AdminNotificationsService,
    private readonly audit: AuditService,
  ) {}

  async getSnapshot() {
    const [health, metrics, thresholds] = await Promise.all([
      this.system.getHealth(),
      this.collectMetrics(),
      this.prisma.alertThreshold.findMany({ orderBy: { code: 'asc' } }),
    ]);

    const alerts = thresholds.map((t) => {
      const value = metrics[t.metricKey] ?? 0;
      const level = t.enabled
        ? evaluateThreshold(
            value,
            t.warnAbove != null ? Number(t.warnAbove) : null,
            t.criticalAbove != null ? Number(t.criticalAbove) : null,
          )
        : 'OK';
      return {
        id: t.id,
        code: t.code,
        displayName: t.displayName,
        description: t.description,
        metricKey: t.metricKey,
        value,
        warnAbove: t.warnAbove != null ? Number(t.warnAbove) : null,
        criticalAbove:
          t.criticalAbove != null ? Number(t.criticalAbove) : null,
        enabled: t.enabled,
        level,
      };
    });

    const breachCount = alerts.filter(
      (a) => a.level === 'WARN' || a.level === 'CRITICAL',
    ).length;
    const criticalCount = alerts.filter((a) => a.level === 'CRITICAL').length;

    return {
      asOf: new Date().toISOString(),
      health,
      metrics,
      alerts,
      summary: {
        breachCount,
        criticalCount,
        okCount: alerts.filter((a) => a.level === 'OK').length,
      },
      extensibility:
        'Register additional metric_key collectors for Farms, Delivery, and AI services.',
    };
  }

  async emitAlertNotices(
    admin: AdminRequestUser,
    meta: AdminRequestMeta = {},
  ) {
    const snapshot = await this.getSnapshot();
    let emitted = 0;
    for (const alert of snapshot.alerts) {
      if (alert.level === 'OK' || !alert.enabled) continue;
      const before = await this.prisma.adminNotification.findFirst({
        where: { dedupeKey: `alert:${alert.code}:${alert.level}` },
      });
      await this.notifications.ensureOperationalNotice({
        title: `${alert.level}: ${alert.displayName}`,
        body: `${alert.displayName} is ${alert.value} (threshold ${
          alert.level === 'CRITICAL' ? alert.criticalAbove : alert.warnAbove
        }).`,
        severity: alert.level === 'CRITICAL' ? 'CRITICAL' : 'WARN',
        linkPath: '/monitoring',
        sourceModule: 'monitoring',
        dedupeKey: `alert:${alert.code}:${alert.level}`,
      });
      if (!before) emitted += 1;
    }

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: 'monitoring.read',
      action: 'monitoring.alerts.emit_notices',
      targetType: 'alert_thresholds',
      outcome: 'SUCCESS',
      afterJson: {
        breachCount: snapshot.summary.breachCount,
        emitted,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return { ...snapshot, emitted };
  }

  async collectMetrics(): Promise<Record<string, number>> {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const escrowCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const [
      auditDenied7d,
      stalledEscrow,
      deliveryExceptions,
      verificationPending,
    ] = await Promise.all([
      this.prisma.auditEvent.count({
        where: { outcome: 'DENIED', occurredAt: { gte: since7d } },
      }),
      this.prisma.order.count({
        where: { status: 'PAID_ESCROW', paidAt: { lte: escrowCutoff } },
      }),
      this.prisma.fulfillmentCase.count({ where: { status: 'EXCEPTION' } }),
      this.prisma.verificationCase.count({
        where: { status: { in: [...PENDING_VERIFICATION_STATUSES] } },
      }),
    ]);

    return {
      'audit.denied_7d': auditDenied7d,
      'orders.stalled_escrow': stalledEscrow,
      'delivery.exceptions': deliveryExceptions,
      'verification.pending': verificationPending,
    };
  }
}
