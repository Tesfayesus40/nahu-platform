import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CroppingCycleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from './farms.service';
import {
  CreateCroppingCycleDto,
  CreateCycleLineDto,
  QueryCroppingCyclesDto,
  UpdateCroppingCycleDto,
  UpdateCycleLineDto,
} from './dto/cropping-cycle.dto';

function toNumber(value: unknown): number {
  return Number(value);
}

const EDITABLE_STATUSES: CroppingCycleStatus[] = ['DRAFT', 'PLANNED', 'IN_PROGRESS'];
const TIER_A_STATUSES: CroppingCycleStatus[] = [
  'PLANNED',
  'IN_PROGRESS',
  'HARVESTED',
  'COMPLETED',
];
const TIER_B_EXCLUDED: CroppingCycleStatus[] = ['DRAFT', 'CANCELLED', 'ARCHIVED'];

@Injectable()
export class CroppingCyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farms: FarmsService,
  ) {}

  async listSeasonCodes() {
    const rows = await this.prisma.seasonCode.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    return {
      data: rows.map((r) => ({
        code: r.code,
        name: r.name,
        nameAm: r.nameAm,
        regionHint: r.regionHint,
        sortOrder: r.sortOrder,
      })),
    };
  }

  async listForFarm(userId: string, farmId: string, query: QueryCroppingCyclesDto = {}) {
    await this.farms.assertFarmAccess(userId, farmId, false);

    const statusFilter =
      query.status && query.status.toLowerCase() !== 'all'
        ? (query.status.toUpperCase() as CroppingCycleStatus)
        : undefined;

    const cycles = await this.prisma.croppingCycle.findMany({
      where: {
        farmId,
        ...(query.seasonYear ? { seasonYear: query.seasonYear } : {}),
        ...(query.seasonCode ? { seasonCode: query.seasonCode.toUpperCase() } : {}),
        ...(statusFilter ? { status: statusFilter } : { status: { not: 'ARCHIVED' } }),
      },
      include: {
        lines: { include: { product: true, unit: true }, orderBy: { sortOrder: 'asc' } },
        season: true,
      },
      orderBy: [{ seasonYear: 'desc' }, { startsOn: 'desc' }],
    });

    return { data: cycles.map((c) => this.shapeCycle(c)) };
  }

  async create(userId: string, farmId: string, dto: CreateCroppingCycleDto) {
    await this.farms.assertFarmAccess(userId, farmId, true);
    await this.assertSeasonCode(dto.seasonCode);
    await this.assertScope(farmId, dto.plotId, dto.fieldId, dto.productionUnitId);
    this.assertWindow(dto.startsOn, dto.endsOn);

    const initialStatus = dto.status ?? 'DRAFT';
    if (initialStatus !== 'DRAFT' && initialStatus !== 'PLANNED') {
      throw new BadRequestException('Create status must be DRAFT or PLANNED');
    }

    const lineSpecs = dto.lines?.length
      ? await this.resolveLineSpecs(dto.lines)
      : [];

    const created = await this.prisma.$transaction(async (tx) => {
      const cycle = await tx.croppingCycle.create({
        data: {
          farmId,
          plotId: dto.plotId,
          fieldId: dto.fieldId,
          productionUnitId: dto.productionUnitId,
          code: dto.code,
          name: dto.name,
          nameAm: dto.nameAm,
          seasonYear: dto.seasonYear,
          seasonCode: dto.seasonCode.toUpperCase(),
          startsOn: new Date(dto.startsOn),
          endsOn: new Date(dto.endsOn),
          status: initialStatus,
          notes: dto.notes,
          lines: lineSpecs.length
            ? {
                create: lineSpecs.map((l, i) => ({
                  productId: l.productId,
                  productVarietyId: l.productVarietyId,
                  plannedQty: l.plannedQty,
                  unitCode: l.unitCode,
                  plannedAreaHa: l.plannedAreaHa,
                  sortOrder: i,
                  notes: l.notes,
                })),
              }
            : undefined,
        },
        include: {
          lines: { include: { product: true, unit: true }, orderBy: { sortOrder: 'asc' } },
          season: true,
        },
      });

      await tx.farmAuditLog.create({
        data: {
          entityType: 'CROPPING_CYCLE',
          entityId: cycle.id,
          farmId,
          action: 'CREATE',
          actorUserId: userId,
          afterJson: this.shapeCycle(cycle) as unknown as Prisma.InputJsonValue,
        },
      });

      return cycle;
    });

    return this.shapeCycle(created);
  }

  async getOne(userId: string, id: string) {
    const cycle = await this.requireCycle(userId, id, false);
    return this.shapeCycle(cycle);
  }

  async update(userId: string, id: string, dto: UpdateCroppingCycleDto) {
    const cycle = await this.requireCycle(userId, id, true);
    if (!EDITABLE_STATUSES.includes(cycle.status)) {
      throw new BadRequestException(`Cannot edit cycle in status ${cycle.status}`);
    }

    if (dto.seasonCode) await this.assertSeasonCode(dto.seasonCode);
    if (dto.plotId !== undefined || dto.fieldId !== undefined || dto.productionUnitId !== undefined) {
      await this.assertScope(
        cycle.farmId,
        dto.plotId === undefined ? cycle.plotId ?? undefined : dto.plotId ?? undefined,
        dto.fieldId === undefined ? cycle.fieldId ?? undefined : dto.fieldId ?? undefined,
        dto.productionUnitId === undefined
          ? cycle.productionUnitId ?? undefined
          : dto.productionUnitId ?? undefined,
      );
    }

    const startsOn = dto.startsOn ?? cycle.startsOn.toISOString().slice(0, 10);
    const endsOn = dto.endsOn ?? cycle.endsOn.toISOString().slice(0, 10);
    this.assertWindow(startsOn, endsOn);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.croppingCycle.update({
        where: { id },
        data: {
          name: dto.name,
          nameAm: dto.nameAm,
          code: dto.code,
          seasonYear: dto.seasonYear,
          seasonCode: dto.seasonCode?.toUpperCase(),
          startsOn: dto.startsOn ? new Date(dto.startsOn) : undefined,
          endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined,
          plotId: dto.plotId === undefined ? undefined : dto.plotId,
          fieldId: dto.fieldId === undefined ? undefined : dto.fieldId,
          productionUnitId:
            dto.productionUnitId === undefined ? undefined : dto.productionUnitId,
          notes: dto.notes,
          updatedAt: new Date(),
        },
        include: {
          lines: { include: { product: true, unit: true }, orderBy: { sortOrder: 'asc' } },
          season: true,
        },
      });

      await tx.farmAuditLog.create({
        data: {
          entityType: 'CROPPING_CYCLE',
          entityId: id,
          farmId: cycle.farmId,
          action: 'UPDATE',
          actorUserId: userId,
          beforeJson: this.shapeCycle(cycle) as unknown as Prisma.InputJsonValue,
          afterJson: this.shapeCycle(next) as unknown as Prisma.InputJsonValue,
        },
      });

      return next;
    });

    return this.shapeCycle(updated);
  }

  async transition(
    userId: string,
    id: string,
    action: 'plan' | 'start' | 'mark-harvested' | 'complete' | 'cancel' | 'archive',
  ) {
    const cycle = await this.requireCycle(userId, id, true);
    const nextStatus = this.nextStatus(cycle.status, action);
    if (!nextStatus) {
      throw new BadRequestException(
        `Cannot ${action} cycle from status ${cycle.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.croppingCycle.update({
        where: { id },
        data: { status: nextStatus, updatedAt: new Date() },
        include: {
          lines: { include: { product: true, unit: true }, orderBy: { sortOrder: 'asc' } },
          season: true,
        },
      });

      await tx.farmAuditLog.create({
        data: {
          entityType: 'CROPPING_CYCLE',
          entityId: id,
          farmId: cycle.farmId,
          action: 'STATUS_CHANGE',
          actorUserId: userId,
          beforeJson: { status: cycle.status },
          afterJson: { status: nextStatus },
        },
      });

      return next;
    });

    return this.shapeCycle(updated);
  }

  async addLine(userId: string, cycleId: string, dto: CreateCycleLineDto) {
    const cycle = await this.requireCycle(userId, cycleId, true);
    if (!EDITABLE_STATUSES.includes(cycle.status)) {
      throw new BadRequestException(`Cannot add lines in status ${cycle.status}`);
    }
    const [spec] = await this.resolveLineSpecs([dto]);

    try {
      const line = await this.prisma.croppingCycleLine.create({
        data: {
          cycleId,
          productId: spec.productId,
          productVarietyId: spec.productVarietyId,
          plannedQty: spec.plannedQty,
          unitCode: spec.unitCode,
          plannedAreaHa: spec.plannedAreaHa,
          sortOrder: cycle.lines.length,
          notes: spec.notes,
        },
        include: { product: true, unit: true },
      });
      return this.shapeLine(line);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Product already planned on this cycle');
      }
      throw err;
    }
  }

  async updateLine(userId: string, lineId: string, dto: UpdateCycleLineDto) {
    const line = await this.prisma.croppingCycleLine.findUnique({
      where: { id: lineId },
      include: {
        cycle: true,
        product: true,
        unit: true,
      },
    });
    if (!line) throw new NotFoundException('Cycle line not found');
    await this.farms.assertFarmAccess(userId, line.cycle.farmId, true);
    if (!EDITABLE_STATUSES.includes(line.cycle.status)) {
      throw new BadRequestException(
        `Cannot edit lines in status ${line.cycle.status}`,
      );
    }

    let unitCode = dto.unitCode?.toUpperCase() ?? line.unitCode;
    let plannedQty = dto.plannedQty ?? toNumber(line.plannedQty);
    if (dto.unitCode || dto.plannedQty !== undefined) {
      // keep qty in the stored unit; if unit changes without conversion path, reject via product default dimension check lightly
      unitCode = unitCode.toUpperCase();
      const unit = await this.prisma.unit.findUnique({ where: { code: unitCode } });
      if (!unit) throw new BadRequestException('Unit not found');
    }

    const updated = await this.prisma.croppingCycleLine.update({
      where: { id: lineId },
      data: {
        plannedQty,
        unitCode,
        plannedAreaHa: dto.plannedAreaHa,
        notes: dto.notes,
        updatedAt: new Date(),
      },
      include: { product: true, unit: true },
    });
    return this.shapeLine(updated);
  }

  async deleteLine(userId: string, lineId: string) {
    const line = await this.prisma.croppingCycleLine.findUnique({
      where: { id: lineId },
      include: { cycle: true },
    });
    if (!line) throw new NotFoundException('Cycle line not found');
    await this.farms.assertFarmAccess(userId, line.cycle.farmId, true);
    if (!EDITABLE_STATUSES.includes(line.cycle.status)) {
      throw new BadRequestException(
        `Cannot delete lines in status ${line.cycle.status}`,
      );
    }

    const boundLots = await this.prisma.stockLot.count({
      where: { croppingCycleLineId: lineId },
    });
    if (boundLots > 0) {
      throw new BadRequestException(
        'Cannot delete line with explicit harvest lots bound; archive the cycle instead',
      );
    }

    await this.prisma.croppingCycleLine.delete({ where: { id: lineId } });
    return { ok: true };
  }

  async performance(userId: string, id: string) {
    const cycle = await this.requireCycle(userId, id, false);
    const lines = [];

    for (const line of cycle.lines) {
      const events = await this.collectHarvestEvents(cycle, line);
      const actualQty = events.reduce((s, e) => s + e.qty, 0);
      const plannedQty = toNumber(line.plannedQty);
      const explicitLots = events.filter((e) => e.attribution === 'EXPLICIT').length;
      const inferredLots = events.filter((e) => e.attribution === 'INFERRED').length;
      const ambiguousLots = events.filter((e) => e.attribution === 'AMBIGUOUS').length;
      let confidence: 'EXPLICIT' | 'INFERRED' | 'AMBIGUOUS' | 'NONE' = 'NONE';
      if (ambiguousLots > 0) confidence = 'AMBIGUOUS';
      else if (explicitLots > 0 && inferredLots === 0) confidence = 'EXPLICIT';
      else if (inferredLots > 0 || explicitLots > 0) confidence = 'INFERRED';

      lines.push({
        lineId: line.id,
        productId: line.productId,
        productCode: line.product.code,
        productNameEn: line.product.nameEn,
        plannedQty,
        unitCode: line.unitCode,
        actualQty,
        varianceQty: actualQty - plannedQty,
        attainmentPct: plannedQty > 0 ? Math.round((actualQty / plannedQty) * 1000) / 10 : null,
        harvestEventCount: events.length,
        harvestEvents: events,
        attribution: { explicitLots, inferredLots, confidence },
      });
    }

    return {
      cycleId: cycle.id,
      farmId: cycle.farmId,
      seasonYear: cycle.seasonYear,
      seasonCode: cycle.seasonCode,
      status: cycle.status,
      startsOn: cycle.startsOn,
      endsOn: cycle.endsOn,
      lines,
    };
  }

  async productionHistory(userId: string, farmId: string) {
    await this.farms.assertFarmAccess(userId, farmId, false);
    const cycles = await this.prisma.croppingCycle.findMany({
      where: { farmId, status: { not: 'CANCELLED' } },
      include: {
        lines: { include: { product: true, unit: true } },
      },
      orderBy: [{ seasonYear: 'desc' }, { startsOn: 'desc' }],
    });

    const years = new Map<number, { seasonYear: number; cycles: unknown[] }>();

    for (const cycle of cycles) {
      const shaped = this.shapeCycle(cycle);
      const bucket = years.get(cycle.seasonYear) ?? {
        seasonYear: cycle.seasonYear,
        cycles: [] as unknown[],
      };
      bucket.cycles.push(shaped);
      years.set(cycle.seasonYear, bucket);
    }

    return { data: [...years.values()] };
  }

  /** Used by Inventory receive to validate optional cycle binds and auto-start. */
  async assertReceiveBind(input: {
    userId: string;
    farmId: string;
    plotId?: string;
    productId: string;
    productVarietyId?: string;
    croppingCycleId?: string;
    cycleLineId?: string;
  }): Promise<{ croppingCycleId?: string; croppingCycleLineId?: string }> {
    if (!input.croppingCycleId && !input.cycleLineId) return {};

    let cycleId = input.croppingCycleId;
    let lineId = input.cycleLineId;

    if (lineId && !cycleId) {
      const line = await this.prisma.croppingCycleLine.findUnique({
        where: { id: lineId },
      });
      if (!line) throw new BadRequestException('Cycle line not found');
      cycleId = line.cycleId;
    }

    const cycle = await this.prisma.croppingCycle.findUnique({
      where: { id: cycleId },
      include: { lines: true },
    });
    if (!cycle) throw new BadRequestException('Cropping cycle not found');
    await this.farms.assertFarmAccess(input.userId, cycle.farmId, true);

    if (cycle.farmId !== input.farmId) {
      throw new BadRequestException('Cropping cycle belongs to a different farm');
    }
    if (!TIER_A_STATUSES.includes(cycle.status)) {
      throw new BadRequestException(
        `Cannot bind harvest to cycle in status ${cycle.status}`,
      );
    }
    if (cycle.plotId && input.plotId && cycle.plotId !== input.plotId) {
      throw new BadRequestException('Receive plot does not match cycle plot');
    }

    let line = lineId
      ? cycle.lines.find((l) => l.id === lineId)
      : cycle.lines.find((l) => l.productId === input.productId);

    if (lineId && !line) {
      throw new BadRequestException('Cycle line not on this cycle');
    }
    if (!line) {
      throw new BadRequestException(
        'No matching cycle line for this product; pass cycleLineId or add a line',
      );
    }
    if (line.productId !== input.productId) {
      throw new BadRequestException('Cycle line product does not match receive product');
    }
    if (
      line.productVarietyId &&
      input.productVarietyId &&
      line.productVarietyId !== input.productVarietyId
    ) {
      throw new BadRequestException('Cycle line variety does not match receive variety');
    }

    if (cycle.status === 'PLANNED') {
      await this.prisma.croppingCycle.update({
        where: { id: cycle.id },
        data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      });
    }

    return {
      croppingCycleId: cycle.id,
      croppingCycleLineId: line.id,
    };
  }

  private async collectHarvestEvents(
    cycle: Prisma.CroppingCycleGetPayload<{
      include: { lines: { include: { product: true; unit: true } }; season: true };
    }>,
    line: { id: string; productId: string; unitCode: string },
  ) {
    const explicitLots = await this.prisma.stockLot.findMany({
      where: { croppingCycleLineId: line.id },
      include: {
        movements: { where: { movementType: 'RECEIVE' } },
      },
      orderBy: { receivedAt: 'asc' },
    });

    const events: Array<{
      lotId: string;
      lotCode: string;
      qty: number;
      unitCode: string;
      harvestDate: Date | null;
      attribution: 'EXPLICIT' | 'INFERRED' | 'AMBIGUOUS';
    }> = [];

    const explicitIds = new Set<string>();
    for (const lot of explicitLots) {
      explicitIds.add(lot.id);
      const receiveQty = lot.movements.reduce((s, m) => s + toNumber(m.qtyInLotUnit), 0);
      if (receiveQty <= 0) continue;
      events.push({
        lotId: lot.id,
        lotCode: lot.lotCode,
        qty: receiveQty,
        unitCode: lot.unitCode,
        harvestDate: lot.harvestDate,
        attribution: 'EXPLICIT',
      });
    }

    if (TIER_B_EXCLUDED.includes(cycle.status)) {
      return events;
    }

    const softLots = await this.prisma.stockLot.findMany({
      where: {
        farmId: cycle.farmId,
        productId: line.productId,
        croppingCycleId: null,
        ...(cycle.plotId ? { plotId: cycle.plotId } : {}),
      },
      include: {
        movements: { where: { movementType: 'RECEIVE' } },
      },
      orderBy: { receivedAt: 'asc' },
    });

    for (const lot of softLots) {
      if (explicitIds.has(lot.id)) continue;
      const harvestDay = lot.harvestDate ?? lot.receivedAt;
      const day = new Date(harvestDay);
      day.setUTCHours(0, 0, 0, 0);
      if (day < cycle.startsOn || day > cycle.endsOn) continue;
      if (cycle.plotId && lot.plotId !== cycle.plotId) continue;

      const receiveQty = lot.movements.reduce((s, m) => s + toNumber(m.qtyInLotUnit), 0);
      if (receiveQty <= 0) continue;

      // Ambiguity check: other in-flight cycles that could claim this lot
      const rivals = await this.prisma.croppingCycle.count({
        where: {
          id: { not: cycle.id },
          farmId: cycle.farmId,
          status: { notIn: TIER_B_EXCLUDED },
          startsOn: { lte: day },
          endsOn: { gte: day },
          lines: { some: { productId: line.productId } },
          ...(lot.plotId
            ? { OR: [{ plotId: null }, { plotId: lot.plotId }] }
            : { plotId: null }),
        },
      });

      events.push({
        lotId: lot.id,
        lotCode: lot.lotCode,
        qty: receiveQty,
        unitCode: lot.unitCode,
        harvestDate: lot.harvestDate,
        attribution: rivals > 0 ? 'AMBIGUOUS' : 'INFERRED',
      });
    }

    return events;
  }

  private nextStatus(
    current: CroppingCycleStatus,
    action: 'plan' | 'start' | 'mark-harvested' | 'complete' | 'cancel' | 'archive',
  ): CroppingCycleStatus | null {
    const map: Record<string, Partial<Record<CroppingCycleStatus, CroppingCycleStatus>>> = {
      plan: { DRAFT: 'PLANNED' },
      start: { PLANNED: 'IN_PROGRESS' },
      'mark-harvested': { IN_PROGRESS: 'HARVESTED' },
      complete: { HARVESTED: 'COMPLETED', IN_PROGRESS: 'COMPLETED' },
      cancel: {
        DRAFT: 'CANCELLED',
        PLANNED: 'CANCELLED',
        IN_PROGRESS: 'CANCELLED',
      },
      archive: { COMPLETED: 'ARCHIVED', CANCELLED: 'ARCHIVED' },
    };
    return map[action]?.[current] ?? null;
  }

  private async requireCycle(userId: string, id: string, requireWrite: boolean) {
    const cycle = await this.prisma.croppingCycle.findUnique({
      where: { id },
      include: {
        lines: { include: { product: true, unit: true }, orderBy: { sortOrder: 'asc' } },
        season: true,
      },
    });
    if (!cycle) throw new NotFoundException('Cropping cycle not found');
    await this.farms.assertFarmAccess(userId, cycle.farmId, requireWrite);
    return cycle;
  }

  private async assertSeasonCode(code: string) {
    const row = await this.prisma.seasonCode.findFirst({
      where: { code: code.toUpperCase(), isActive: true },
    });
    if (!row) throw new BadRequestException('Season code is not available');
  }

  private assertWindow(startsOn: string, endsOn: string) {
    if (new Date(endsOn) < new Date(startsOn)) {
      throw new BadRequestException('endsOn must be on or after startsOn');
    }
  }

  private async assertScope(
    farmId: string,
    plotId?: string | null,
    fieldId?: string | null,
    productionUnitId?: string | null,
  ) {
    if (plotId) {
      const plot = await this.prisma.plot.findFirst({ where: { id: plotId, farmId } });
      if (!plot) throw new BadRequestException('Plot not found on this farm');
    }
    if (fieldId) {
      const field = await this.prisma.field.findFirst({
        where: { id: fieldId, plot: { farmId } },
      });
      if (!field) throw new BadRequestException('Field not found on this farm');
      if (plotId && field.plotId !== plotId) {
        throw new BadRequestException('Field does not belong to the selected plot');
      }
    }
    if (productionUnitId) {
      const unit = await this.prisma.productionUnit.findFirst({
        where: { id: productionUnitId, farmId },
      });
      if (!unit) throw new BadRequestException('Production unit not found on this farm');
    }
  }

  private async resolveLineSpecs(lines: CreateCycleLineDto[]) {
    const specs: Array<{
      productId: string;
      productVarietyId?: string;
      plannedQty: number;
      unitCode: string;
      plannedAreaHa?: number;
      notes?: string;
    }> = [];

    const seen = new Set<string>();
    for (const line of lines) {
      const product = await this.prisma.product.findFirst({
        where: { code: line.productCode.toUpperCase(), status: 'ACTIVE' },
      });
      if (!product) {
        throw new BadRequestException(
          `Product ${line.productCode} is not available`,
        );
      }
      if (seen.has(product.id)) {
        throw new BadRequestException('Duplicate product in cycle lines');
      }
      seen.add(product.id);

      let productVarietyId: string | undefined;
      if (line.varietyCode) {
        const variety = await this.prisma.productVariety.findFirst({
          where: {
            productId: product.id,
            code: line.varietyCode.toUpperCase(),
            isActive: true,
          },
        });
        if (!variety) throw new BadRequestException('Variety not found for product');
        productVarietyId = variety.id;
      }

      const unitCode = (line.unitCode ?? product.defaultUnitCode).toUpperCase();
      const unit = await this.prisma.unit.findUnique({ where: { code: unitCode } });
      if (!unit) throw new BadRequestException(`Unit ${unitCode} not found`);

      specs.push({
        productId: product.id,
        productVarietyId,
        plannedQty: line.plannedQty,
        unitCode,
        plannedAreaHa: line.plannedAreaHa,
        notes: line.notes,
      });
    }
    return specs;
  }

  private shapeCycle(cycle: {
    id: string;
    farmId: string;
    plotId: string | null;
    fieldId: string | null;
    productionUnitId: string | null;
    code: string | null;
    name: string;
    nameAm: string | null;
    seasonYear: number;
    seasonCode: string;
    startsOn: Date;
    endsOn: Date;
    status: CroppingCycleStatus;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    lines: Prisma.CroppingCycleLineGetPayload<{ include: { product: true; unit: true } }>[];
    season?: { name: string } | null;
  }) {
    return {
      id: cycle.id,
      farmId: cycle.farmId,
      plotId: cycle.plotId,
      fieldId: cycle.fieldId,
      productionUnitId: cycle.productionUnitId,
      code: cycle.code,
      name: cycle.name,
      nameAm: cycle.nameAm,
      seasonYear: cycle.seasonYear,
      seasonCode: cycle.seasonCode,
      seasonName: cycle.season?.name,
      startsOn: cycle.startsOn,
      endsOn: cycle.endsOn,
      status: cycle.status,
      notes: cycle.notes,
      lines: cycle.lines.map((l) => this.shapeLine(l)),
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt,
    };
  }

  private shapeLine(
    line: Prisma.CroppingCycleLineGetPayload<{ include: { product: true; unit: true } }>,
  ) {
    return {
      id: line.id,
      cycleId: line.cycleId,
      productId: line.productId,
      productCode: line.product.code,
      productNameEn: line.product.nameEn,
      productNameAm: line.product.nameAm,
      productVarietyId: line.productVarietyId,
      plannedQty: toNumber(line.plannedQty),
      unitCode: line.unitCode,
      unitNameEn: line.unit.nameEn,
      plannedAreaHa: line.plannedAreaHa == null ? null : toNumber(line.plannedAreaHa),
      sortOrder: line.sortOrder,
      notes: line.notes,
      createdAt: line.createdAt,
    };
  }
}
