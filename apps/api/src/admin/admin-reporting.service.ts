import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { ACTIONABLE_MODERATION_STATUSES } from '../marketplace/listing-moderation.rules';
import {
  isKnownReportType,
  REPORT_TYPES,
  reportTypeLabel,
  toCsv,
  type ReportType,
} from './reporting.rules';

type RequestMeta = { ip?: string; userAgent?: string; requestId?: string };

const EXPORT_ROW_CAP = 2000;

@Injectable()
export class AdminReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  catalog() {
    return {
      types: REPORT_TYPES.map((type) => ({
        type,
        label: reportTypeLabel(type),
        description: this.descriptionFor(type),
      })),
      rowCap: EXPORT_ROW_CAP,
      note: 'Exporters are domain-registered; Farms / Delivery / AI can add types without a warehouse.',
    };
  }

  async listJobs(params: { page?: number; limit?: number; reportType?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const where: Prisma.ReportJobWhereInput = {};
    if (params.reportType) where.reportType = params.reportType;

    const [total, items] = await Promise.all([
      this.prisma.reportJob.count({ where }),
      this.prisma.reportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          reportType: true,
          status: true,
          filtersJson: true,
          requestedByUserId: true,
          rowCount: true,
          errorMessage: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: items.map((j) => ({
        ...j,
        label: reportTypeLabel(j.reportType),
      })),
    };
  }

  async getJob(id: string, includeArtifact = false) {
    const job = await this.prisma.reportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Report job not found');
    return {
      id: job.id,
      reportType: job.reportType,
      label: reportTypeLabel(job.reportType),
      status: job.status,
      filtersJson: job.filtersJson,
      requestedByUserId: job.requestedByUserId,
      rowCount: job.rowCount,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      artifactCsv: includeArtifact ? job.artifactCsv : undefined,
    };
  }

  async runExport(
    admin: AdminRequestUser,
    dto: { reportType: string; filters?: Record<string, unknown> },
    meta: RequestMeta = {},
  ) {
    if (!isKnownReportType(dto.reportType)) {
      throw new BadRequestException(`Unknown report type: ${dto.reportType}`);
    }
    const reportType = dto.reportType;
    const filters = dto.filters ?? {};

    const job = await this.prisma.reportJob.create({
      data: {
        reportType,
        status: 'RUNNING',
        filtersJson: filters as Prisma.InputJsonValue,
        requestedByUserId: admin.userId,
        startedAt: new Date(),
      },
    });

    try {
      const { csv, rowCount } = await this.buildReport(reportType, filters);
      const completed = await this.prisma.reportJob.update({
        where: { id: job.id },
        data: {
          status: 'SUCCEEDED',
          rowCount,
          artifactCsv: csv,
          completedAt: new Date(),
        },
      });

      await this.audit.appendEvent({
        actorUserId: admin.userId,
        actorSessionId: admin.sessionId,
        permissionCode: 'reports.export',
        action: 'reports.export.run',
        targetType: 'report_job',
        targetId: job.id,
        outcome: 'SUCCESS',
        afterJson: { reportType, rowCount, filters },
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });

      return {
        id: completed.id,
        reportType: completed.reportType,
        label: reportTypeLabel(completed.reportType),
        status: completed.status,
        rowCount: completed.rowCount,
        completedAt: completed.completedAt,
        artifactCsv: completed.artifactCsv,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      await this.prisma.reportJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      await this.audit.appendEvent({
        actorUserId: admin.userId,
        actorSessionId: admin.sessionId,
        permissionCode: 'reports.export',
        action: 'reports.export.run',
        targetType: 'report_job',
        targetId: job.id,
        outcome: 'FAILED',
        afterJson: { reportType, error: message },
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
      throw err;
    }
  }

  private descriptionFor(type: ReportType): string {
    switch (type) {
      case 'orders.summary':
        return 'Recent orders with status and totals.';
      case 'delivery.exceptions':
        return 'Fulfillment cases in EXCEPTION status.';
      case 'audit.events':
        return 'Recent audit events (capped).';
      case 'verification.pending':
        return 'Verification cases awaiting review.';
      case 'listings.moderation':
        return 'Listings needing moderation attention.';
      default:
        return '';
    }
  }

  private async buildReport(
    type: ReportType,
    filters: Record<string, unknown>,
  ): Promise<{ csv: string; rowCount: number }> {
    switch (type) {
      case 'orders.summary':
        return this.ordersSummary(filters);
      case 'delivery.exceptions':
        return this.deliveryExceptions();
      case 'audit.events':
        return this.auditEvents(filters);
      case 'verification.pending':
        return this.verificationPending();
      case 'listings.moderation':
        return this.listingsModeration();
      default:
        throw new BadRequestException(`Unsupported report type: ${type}`);
    }
  }

  private async ordersSummary(filters: Record<string, unknown>) {
    const status =
      typeof filters.status === 'string' && filters.status
        ? filters.status
        : undefined;
    const rows = await this.prisma.order.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_ROW_CAP,
      select: {
        id: true,
        status: true,
        totalEtb: true,
        buyerId: true,
        farmerId: true,
        createdAt: true,
        paidAt: true,
      },
    });
    const csv = toCsv(
      ['id', 'status', 'totalEtb', 'buyerId', 'farmerId', 'createdAt', 'paidAt'],
      rows.map((r) => [
        r.id,
        r.status,
        r.totalEtb.toString(),
        r.buyerId,
        r.farmerId,
        r.createdAt.toISOString(),
        r.paidAt?.toISOString() ?? '',
      ]),
    );
    return { csv, rowCount: rows.length };
  }

  private async deliveryExceptions() {
    const rows = await this.prisma.fulfillmentCase.findMany({
      where: { status: 'EXCEPTION' },
      orderBy: { updatedAt: 'desc' },
      take: EXPORT_ROW_CAP,
      select: {
        id: true,
        orderId: true,
        status: true,
        exceptionCode: true,
        exceptionNotes: true,
        carrierCode: true,
        trackingRef: true,
        updatedAt: true,
      },
    });
    const csv = toCsv(
      [
        'id',
        'orderId',
        'status',
        'exceptionCode',
        'exceptionNotes',
        'carrierCode',
        'trackingRef',
        'updatedAt',
      ],
      rows.map((r) => [
        r.id,
        r.orderId,
        r.status,
        r.exceptionCode,
        r.exceptionNotes,
        r.carrierCode,
        r.trackingRef,
        r.updatedAt.toISOString(),
      ]),
    );
    return { csv, rowCount: rows.length };
  }

  private async auditEvents(filters: Record<string, unknown>) {
    const outcome =
      typeof filters.outcome === 'string' && filters.outcome
        ? filters.outcome
        : undefined;
    const rows = await this.prisma.auditEvent.findMany({
      where: outcome ? { outcome } : undefined,
      orderBy: { occurredAt: 'desc' },
      take: EXPORT_ROW_CAP,
      select: {
        id: true,
        occurredAt: true,
        action: true,
        outcome: true,
        actorUserId: true,
        permissionCode: true,
        targetType: true,
        targetId: true,
      },
    });
    const csv = toCsv(
      [
        'id',
        'occurredAt',
        'action',
        'outcome',
        'actorUserId',
        'permissionCode',
        'targetType',
        'targetId',
      ],
      rows.map((r) => [
        r.id,
        r.occurredAt.toISOString(),
        r.action,
        r.outcome,
        r.actorUserId,
        r.permissionCode,
        r.targetType,
        r.targetId,
      ]),
    );
    return { csv, rowCount: rows.length };
  }

  private async verificationPending() {
    const rows = await this.prisma.verificationCase.findMany({
      where: { status: { in: ['PENDING', 'INFO_REQUESTED'] } },
      orderBy: { submittedAt: 'asc' },
      take: EXPORT_ROW_CAP,
      select: {
        id: true,
        subjectType: true,
        subjectId: true,
        status: true,
        displayName: true,
        region: true,
        submittedAt: true,
      },
    });
    const csv = toCsv(
      [
        'id',
        'subjectType',
        'subjectId',
        'status',
        'displayName',
        'region',
        'submittedAt',
      ],
      rows.map((r) => [
        r.id,
        r.subjectType,
        r.subjectId,
        r.status,
        r.displayName,
        r.region,
        r.submittedAt.toISOString(),
      ]),
    );
    return { csv, rowCount: rows.length };
  }

  private async listingsModeration() {
    const rows = await this.prisma.listing.findMany({
      where: {
        moderationStatus: { in: [...ACTIONABLE_MODERATION_STATUSES] },
      },
      orderBy: { updatedAt: 'desc' },
      take: EXPORT_ROW_CAP,
      select: {
        id: true,
        region: true,
        grade: true,
        status: true,
        moderationStatus: true,
        farmerId: true,
        updatedAt: true,
      },
    });
    const csv = toCsv(
      [
        'id',
        'region',
        'grade',
        'status',
        'moderationStatus',
        'farmerId',
        'updatedAt',
      ],
      rows.map((r) => [
        r.id,
        r.region,
        r.grade,
        r.status,
        r.moderationStatus,
        r.farmerId,
        r.updatedAt.toISOString(),
      ]),
    );
    return { csv, rowCount: rows.length };
  }
}
