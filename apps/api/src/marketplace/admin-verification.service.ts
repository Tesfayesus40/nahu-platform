import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { AdminAuthService } from '../identity/admin/admin-auth.service';
import {
  VERIFICATION_SUBJECT_TYPES,
  VERIFICATION_STATUSES,
  canDecideSubject,
  canReadVerification,
  decidePermissionForSubject,
  isPendingVerificationStatus,
  requiresReason,
  statusAfterDecision,
  type VerificationDecisionCode,
  type VerificationStatus,
  type VerificationSubjectType,
} from './verification.rules';
import { ListVerificationQueryDto } from './dto/list-verification-query.dto';
import { VerificationDecisionDto } from './dto/verification-decision.dto';
import { AddVerificationDocumentDto } from './dto/add-verification-document.dto';
import { AddReviewerNoteDto } from './dto/add-reviewer-note.dto';

type RequestMeta = { ip?: string; userAgent?: string; requestId?: string };

@Injectable()
export class AdminVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  async countPending(): Promise<number> {
    return this.prisma.verificationCase.count({
      where: {
        status: { in: ['PENDING', 'IN_REVIEW', 'NEEDS_INFO'] },
      },
    });
  }

  async countPendingByType(): Promise<Record<string, number>> {
    const rows = await this.prisma.verificationCase.groupBy({
      by: ['subjectType'],
      where: {
        status: { in: ['PENDING', 'IN_REVIEW', 'NEEDS_INFO'] },
      },
      _count: { _all: true },
    });
    const out: Record<string, number> = {
      FARMER: 0,
      BUYER: 0,
      MERCHANT: 0,
      ORGANIZATION: 0,
    };
    for (const row of rows) {
      out[row.subjectType] = row._count._all;
    }
    return out;
  }

  async listCases(admin: AdminRequestUser, query: ListVerificationQueryDto) {
    this.assertCanRead(admin);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Prisma.VerificationCaseWhereInput = {};
    if (query.subjectType) {
      where.subjectType = query.subjectType;
    }
    if (query.status) {
      where.status = query.status;
    } else if (query.queue === 'pending') {
      where.status = { in: ['PENDING', 'IN_REVIEW', 'NEEDS_INFO'] };
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { region: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.verificationCase.count({ where }),
      this.prisma.verificationCase.findMany({
        where,
        orderBy: { submittedAt: query.order === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { documents: true, decisions: true } },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: items.map((c) => ({
        id: c.id,
        subjectType: c.subjectType,
        subjectId: c.subjectId,
        status: c.status,
        displayName: c.displayName,
        region: c.region,
        reviewerUserId: c.reviewerUserId,
        submittedAt: c.submittedAt,
        updatedAt: c.updatedAt,
        decidedAt: c.decidedAt,
        documentCount: c._count.documents,
        decisionCount: c._count.decisions,
        canDecide: canDecideSubject(admin.permissions, c.subjectType),
      })),
    };
  }

  async getCase(admin: AdminRequestUser, caseId: string) {
    this.assertCanRead(admin);
    const c = await this.prisma.verificationCase.findUnique({
      where: { id: caseId },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        decisions: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!c) {
      throw new NotFoundException('Verification case not found');
    }

    const subject = await this.loadSubjectDetail(c.subjectType, c.subjectId);

    return {
      id: c.id,
      subjectType: c.subjectType,
      subjectId: c.subjectId,
      status: c.status,
      displayName: c.displayName,
      region: c.region,
      reviewerUserId: c.reviewerUserId,
      reviewerNotes: c.reviewerNotes,
      infoRequestMessage: c.infoRequestMessage,
      submittedAt: c.submittedAt,
      updatedAt: c.updatedAt,
      decidedAt: c.decidedAt,
      canDecide: canDecideSubject(admin.permissions, c.subjectType),
      subject,
      documents: c.documents.map((d) => ({
        id: d.id,
        label: d.label,
        fileUrl: d.fileUrl,
        contentType: d.contentType,
        uploadedByUserId: d.uploadedByUserId,
        createdAt: d.createdAt,
      })),
      decisions: c.decisions.map((d) => ({
        id: d.id,
        decision: d.decision,
        fromStatus: d.fromStatus,
        toStatus: d.toStatus,
        reason: d.reason,
        notes: d.notes,
        actorUserId: d.actorUserId,
        createdAt: d.createdAt,
      })),
    };
  }

  async decide(
    admin: AdminRequestUser,
    caseId: string,
    dto: VerificationDecisionDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);

    const existing = await this.prisma.verificationCase.findUnique({
      where: { id: caseId },
    });
    if (!existing) {
      throw new NotFoundException('Verification case not found');
    }

    if (!canDecideSubject(admin.permissions, existing.subjectType)) {
      throw new ForbiddenException(
        `Missing ${decidePermissionForSubject(existing.subjectType)}`,
      );
    }

    const decision = dto.decision as VerificationDecisionCode;
    if (requiresReason(decision) && !dto.reason?.trim()) {
      throw new BadRequestException('reason is required for this decision');
    }

    const fromStatus = existing.status as VerificationStatus;
    const toStatus = statusAfterDecision(decision, fromStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      const caseRow = await tx.verificationCase.update({
        where: { id: caseId },
        data: {
          status: toStatus,
          reviewerUserId: admin.userId,
          reviewerNotes: dto.notes?.trim() || existing.reviewerNotes,
          infoRequestMessage:
            decision === 'REQUEST_INFO'
              ? dto.reason?.trim() ?? null
              : existing.infoRequestMessage,
          decidedAt:
            toStatus === 'APPROVED' ||
            toStatus === 'REJECTED' ||
            toStatus === 'SUSPENDED'
              ? new Date()
              : existing.decidedAt,
          updatedAt: new Date(),
        },
      });

      await tx.verificationDecision.create({
        data: {
          caseId,
          decision,
          fromStatus,
          toStatus,
          reason: dto.reason?.trim() ?? null,
          notes: dto.notes?.trim() ?? null,
          actorUserId: admin.userId,
        },
      });

      await this.syncSubjectState(
        tx,
        existing.subjectType as VerificationSubjectType,
        existing.subjectId,
        toStatus,
        dto.notes?.trim() || dto.reason?.trim() || null,
      );

      return caseRow;
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: decidePermissionForSubject(existing.subjectType),
      action: `verification.${existing.subjectType.toLowerCase()}.decision`,
      targetType: 'verification_case',
      targetId: caseId,
      reason: dto.reason ?? null,
      outcome: 'SUCCESS',
      beforeJson: { status: fromStatus },
      afterJson: { status: toStatus, decision },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.getCase(admin, updated.id);
  }

  async addNote(
    admin: AdminRequestUser,
    caseId: string,
    dto: AddReviewerNoteDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    const existing = await this.prisma.verificationCase.findUnique({
      where: { id: caseId },
    });
    if (!existing) {
      throw new NotFoundException('Verification case not found');
    }
    if (!canDecideSubject(admin.permissions, existing.subjectType)) {
      throw new ForbiddenException(
        `Missing ${decidePermissionForSubject(existing.subjectType)}`,
      );
    }

    const notes = dto.notes.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.verificationCase.update({
        where: { id: caseId },
        data: {
          reviewerNotes: notes,
          reviewerUserId: admin.userId,
          updatedAt: new Date(),
        },
      });
      await tx.verificationDecision.create({
        data: {
          caseId,
          decision: 'NOTE',
          fromStatus: existing.status,
          toStatus: existing.status,
          notes,
          actorUserId: admin.userId,
        },
      });
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: decidePermissionForSubject(existing.subjectType),
      action: `verification.${existing.subjectType.toLowerCase()}.note`,
      targetType: 'verification_case',
      targetId: caseId,
      outcome: 'SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.getCase(admin, caseId);
  }

  async addDocument(
    admin: AdminRequestUser,
    caseId: string,
    dto: AddVerificationDocumentDto,
    meta: RequestMeta = {},
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    this.assertCanRead(admin);
    const existing = await this.prisma.verificationCase.findUnique({
      where: { id: caseId },
    });
    if (!existing) {
      throw new NotFoundException('Verification case not found');
    }
    if (!canDecideSubject(admin.permissions, existing.subjectType)) {
      throw new ForbiddenException(
        `Missing ${decidePermissionForSubject(existing.subjectType)}`,
      );
    }

    const doc = await this.prisma.verificationDocument.create({
      data: {
        caseId,
        label: dto.label.trim(),
        fileUrl: dto.fileUrl.trim(),
        contentType: dto.contentType?.trim() ?? null,
        uploadedByUserId: admin.userId,
      },
    });

    await this.audit.appendEvent({
      actorUserId: admin.userId,
      actorSessionId: admin.sessionId,
      permissionCode: decidePermissionForSubject(existing.subjectType),
      action: `verification.${existing.subjectType.toLowerCase()}.document.add`,
      targetType: 'verification_document',
      targetId: doc.id,
      outcome: 'SUCCESS',
      afterJson: { caseId, label: doc.label },
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.getCase(admin, caseId);
  }

  private assertCanRead(admin: AdminRequestUser) {
    if (!canReadVerification(admin.permissions)) {
      throw new ForbiddenException('Missing verification.read');
    }
  }

  private async syncSubjectState(
    tx: Prisma.TransactionClient,
    subjectType: VerificationSubjectType,
    subjectId: string,
    status: VerificationStatus,
    notes: string | null,
  ) {
    const verified = status === 'APPROVED';
    if (subjectType === 'FARMER') {
      await tx.farmerProfile.update({
        where: { id: subjectId },
        data: {
          verified,
          verificationStatus: status,
          verificationNotes: notes?.slice(0, 500) ?? undefined,
          updatedAt: new Date(),
        },
      });
      return;
    }
    if (subjectType === 'MERCHANT') {
      await tx.cooperative.update({
        where: { id: subjectId },
        data: {
          verified,
          verificationStatus: status,
          verificationNotes: notes?.slice(0, 500) ?? undefined,
          updatedAt: new Date(),
        },
      });
      return;
    }
    if (subjectType === 'ORGANIZATION') {
      await tx.organization.update({
        where: { id: subjectId },
        data: {
          isActive: status !== 'SUSPENDED' && status !== 'REJECTED',
          updatedAt: new Date(),
        },
      });
    }
    // BUYER: case row is source of truth until a dedicated buyer profile exists.
  }

  private async loadSubjectDetail(subjectType: string, subjectId: string) {
    if (subjectType === 'FARMER') {
      const fp = await this.prisma.farmerProfile.findUnique({
        where: { id: subjectId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          cooperative: {
            select: { id: true, name: true, verified: true },
          },
        },
      });
      return fp
        ? {
            kind: 'FARMER',
            profile: {
              id: fp.id,
              region: fp.region,
              zone: fp.zone,
              woreda: fp.woreda,
              verified: fp.verified,
              verificationStatus: fp.verificationStatus,
              verificationNotes: fp.verificationNotes,
              user: fp.user,
              cooperative: fp.cooperative,
            },
          }
        : { kind: 'FARMER', missing: true };
    }

    if (subjectType === 'MERCHANT') {
      const coop = await this.prisma.cooperative.findUnique({
        where: { id: subjectId },
      });
      return coop
        ? {
            kind: 'MERCHANT',
            cooperative: {
              id: coop.id,
              name: coop.name,
              unionName: coop.unionName,
              region: coop.region,
              zone: coop.zone,
              licenseNumber: coop.licenseNumber,
              verified: coop.verified,
              verificationStatus: coop.verificationStatus,
              verificationNotes: coop.verificationNotes,
            },
          }
        : { kind: 'MERCHANT', missing: true };
    }

    if (subjectType === 'BUYER') {
      const user = await this.prisma.user.findUnique({
        where: { id: subjectId },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          status: true,
          phoneVerified: true,
          emailVerified: true,
          createdAt: true,
        },
      });
      return user
        ? { kind: 'BUYER', user }
        : { kind: 'BUYER', missing: true };
    }

    if (subjectType === 'ORGANIZATION') {
      const org = await this.prisma.organization.findUnique({
        where: { id: subjectId },
        include: {
          userOrganizations: {
            take: 10,
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });
      return org
        ? {
            kind: 'ORGANIZATION',
            organization: {
              id: org.id,
              code: org.code,
              name: org.name,
              description: org.description,
              isActive: org.isActive,
              members: org.userOrganizations.map((m) => ({
                positionTitle: m.positionTitle,
                isPrimary: m.isPrimary,
                user: m.user,
              })),
            },
          }
        : { kind: 'ORGANIZATION', missing: true };
    }

    return { kind: subjectType, missing: true };
  }
}

/** Exported for unit tests / validation of query enums. */
export const VERIFICATION_QUERY_SUBJECTS = VERIFICATION_SUBJECT_TYPES;
export const VERIFICATION_QUERY_STATUSES = VERIFICATION_STATUSES;
