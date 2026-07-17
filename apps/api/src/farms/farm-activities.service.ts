import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FarmActivityStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from './farms.service';
import {
  CreateFarmActivityDto,
  QueryFarmActivitiesDto,
  UpdateFarmActivityDto,
} from './dto/farm-activity.dto';

function dateOnly(iso: string): Date {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function utcToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function sameUtcDay(a: Date | null | undefined, b: Date): boolean {
  if (!a) return false;
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function canHardDeleteActivity(
  status: string,
  occurredOn: Date | null | undefined,
  today: Date = utcToday(),
): boolean {
  if (status === 'PLANNED') return true;
  if (status === 'COMPLETED' && sameUtcDay(occurredOn, today)) return true;
  return false;
}

@Injectable()
export class FarmActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farms: FarmsService,
  ) {}

  async listTypes() {
    const rows = await this.prisma.activityType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    return {
      data: rows.map((t) => ({
        code: t.code,
        nameEn: t.nameEn,
        nameAm: t.nameAm,
        sortOrder: t.sortOrder,
      })),
    };
  }

  async listForFarm(
    userId: string,
    farmId: string,
    query: QueryFarmActivitiesDto = {},
  ) {
    await this.farms.assertFarmAccess(userId, farmId, false);
    return { data: await this.findActivities(farmId, query) };
  }

  async listForCycle(userId: string, cycleId: string) {
    const cycle = await this.prisma.croppingCycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) throw new NotFoundException('Cropping cycle not found');
    await this.farms.assertFarmAccess(userId, cycle.farmId, false);
    return {
      data: await this.findActivities(cycle.farmId, {
        croppingCycleId: cycleId,
      }),
    };
  }

  async history(userId: string, farmId: string) {
    await this.farms.assertFarmAccess(userId, farmId, false);
    return {
      data: await this.findActivities(farmId, { status: 'COMPLETED' }),
    };
  }

  async getOne(userId: string, id: string) {
    const activity = await this.requireActivity(userId, id, false);
    return this.shape(activity);
  }

  async create(userId: string, farmId: string, dto: CreateFarmActivityDto) {
    await this.farms.assertFarmAccess(userId, farmId, true);
    const status = (dto.status ?? 'COMPLETED') as FarmActivityStatus;
    if (status === 'CANCELLED') {
      throw new BadRequestException('Create with CANCELLED is not allowed');
    }
    await this.assertType(dto.activityTypeCode);
    await this.assertScope(farmId, dto.plotId, dto.croppingCycleId, dto.harvestSessionId);
    const productId = await this.resolveProductId(dto.productCode);
    this.assertMeasurePair(dto.measureQty, dto.measureUnitCode);
    if (dto.measureUnitCode) await this.assertUnit(dto.measureUnitCode);

    if (status === 'COMPLETED' && !dto.occurredOn) {
      throw new BadRequestException('occurredOn is required for COMPLETED activities');
    }
    if (status === 'PLANNED' && !dto.scheduledOn) {
      throw new BadRequestException('scheduledOn is required for PLANNED activities');
    }

    const created = await this.prisma.farmActivity.create({
      data: {
        farmId,
        plotId: dto.plotId,
        croppingCycleId: dto.croppingCycleId,
        harvestSessionId: dto.harvestSessionId,
        activityTypeCode: dto.activityTypeCode.toUpperCase(),
        status,
        occurredOn: dto.occurredOn ? dateOnly(dto.occurredOn) : undefined,
        scheduledOn: dto.scheduledOn ? dateOnly(dto.scheduledOn) : undefined,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        notes: dto.notes,
        attachmentUrls: dto.attachmentUrls ?? [],
        measureQty: dto.measureQty,
        measureUnitCode: dto.measureUnitCode?.toUpperCase(),
        areaHa: dto.areaHa,
        productId,
        crewCount: dto.crewCount,
        createdByUserId: userId,
      },
      include: this.include(),
    });

    return this.shape(created);
  }

  async update(userId: string, id: string, dto: UpdateFarmActivityDto) {
    const existing = await this.requireActivity(userId, id, true);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cancelled activities cannot be edited');
    }

    const nextStatus = (dto.status ?? existing.status) as FarmActivityStatus;
    const nextType = dto.activityTypeCode
      ? dto.activityTypeCode.toUpperCase()
      : existing.activityTypeCode;
    if (dto.activityTypeCode) await this.assertType(nextType);

    const nextPlotId =
      dto.plotId === undefined ? existing.plotId : dto.plotId;
    const nextCycleId =
      dto.croppingCycleId === undefined
        ? existing.croppingCycleId
        : dto.croppingCycleId;
    const nextHarvestId =
      dto.harvestSessionId === undefined
        ? existing.harvestSessionId
        : dto.harvestSessionId;
    await this.assertScope(
      existing.farmId,
      nextPlotId ?? undefined,
      nextCycleId ?? undefined,
      nextHarvestId ?? undefined,
    );

    let productId = existing.productId;
    if (dto.productCode !== undefined) {
      productId = dto.productCode
        ? await this.resolveProductId(dto.productCode)
        : null;
    }

    const measureQty =
      dto.measureQty === undefined
        ? existing.measureQty != null
          ? Number(existing.measureQty)
          : null
        : dto.measureQty;
    const measureUnitCode =
      dto.measureUnitCode === undefined
        ? existing.measureUnitCode
        : dto.measureUnitCode
          ? dto.measureUnitCode.toUpperCase()
          : null;
    this.assertMeasurePair(measureQty ?? undefined, measureUnitCode ?? undefined);
    if (measureUnitCode) await this.assertUnit(measureUnitCode);

    const occurredOn =
      dto.occurredOn === undefined
        ? existing.occurredOn
        : dto.occurredOn
          ? dateOnly(dto.occurredOn)
          : null;
    const scheduledOn =
      dto.scheduledOn === undefined
        ? existing.scheduledOn
        : dto.scheduledOn
          ? dateOnly(dto.scheduledOn)
          : null;

    if (nextStatus === 'COMPLETED' && !occurredOn) {
      throw new BadRequestException('occurredOn is required for COMPLETED activities');
    }
    if (nextStatus === 'PLANNED' && !scheduledOn) {
      throw new BadRequestException('scheduledOn is required for PLANNED activities');
    }

    const updated = await this.prisma.farmActivity.update({
      where: { id },
      data: {
        activityTypeCode: nextType,
        status: nextStatus,
        plotId: nextPlotId,
        croppingCycleId: nextCycleId,
        harvestSessionId: nextHarvestId,
        occurredOn,
        scheduledOn,
        occurredAt:
          dto.occurredAt === undefined
            ? undefined
            : dto.occurredAt
              ? new Date(dto.occurredAt)
              : null,
        notes: dto.notes === undefined ? undefined : dto.notes,
        attachmentUrls: dto.attachmentUrls,
        measureQty,
        measureUnitCode,
        areaHa: dto.areaHa === undefined ? undefined : dto.areaHa,
        productId,
        crewCount: dto.crewCount === undefined ? undefined : dto.crewCount,
        updatedAt: new Date(),
      },
      include: this.include(),
    });

    return this.shape(updated);
  }

  async cancel(userId: string, id: string) {
    const existing = await this.requireActivity(userId, id, true);
    if (existing.status === 'CANCELLED') {
      return this.shape(existing);
    }
    const updated = await this.prisma.farmActivity.update({
      where: { id },
      data: { status: 'CANCELLED', updatedAt: new Date() },
      include: this.include(),
    });
    return this.shape(updated);
  }

  async remove(userId: string, id: string) {
    const existing = await this.requireActivity(userId, id, true);
    if (!canHardDeleteActivity(existing.status, existing.occurredOn)) {
      throw new BadRequestException(
        'Only PLANNED activities or COMPLETED activities from today can be deleted; use cancel instead',
      );
    }
    await this.prisma.farmActivity.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async findActivities(farmId: string, query: QueryFarmActivitiesDto) {
    const statusFilter =
      query.status && query.status !== 'all'
        ? (query.status as FarmActivityStatus)
        : undefined;

    const rows = await this.prisma.farmActivity.findMany({
      where: {
        farmId,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(query.activityTypeCode
          ? { activityTypeCode: query.activityTypeCode.toUpperCase() }
          : {}),
        ...(query.plotId ? { plotId: query.plotId } : {}),
        ...(query.croppingCycleId
          ? { croppingCycleId: query.croppingCycleId }
          : {}),
        ...(query.fromDate || query.toDate
          ? {
              OR: [
                {
                  occurredOn: {
                    ...(query.fromDate ? { gte: dateOnly(query.fromDate) } : {}),
                    ...(query.toDate ? { lte: dateOnly(query.toDate) } : {}),
                  },
                },
                {
                  scheduledOn: {
                    ...(query.fromDate ? { gte: dateOnly(query.fromDate) } : {}),
                    ...(query.toDate ? { lte: dateOnly(query.toDate) } : {}),
                  },
                },
              ],
            }
          : {}),
      },
      include: this.include(),
      orderBy: [
        { occurredOn: 'desc' },
        { scheduledOn: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return rows.map((r) => this.shape(r));
  }

  private async requireActivity(userId: string, id: string, write: boolean) {
    const activity = await this.prisma.farmActivity.findUnique({
      where: { id },
      include: this.include(),
    });
    if (!activity) throw new NotFoundException('Farm activity not found');
    await this.farms.assertFarmAccess(userId, activity.farmId, write);
    return activity;
  }

  private async assertType(code: string) {
    const type = await this.prisma.activityType.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!type || !type.isActive) {
      throw new BadRequestException('Activity type is not available');
    }
  }

  private async assertUnit(code: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!unit) throw new BadRequestException('Unit not found');
  }

  private assertMeasurePair(
    qty?: number | null,
    unitCode?: string | null,
  ) {
    const hasQty = qty != null;
    const hasUnit = !!unitCode;
    if (hasQty !== hasUnit) {
      throw new BadRequestException(
        'measureQty and measureUnitCode must be provided together',
      );
    }
  }

  private async resolveProductId(productCode?: string | null) {
    if (!productCode) return null;
    const product = await this.prisma.product.findFirst({
      where: { code: productCode.toUpperCase(), status: 'ACTIVE' },
    });
    if (!product) throw new BadRequestException('This product is not available yet');
    return product.id;
  }

  private async assertScope(
    farmId: string,
    plotId?: string | null,
    croppingCycleId?: string | null,
    harvestSessionId?: string | null,
  ) {
    let cyclePlotId: string | null | undefined;
    if (plotId) {
      const plot = await this.prisma.plot.findUnique({ where: { id: plotId } });
      if (!plot || plot.farmId !== farmId) {
        throw new BadRequestException('Plot does not belong to this farm');
      }
    }
    if (croppingCycleId) {
      const cycle = await this.prisma.croppingCycle.findUnique({
        where: { id: croppingCycleId },
      });
      if (!cycle || cycle.farmId !== farmId) {
        throw new BadRequestException('Cropping cycle does not belong to this farm');
      }
      cyclePlotId = cycle.plotId;
      if (plotId && cycle.plotId && cycle.plotId !== plotId) {
        throw new BadRequestException(
          'Plot does not match the cropping cycle plot',
        );
      }
    }
    if (harvestSessionId) {
      const session = await this.prisma.harvestSession.findUnique({
        where: { id: harvestSessionId },
      });
      if (!session || session.farmId !== farmId) {
        throw new BadRequestException(
          'Harvest session does not belong to this farm',
        );
      }
    }
    void cyclePlotId;
  }

  private include() {
    return {
      activityType: true,
      plot: true,
      croppingCycle: true,
      product: true,
      measureUnit: true,
    };
  }

  private shape(row: any) {
    return {
      id: row.id,
      farmId: row.farmId,
      plotId: row.plotId,
      plotName: row.plot?.name ?? null,
      croppingCycleId: row.croppingCycleId,
      croppingCycleName: row.croppingCycle?.name ?? null,
      harvestSessionId: row.harvestSessionId,
      activityTypeCode: row.activityTypeCode,
      activityTypeNameEn: row.activityType?.nameEn ?? null,
      activityTypeNameAm: row.activityType?.nameAm ?? null,
      status: row.status,
      occurredOn: row.occurredOn,
      scheduledOn: row.scheduledOn,
      occurredAt: row.occurredAt,
      notes: row.notes,
      attachmentUrls: row.attachmentUrls ?? [],
      measureQty: row.measureQty != null ? Number(row.measureQty) : null,
      measureUnitCode: row.measureUnitCode,
      areaHa: row.areaHa != null ? Number(row.areaHa) : null,
      productId: row.productId,
      productCode: row.product?.code ?? null,
      productNameEn: row.product?.nameEn ?? null,
      crewCount: row.crewCount,
      metadata: row.metadata,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
