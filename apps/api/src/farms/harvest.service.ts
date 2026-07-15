import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HarvestSessionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from './farms.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  CreateHarvestSessionDto,
  HarvestLineInputDto,
  QueryHarvestSessionsDto,
  UpdateHarvestSessionDto,
} from './dto/harvest.dto';

function toNumber(value: unknown): number {
  return Number(value);
}

function dateOnly(iso: string): Date {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function buildQualityNote(line: {
  qualityNote?: string | null;
  moisturePct?: number | null;
  harvestGradeClass?: string | null;
}): string | undefined {
  const parts: string[] = [];
  if (line.harvestGradeClass) parts.push(`grade=${line.harvestGradeClass}`);
  if (line.moisturePct != null) parts.push(`moisture=${line.moisturePct}%`);
  if (line.qualityNote?.trim()) parts.push(line.qualityNote.trim());
  return parts.length ? parts.join('; ') : undefined;
}

@Injectable()
export class HarvestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farms: FarmsService,
    private readonly inventory: InventoryService,
  ) {}

  async listForFarm(
    userId: string,
    farmId: string,
    query: QueryHarvestSessionsDto = {},
  ) {
    await this.farms.assertFarmAccess(userId, farmId, false);

    const statusFilter =
      query.status && query.status !== 'all'
        ? (query.status as HarvestSessionStatus)
        : undefined;

    const sessions = await this.prisma.harvestSession.findMany({
      where: {
        farmId,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(query.croppingCycleId
          ? { croppingCycleId: query.croppingCycleId }
          : {}),
        ...(query.fromDate || query.toDate
          ? {
              harvestedOn: {
                ...(query.fromDate ? { gte: dateOnly(query.fromDate) } : {}),
                ...(query.toDate ? { lte: dateOnly(query.toDate) } : {}),
              },
            }
          : {}),
      },
      include: this.sessionInclude(),
      orderBy: [{ harvestedOn: 'desc' }, { createdAt: 'desc' }],
    });

    return { data: sessions.map((s) => this.shapeSession(s)) };
  }

  async harvestHistory(userId: string, farmId: string) {
    await this.farms.assertFarmAccess(userId, farmId, false);
    const sessions = await this.prisma.harvestSession.findMany({
      where: { farmId, status: 'POSTED' },
      include: this.sessionInclude(),
      orderBy: [{ harvestedOn: 'desc' }, { postedAt: 'desc' }],
    });
    return { data: sessions.map((s) => this.shapeSession(s)) };
  }

  async create(userId: string, farmId: string, dto: CreateHarvestSessionDto) {
    await this.farms.assertFarmAccess(userId, farmId, true);
    await this.assertPlot(farmId, dto.plotId);
    await this.assertCycle(farmId, dto.croppingCycleId, dto.plotId);

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.harvestSession.create({
        data: {
          farmId,
          plotId: dto.plotId,
          croppingCycleId: dto.croppingCycleId,
          harvestedOn: dateOnly(dto.harvestedOn),
          harvestedAt: dto.harvestedAt ? new Date(dto.harvestedAt) : undefined,
          notes: dto.notes,
          crewCount: dto.crewCount,
          photoUrls: dto.photoUrls ?? [],
          status: 'DRAFT',
        },
      });

      if (dto.lines?.length) {
        let order = 0;
        for (const line of dto.lines) {
          await this.createLineRow(tx, created.id, farmId, dto.croppingCycleId, line, order++);
        }
      }

      return tx.harvestSession.findUniqueOrThrow({
        where: { id: created.id },
        include: this.sessionInclude(),
      });
    });

    return this.shapeSession(session);
  }

  async getOne(userId: string, id: string) {
    const session = await this.requireSession(userId, id, false);
    return this.shapeSession(session);
  }

  async update(userId: string, id: string, dto: UpdateHarvestSessionDto) {
    const session = await this.requireSession(userId, id, true);
    this.assertDraft(session);

    const nextPlotId =
      dto.plotId === undefined ? session.plotId : dto.plotId;
    const nextCycleId =
      dto.croppingCycleId === undefined
        ? session.croppingCycleId
        : dto.croppingCycleId;

    if (dto.plotId !== undefined && dto.plotId) {
      await this.assertPlot(session.farmId, dto.plotId);
    }
    if (dto.croppingCycleId !== undefined && dto.croppingCycleId) {
      await this.assertCycle(session.farmId, dto.croppingCycleId, nextPlotId ?? undefined);
    }

    const updated = await this.prisma.harvestSession.update({
      where: { id },
      data: {
        harvestedOn: dto.harvestedOn
          ? dateOnly(dto.harvestedOn)
          : undefined,
        harvestedAt:
          dto.harvestedAt === undefined
            ? undefined
            : dto.harvestedAt
              ? new Date(dto.harvestedAt)
              : null,
        plotId: dto.plotId === undefined ? undefined : dto.plotId,
        croppingCycleId:
          dto.croppingCycleId === undefined ? undefined : dto.croppingCycleId,
        notes: dto.notes === undefined ? undefined : dto.notes,
        crewCount: dto.crewCount === undefined ? undefined : dto.crewCount,
        photoUrls: dto.photoUrls,
        updatedAt: new Date(),
      },
      include: this.sessionInclude(),
    });

    void nextCycleId;
    return this.shapeSession(updated);
  }

  async deleteSession(userId: string, id: string) {
    const session = await this.requireSession(userId, id, true);
    this.assertDraft(session);
    await this.prisma.harvestSession.delete({ where: { id } });
    return { deleted: true, id };
  }

  async addLine(userId: string, sessionId: string, dto: HarvestLineInputDto) {
    const session = await this.requireSession(userId, sessionId, true);
    this.assertDraft(session);

    const maxSort = session.lines.reduce(
      (m, l) => Math.max(m, l.sortOrder),
      -1,
    );

    await this.prisma.$transaction(async (tx) => {
      await this.createLineRow(
        tx,
        sessionId,
        session.farmId,
        session.croppingCycleId,
        dto,
        dto.sortOrder ?? maxSort + 1,
      );
    });

    return this.getOne(userId, sessionId);
  }

  async updateLine(
    userId: string,
    lineId: string,
    dto: HarvestLineInputDto,
  ) {
    const line = await this.prisma.harvestLine.findUnique({
      where: { id: lineId },
      include: { session: true, product: true },
    });
    if (!line) throw new NotFoundException('Harvest line not found');
    await this.farms.assertFarmAccess(userId, line.session.farmId, true);
    this.assertDraft(line.session);

    const resolved = await this.resolveProduct(dto);

    if (dto.croppingCycleLineId || line.session.croppingCycleId) {
      await this.assertCycleLine(
        line.session.croppingCycleId,
        dto.croppingCycleLineId ?? line.croppingCycleLineId,
        resolved.productId,
      );
    }

    await this.prisma.harvestLine.update({
      where: { id: lineId },
      data: {
        productId: resolved.productId,
        productVarietyId: resolved.varietyId,
        qty: dto.qty,
        unitCode: resolved.unitCode,
        moisturePct: dto.moisturePct,
        harvestGradeClass: dto.harvestGradeClass?.toUpperCase(),
        qualityNote: dto.qualityNote,
        photoUrls: dto.photoUrls ?? line.photoUrls,
        storageSiteId: dto.storageSiteId,
        croppingCycleLineId: dto.croppingCycleLineId,
        sortOrder: dto.sortOrder ?? line.sortOrder,
        updatedAt: new Date(),
      },
    });

    return this.getOne(userId, line.sessionId);
  }

  async deleteLine(userId: string, lineId: string) {
    const line = await this.prisma.harvestLine.findUnique({
      where: { id: lineId },
      include: { session: true },
    });
    if (!line) throw new NotFoundException('Harvest line not found');
    await this.farms.assertFarmAccess(userId, line.session.farmId, true);
    this.assertDraft(line.session);
    await this.prisma.harvestLine.delete({ where: { id: lineId } });
    return this.getOne(userId, line.sessionId);
  }

  async post(userId: string, sessionId: string) {
    const session = await this.requireSession(userId, sessionId, true);
    this.assertDraft(session);

    if (!session.lines.length) {
      throw new BadRequestException('Cannot post a harvest session with no lines');
    }

    const harvestDate = session.harvestedOn.toISOString().slice(0, 10);

    for (const line of session.lines) {
      if (line.stockLotId) {
        throw new BadRequestException('Session already has posted lot links');
      }

      const note = buildQualityNote({
        qualityNote: line.qualityNote,
        moisturePct:
          line.moisturePct == null ? null : toNumber(line.moisturePct),
        harvestGradeClass: line.harvestGradeClass,
      });

      const lot = await this.inventory.receive(userId, {
        farmId: session.farmId,
        plotId: session.plotId ?? undefined,
        productCode: line.product.code,
        varietyCode: line.productVariety?.code,
        qty: toNumber(line.qty),
        unitCode: line.unitCode,
        sourceType: 'HARVEST',
        harvestDate,
        qualityNote: note,
        storageSiteId: line.storageSiteId ?? undefined,
        croppingCycleId: session.croppingCycleId ?? undefined,
        cycleLineId: line.croppingCycleLineId ?? undefined,
      });

      await this.prisma.harvestLine.update({
        where: { id: line.id },
        data: { stockLotId: lot.id, updatedAt: new Date() },
      });
    }

    const posted = await this.prisma.harvestSession.update({
      where: { id: sessionId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        updatedAt: new Date(),
      },
      include: this.sessionInclude(),
    });

    return this.shapeSession(posted);
  }

  private async createLineRow(
    tx: Prisma.TransactionClient,
    sessionId: string,
    farmId: string,
    croppingCycleId: string | null | undefined,
    dto: HarvestLineInputDto,
    sortOrder: number,
  ) {
    const resolved = await this.resolveProduct(dto);
    if (dto.storageSiteId) {
      const site = await this.prisma.storageSite.findUnique({
        where: { id: dto.storageSiteId },
      });
      if (!site) throw new BadRequestException('Storage site not found');
      if (site.siteType === 'ON_FARM' && site.farmId && site.farmId !== farmId) {
        throw new BadRequestException('Storage site does not belong to this farm');
      }
    }
    if (dto.croppingCycleLineId || croppingCycleId) {
      await this.assertCycleLine(
        croppingCycleId,
        dto.croppingCycleLineId,
        resolved.productId,
      );
    }

    return tx.harvestLine.create({
      data: {
        sessionId,
        productId: resolved.productId,
        productVarietyId: resolved.varietyId,
        qty: dto.qty,
        unitCode: resolved.unitCode,
        moisturePct: dto.moisturePct,
        harvestGradeClass: dto.harvestGradeClass?.toUpperCase(),
        qualityNote: dto.qualityNote,
        photoUrls: dto.photoUrls ?? [],
        storageSiteId: dto.storageSiteId,
        croppingCycleLineId: dto.croppingCycleLineId,
        sortOrder,
      },
    });
  }

  private async resolveProduct(dto: HarvestLineInputDto) {
    const product = await this.prisma.product.findFirst({
      where: { code: dto.productCode.toUpperCase(), status: 'ACTIVE' },
    });
    if (!product) throw new BadRequestException('This product is not available yet');

    let varietyId: string | undefined;
    if (dto.varietyCode) {
      const variety = await this.prisma.productVariety.findFirst({
        where: {
          productId: product.id,
          code: dto.varietyCode.toUpperCase(),
          isActive: true,
        },
      });
      if (!variety) throw new BadRequestException('Variety not found for product');
      varietyId = variety.id;
    }

    const unitCode = (dto.unitCode ?? product.defaultUnitCode).toUpperCase();
    const unit = await this.prisma.unit.findUnique({ where: { code: unitCode } });
    if (!unit) throw new BadRequestException('Unit not found');

    return { productId: product.id, varietyId, unitCode };
  }

  private async assertPlot(farmId: string, plotId?: string) {
    if (!plotId) return;
    const plot = await this.prisma.plot.findFirst({
      where: { id: plotId, farmId },
    });
    if (!plot) throw new BadRequestException('Plot not found on this farm');
  }

  private async assertCycle(
    farmId: string,
    cycleId?: string | null,
    plotId?: string | null,
  ) {
    if (!cycleId) return;
    const cycle = await this.prisma.croppingCycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle || cycle.farmId !== farmId) {
      throw new BadRequestException('Cropping cycle not found on this farm');
    }
    if (cycle.plotId && plotId && cycle.plotId !== plotId) {
      throw new BadRequestException('Harvest plot does not match production plan plot');
    }
  }

  private async assertCycleLine(
    cycleId: string | null | undefined,
    lineId: string | null | undefined,
    productId: string,
  ) {
    if (!lineId) return;
    const line = await this.prisma.croppingCycleLine.findUnique({
      where: { id: lineId },
      include: { cycle: true },
    });
    if (!line) throw new BadRequestException('Cropping cycle line not found');
    if (cycleId && line.cycleId !== cycleId) {
      throw new BadRequestException('Cycle line does not belong to session plan');
    }
    if (line.productId !== productId) {
      throw new BadRequestException('Cycle line product does not match harvest line product');
    }
  }

  private assertDraft(session: { status: HarvestSessionStatus }) {
    if (session.status !== 'DRAFT') {
      throw new BadRequestException(
        'Posted harvest sessions cannot be modified or deleted; use inventory adjustments to correct stock',
      );
    }
  }

  private async requireSession(userId: string, id: string, write: boolean) {
    const session = await this.prisma.harvestSession.findUnique({
      where: { id },
      include: this.sessionInclude(),
    });
    if (!session) throw new NotFoundException('Harvest session not found');
    await this.farms.assertFarmAccess(userId, session.farmId, write);
    return session;
  }

  private sessionInclude() {
    return {
      lines: {
        include: {
          product: true,
          productVariety: true,
          unit: true,
          stockLot: true,
        },
        orderBy: { sortOrder: 'asc' as const },
      },
      croppingCycle: true,
      plot: true,
    };
  }

  private shapeSession(session: any) {
    return {
      id: session.id,
      farmId: session.farmId,
      plotId: session.plotId,
      plotName: session.plot?.name ?? null,
      croppingCycleId: session.croppingCycleId,
      croppingCycleName: session.croppingCycle?.name ?? null,
      harvestedOn: session.harvestedOn,
      harvestedAt: session.harvestedAt,
      status: session.status,
      notes: session.notes,
      crewCount: session.crewCount,
      photoUrls: session.photoUrls ?? [],
      postedAt: session.postedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lines: (session.lines ?? []).map((line: any) => ({
        id: line.id,
        productId: line.productId,
        productCode: line.product.code,
        productNameEn: line.product.nameEn,
        productVarietyId: line.productVarietyId,
        varietyCode: line.productVariety?.code ?? null,
        qty: toNumber(line.qty),
        unitCode: line.unitCode,
        moisturePct:
          line.moisturePct == null ? null : toNumber(line.moisturePct),
        harvestGradeClass: line.harvestGradeClass,
        qualityNote: line.qualityNote,
        photoUrls: line.photoUrls ?? [],
        storageSiteId: line.storageSiteId,
        croppingCycleLineId: line.croppingCycleLineId,
        stockLotId: line.stockLotId,
        lotCode: line.stockLot?.lotCode ?? null,
        sortOrder: line.sortOrder,
      })),
    };
  }
}
