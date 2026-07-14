import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FarmStatus, PartyRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFarmDto, QueryFarmsDto, UpdateFarmDto } from './dto/farm.dto';
import { CreatePlotDto, UpdatePlotDto } from './dto/plot.dto';

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function assertGeojson(value: unknown) {
  if (value === undefined || value === null) return;
  if (typeof value !== 'object') {
    throw new BadRequestException('boundaryGeojson must be a GeoJSON object');
  }
  const type = (value as { type?: string }).type;
  if (type !== 'Polygon' && type !== 'MultiPolygon') {
    throw new BadRequestException('boundaryGeojson type must be Polygon or MultiPolygon');
  }
}

const WRITE_ROLES: PartyRole[] = ['OWNER', 'CO_OWNER', 'OPERATOR', 'TENANT', 'COOP_MANAGER'];

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, query: QueryFarmsDto = {}) {
    const profile = await this.requireFarmerProfile(userId);
    const statusFilter =
      query.status === 'all'
        ? undefined
        : ((query.status?.toUpperCase() as FarmStatus) || 'ACTIVE');

    const parties = await this.prisma.farmParty.findMany({
      where: {
        farmerProfileId: profile.id,
        status: 'ACTIVE',
        ...(statusFilter
          ? { farm: { status: statusFilter } }
          : {}),
      },
      include: { farm: true },
      orderBy: { createdAt: 'desc' },
    });

    const seen = new Set<string>();
    const farms = [];
    for (const party of parties) {
      if (seen.has(party.farm.id)) continue;
      seen.add(party.farm.id);
      farms.push(this.shapeFarm(party.farm));
    }

    return { data: farms };
  }

  async createFarm(userId: string, dto: CreateFarmDto) {
    const profile = await this.requireFarmerProfile(userId);
    assertGeojson(dto.boundaryGeojson);

    const farm = await this.prisma.$transaction(async (tx) => {
      const created = await tx.farm.create({
        data: {
          code: dto.code,
          name: dto.name,
          nameAm: dto.nameAm,
          tenureType: dto.tenureType ?? 'OWNED',
          region: dto.region,
          regionEn: dto.regionEn,
          zone: dto.zone,
          woreda: dto.woreda,
          kebele: dto.kebele,
          altitudeM: dto.altitudeM,
          sizeHa: dto.sizeHa,
          centroidLat: dto.centroidLat,
          centroidLng: dto.centroidLng,
          boundaryGeojson: dto.boundaryGeojson as Prisma.InputJsonValue | undefined,
          boundarySource: dto.boundarySource,
          boundaryUpdatedAt: dto.boundaryGeojson ? new Date() : undefined,
          notes: dto.notes,
        },
      });

      await tx.farmParty.create({
        data: {
          farmId: created.id,
          farmerProfileId: profile.id,
          partyRole: 'OWNER',
          tenureType: dto.tenureType ?? 'OWNED',
          isPrimary: true,
          status: 'ACTIVE',
        },
      });

      await tx.farmPartyHistory.create({
        data: {
          farmId: created.id,
          farmerProfileId: profile.id,
          partyRole: 'OWNER',
          tenureType: dto.tenureType ?? 'OWNED',
          changedByUserId: userId,
          reason: 'Farm created',
        },
      });

      await tx.farmAuditLog.create({
        data: {
          entityType: 'FARM',
          entityId: created.id,
          farmId: created.id,
          action: 'CREATE',
          actorUserId: userId,
          afterJson: this.shapeFarm(created) as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return this.shapeFarm(farm);
  }

  async getFarm(userId: string, farmId: string) {
    await this.requirePartyAccess(userId, farmId);
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) throw new NotFoundException('Farm not found');
    return this.shapeFarm(farm);
  }

  async updateFarm(userId: string, farmId: string, dto: UpdateFarmDto) {
    await this.requirePartyAccess(userId, farmId, true);
    assertGeojson(dto.boundaryGeojson);

    const before = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!before) throw new NotFoundException('Farm not found');

    const updated = await this.prisma.farm.update({
      where: { id: farmId },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.nameAm !== undefined ? { nameAm: dto.nameAm } : {}),
        ...(dto.tenureType !== undefined ? { tenureType: dto.tenureType } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
        ...(dto.regionEn !== undefined ? { regionEn: dto.regionEn } : {}),
        ...(dto.zone !== undefined ? { zone: dto.zone } : {}),
        ...(dto.woreda !== undefined ? { woreda: dto.woreda } : {}),
        ...(dto.kebele !== undefined ? { kebele: dto.kebele } : {}),
        ...(dto.altitudeM !== undefined ? { altitudeM: dto.altitudeM } : {}),
        ...(dto.sizeHa !== undefined ? { sizeHa: dto.sizeHa } : {}),
        ...(dto.centroidLat !== undefined ? { centroidLat: dto.centroidLat } : {}),
        ...(dto.centroidLng !== undefined ? { centroidLng: dto.centroidLng } : {}),
        ...(dto.boundaryGeojson !== undefined
          ? {
              boundaryGeojson: dto.boundaryGeojson as Prisma.InputJsonValue,
              boundaryUpdatedAt: new Date(),
            }
          : {}),
        ...(dto.boundarySource !== undefined ? { boundarySource: dto.boundarySource } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        updatedAt: new Date(),
      },
    });

    await this.prisma.farmAuditLog.create({
      data: {
        entityType: 'FARM',
        entityId: farmId,
        farmId,
        action: dto.status !== undefined && dto.status !== before.status ? 'STATUS_CHANGE' : 'UPDATE',
        actorUserId: userId,
        beforeJson: this.shapeFarm(before) as unknown as Prisma.InputJsonValue,
        afterJson: this.shapeFarm(updated) as unknown as Prisma.InputJsonValue,
      },
    });

    return this.shapeFarm(updated);
  }

  async listPlots(userId: string, farmId: string) {
    await this.requirePartyAccess(userId, farmId);
    const plots = await this.prisma.plot.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
    });
    return { data: plots.map((p) => this.shapePlot(p)) };
  }

  async createPlot(userId: string, farmId: string, dto: CreatePlotDto) {
    await this.requirePartyAccess(userId, farmId, true);
    assertGeojson(dto.boundaryGeojson);

    const plot = await this.prisma.plot.create({
      data: {
        farmId,
        code: dto.code,
        name: dto.name,
        nameAm: dto.nameAm,
        tenureType: dto.tenureType,
        sizeHa: dto.sizeHa,
        centroidLat: dto.centroidLat,
        centroidLng: dto.centroidLng,
        boundaryGeojson: dto.boundaryGeojson as Prisma.InputJsonValue | undefined,
        boundarySource: dto.boundarySource,
        boundaryUpdatedAt: dto.boundaryGeojson ? new Date() : undefined,
        notes: dto.notes,
      },
    });

    await this.prisma.farmAuditLog.create({
      data: {
        entityType: 'PLOT',
        entityId: plot.id,
        farmId,
        action: 'CREATE',
        actorUserId: userId,
        afterJson: this.shapePlot(plot) as unknown as Prisma.InputJsonValue,
      },
    });

    return this.shapePlot(plot);
  }

  async updatePlot(userId: string, plotId: string, dto: UpdatePlotDto) {
    const plot = await this.prisma.plot.findUnique({ where: { id: plotId } });
    if (!plot) throw new NotFoundException('Plot not found');
    await this.requirePartyAccess(userId, plot.farmId, true);
    assertGeojson(dto.boundaryGeojson);

    const updated = await this.prisma.plot.update({
      where: { id: plotId },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.nameAm !== undefined ? { nameAm: dto.nameAm } : {}),
        ...(dto.tenureType !== undefined ? { tenureType: dto.tenureType } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.sizeHa !== undefined ? { sizeHa: dto.sizeHa } : {}),
        ...(dto.centroidLat !== undefined ? { centroidLat: dto.centroidLat } : {}),
        ...(dto.centroidLng !== undefined ? { centroidLng: dto.centroidLng } : {}),
        ...(dto.boundaryGeojson !== undefined
          ? {
              boundaryGeojson: dto.boundaryGeojson as Prisma.InputJsonValue,
              boundaryUpdatedAt: new Date(),
            }
          : {}),
        ...(dto.boundarySource !== undefined ? { boundarySource: dto.boundarySource } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        updatedAt: new Date(),
      },
    });

    await this.prisma.farmAuditLog.create({
      data: {
        entityType: 'PLOT',
        entityId: plotId,
        farmId: plot.farmId,
        action: 'UPDATE',
        actorUserId: userId,
        beforeJson: this.shapePlot(plot) as unknown as Prisma.InputJsonValue,
        afterJson: this.shapePlot(updated) as unknown as Prisma.InputJsonValue,
      },
    });

    return this.shapePlot(updated);
  }

  private async requireFarmerProfile(userId: string) {
    const profile = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new BadRequestException(
        'Farmer profile not found. Please complete your profile first.',
      );
    }
    return profile;
  }

  private async requirePartyAccess(userId: string, farmId: string, requireWrite = false) {
    const profile = await this.requireFarmerProfile(userId);
    const party = await this.prisma.farmParty.findFirst({
      where: {
        farmId,
        farmerProfileId: profile.id,
        status: 'ACTIVE',
      },
    });
    if (!party) {
      throw new NotFoundException('Farm not found');
    }
    if (requireWrite && !WRITE_ROLES.includes(party.partyRole)) {
      throw new ForbiddenException('You do not have permission to modify this farm');
    }
    return { profile, party };
  }

  private shapeFarm(farm: {
    id: string;
    code: string | null;
    name: string;
    nameAm: string | null;
    tenureType: string;
    status: string;
    region: string;
    regionEn: string | null;
    zone: string | null;
    woreda: string | null;
    kebele: string | null;
    altitudeM: unknown;
    sizeHa: unknown;
    centroidLat: unknown;
    centroidLng: unknown;
    boundaryGeojson: unknown;
    boundarySource: string | null;
    notes: string | null;
    createdAt: Date;
  }) {
    return {
      id: farm.id,
      code: farm.code,
      name: farm.name,
      nameAm: farm.nameAm,
      tenureType: farm.tenureType,
      status: farm.status,
      region: farm.region,
      regionEn: farm.regionEn,
      zone: farm.zone,
      woreda: farm.woreda,
      kebele: farm.kebele,
      altitudeM: toNumber(farm.altitudeM),
      sizeHa: toNumber(farm.sizeHa),
      centroidLat: toNumber(farm.centroidLat),
      centroidLng: toNumber(farm.centroidLng),
      boundaryGeojson: farm.boundaryGeojson ?? null,
      boundarySource: farm.boundarySource,
      notes: farm.notes,
      createdAt: farm.createdAt,
    };
  }

  private shapePlot(plot: {
    id: string;
    farmId: string;
    code: string | null;
    name: string;
    nameAm: string | null;
    tenureType: string | null;
    status: string;
    sizeHa: unknown;
    centroidLat: unknown;
    centroidLng: unknown;
    boundaryGeojson: unknown;
    boundarySource: string | null;
    notes: string | null;
    createdAt: Date;
  }) {
    return {
      id: plot.id,
      farmId: plot.farmId,
      code: plot.code,
      name: plot.name,
      nameAm: plot.nameAm,
      tenureType: plot.tenureType,
      status: plot.status,
      sizeHa: toNumber(plot.sizeHa),
      centroidLat: toNumber(plot.centroidLat),
      centroidLng: toNumber(plot.centroidLng),
      boundaryGeojson: plot.boundaryGeojson ?? null,
      boundarySource: plot.boundarySource,
      notes: plot.notes,
      createdAt: plot.createdAt,
    };
  }
}
