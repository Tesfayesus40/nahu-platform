import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WarehousePartyRole, WarehouseSiteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from '../farms/farms.service';
import {
  CreateOnFarmSiteDto,
  QueryStorageSitesDto,
  UpdateStorageSiteDto,
} from './dto/warehouse.dto';

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

const WRITE_ROLES: WarehousePartyRole[] = ['OWNER', 'MANAGER'];

@Injectable()
export class WarehouseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farms: FarmsService,
  ) {}

  async listMine(userId: string, query: QueryStorageSitesDto = {}) {
    const profile = await this.requireFarmerProfile(userId);
    const statusFilter =
      query.status === 'all'
        ? undefined
        : ((query.status?.toUpperCase() as WarehouseSiteStatus) || 'ACTIVE');

    const farmParties = await this.prisma.farmParty.findMany({
      where: { farmerProfileId: profile.id, status: 'ACTIVE' },
      select: { farmId: true },
    });
    const farmIds = [...new Set(farmParties.map((p) => p.farmId))];
    const scopedFarmIds = query.farmId
      ? farmIds.includes(query.farmId)
        ? [query.farmId]
        : []
      : farmIds;

    const parties = await this.prisma.warehouseParty.findMany({
      where: {
        farmerProfileId: profile.id,
        status: 'ACTIVE',
        ...(statusFilter || query.farmId
          ? {
              storageSite: {
                ...(statusFilter ? { status: statusFilter } : {}),
                ...(query.farmId ? { farmId: query.farmId } : {}),
              },
            }
          : {}),
      },
      include: { storageSite: true },
      orderBy: { createdAt: 'desc' },
    });

    const onFarmSites =
      scopedFarmIds.length === 0
        ? []
        : await this.prisma.storageSite.findMany({
            where: {
              siteType: 'ON_FARM',
              farmId: { in: scopedFarmIds },
              ...(statusFilter ? { status: statusFilter } : {}),
            },
            orderBy: { createdAt: 'desc' },
          });

    const seen = new Set<string>();
    const sites = [];
    for (const party of parties) {
      if (seen.has(party.storageSite.id)) continue;
      seen.add(party.storageSite.id);
      sites.push(this.shapeSite(party.storageSite));
    }
    for (const site of onFarmSites) {
      if (seen.has(site.id)) continue;
      seen.add(site.id);
      sites.push(this.shapeSite(site));
    }

    return { data: sites };
  }

  async createOnFarm(userId: string, dto: CreateOnFarmSiteDto) {
    await this.farms.assertFarmAccess(userId, dto.farmId, true);
    const profile = await this.requireFarmerProfile(userId);

    if (dto.capacityUnitCode) {
      const unit = await this.prisma.unit.findUnique({
        where: { code: dto.capacityUnitCode.toUpperCase() },
      });
      if (!unit) throw new BadRequestException('Unknown capacity unit code');
    }

    const site = await this.prisma.$transaction(async (tx) => {
      const created = await tx.storageSite.create({
        data: {
          code: dto.code,
          name: dto.name,
          nameAm: dto.nameAm,
          siteType: 'ON_FARM',
          status: 'ACTIVE',
          farmId: dto.farmId,
          region: dto.region,
          regionEn: dto.regionEn,
          zone: dto.zone,
          woreda: dto.woreda,
          kebele: dto.kebele,
          centroidLat: dto.centroidLat,
          centroidLng: dto.centroidLng,
          capacity: dto.capacity,
          capacityUnitCode: dto.capacityUnitCode?.toUpperCase(),
          notes: dto.notes,
        },
      });

      await tx.warehouseParty.create({
        data: {
          storageSiteId: created.id,
          farmerProfileId: profile.id,
          partyRole: 'OWNER',
          isPrimary: true,
          status: 'ACTIVE',
        },
      });

      return created;
    });

    return this.shapeSite(site);
  }

  async getSite(userId: string, siteId: string) {
    const site = await this.assertSiteUsable(userId, siteId, false);
    return this.shapeSite(site);
  }

  async updateSite(userId: string, siteId: string, dto: UpdateStorageSiteDto) {
    await this.assertSiteUsable(userId, siteId, true);

    if (dto.capacityUnitCode) {
      const unit = await this.prisma.unit.findUnique({
        where: { code: dto.capacityUnitCode.toUpperCase() },
      });
      if (!unit) throw new BadRequestException('Unknown capacity unit code');
    }

    const updated = await this.prisma.storageSite.update({
      where: { id: siteId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.nameAm !== undefined ? { nameAm: dto.nameAm } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
        ...(dto.regionEn !== undefined ? { regionEn: dto.regionEn } : {}),
        ...(dto.zone !== undefined ? { zone: dto.zone } : {}),
        ...(dto.woreda !== undefined ? { woreda: dto.woreda } : {}),
        ...(dto.kebele !== undefined ? { kebele: dto.kebele } : {}),
        ...(dto.centroidLat !== undefined ? { centroidLat: dto.centroidLat } : {}),
        ...(dto.centroidLng !== undefined ? { centroidLng: dto.centroidLng } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.capacityUnitCode !== undefined
          ? { capacityUnitCode: dto.capacityUnitCode.toUpperCase() }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        updatedAt: new Date(),
      },
    });

    return this.shapeSite(updated);
  }

  /** Assert farmer can use site (party OR farm write/read access for ON_FARM). */
  async assertSiteUsable(userId: string, siteId: string, requireWrite: boolean) {
    const site = await this.prisma.storageSite.findUnique({ where: { id: siteId } });
    if (!site || site.status !== 'ACTIVE') {
      throw new NotFoundException('Storage site not found');
    }

    try {
      await this.requireSiteAccess(userId, siteId, requireWrite);
      return site;
    } catch {
      if (site.siteType === 'ON_FARM' && site.farmId) {
        await this.farms.assertFarmAccess(userId, site.farmId, requireWrite);
        return site;
      }
      throw new ForbiddenException('No access to this storage site');
    }
  }

  private async requireSiteAccess(userId: string, siteId: string, requireWrite = false) {
    const profile = await this.requireFarmerProfile(userId);
    const party = await this.prisma.warehouseParty.findFirst({
      where: {
        storageSiteId: siteId,
        farmerProfileId: profile.id,
        status: 'ACTIVE',
      },
    });
    if (!party) throw new ForbiddenException('No access to this storage site');
    if (requireWrite && !WRITE_ROLES.includes(party.partyRole)) {
      throw new ForbiddenException('Write access required for this storage site');
    }
    return party;
  }

  private async requireFarmerProfile(userId: string) {
    const profile = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Farmer profile required');
    return profile;
  }

  private shapeSite(site: {
    id: string;
    code: string | null;
    name: string;
    nameAm: string | null;
    siteType: string;
    status: string;
    farmId: string | null;
    cooperativeId: string | null;
    region: string | null;
    regionEn: string | null;
    zone: string | null;
    woreda: string | null;
    kebele: string | null;
    centroidLat: unknown;
    centroidLng: unknown;
    capacity: unknown;
    capacityUnitCode: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: site.id,
      code: site.code,
      name: site.name,
      nameAm: site.nameAm,
      siteType: site.siteType,
      status: site.status,
      farmId: site.farmId,
      cooperativeId: site.cooperativeId,
      region: site.region,
      regionEn: site.regionEn,
      zone: site.zone,
      woreda: site.woreda,
      kebele: site.kebele,
      centroidLat: toNumber(site.centroidLat),
      centroidLng: toNumber(site.centroidLng),
      capacity: toNumber(site.capacity),
      capacityUnitCode: site.capacityUnitCode,
      notes: site.notes,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    };
  }
}
