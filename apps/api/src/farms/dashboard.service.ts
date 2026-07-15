import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from './farms.service';
import { CroppingCyclesService } from './cropping-cycles.service';
import { QueryDashboardDto } from './dto/dashboard.dto';

const OPEN_ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID_ESCROW'] as const;
const PRODUCTION_STATUSES = ['PLANNED', 'IN_PROGRESS', 'HARVESTED'] as const;
const LOT_STATUSES = ['AVAILABLE', 'RESERVED', 'QUARANTINE'] as const;
const ALERT_CAP = 20;

/** Amharic copy as unicode escapes (file-encoding safe). */
const AM = {
  noPlan:
    '\u1208\u12da\u1205\u0020\u12c8\u1245\u1275\u0020\u12e8\u121d\u122d\u1275\u0020\u12d5\u1245\u12f5\u0020\u12e8\u1208\u121d\u1362',
  lowA: '\u1208\u0020',
  lowB: '\u0020\u12dd\u1245\u1270\u129b\u0020\u12e8\u121a\u1308\u129d\u0020\u12ad\u121d\u127d\u1275\u1362',
  overdueA: '\u12e8\u121d\u122d\u1275\u0020\u12d5\u1245\u12f5\u0020\u0022',
  overdueB: '\u0022\u0020\u130a\u12dc\u12cd\u0020\u12a0\u120d\u134f\u120d\u1362',
  harvestA: '\u1208\u0020\u0022',
  harvestB:
    '\u0022\u0020\u12e8\u1218\u12b8\u122d\u0020\u130a\u12dc\u0020\u1260\u0031\u0034\u0020\u1240\u1293\u1275\u0020\u12cd\u1235\u1325\u0020\u1290\u12cd\u1362',
  ordersB:
    '\u0020\u12ad\u134d\u1275\u0020\u1275\u12d5\u12db\u12dd\u0028\u12ce\u127d\u0029\u0020\u12a5\u122d\u121d\u1303\u0020\u12ed\u1320\u1265\u1243\u1209\u1362',
};

function toNumber(value: unknown): number {
  return Number(value);
}

function availableQty(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

function utcToday(): Date {
  const t = new Date();
  t.setUTCHours(0, 0, 0, 0);
  return t;
}

function daysUntilEnd(endsOn: Date, today = utcToday()): number {
  const end = new Date(endsOn);
  end.setUTCHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

type Alert = {
  code: string;
  severity: 'INFO' | 'WARNING' | 'ACTION';
  section: string;
  messageEn: string;
  messageAm: string;
  ref?: Record<string, unknown>;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farms: FarmsService,
    private readonly cycles: CroppingCyclesService,
  ) {}

  async getDashboard(userId: string, query: QueryDashboardDto = {}) {
    const seasonYear = query.seasonYear ?? new Date().getUTCFullYear();
    const productLimit = Math.min(Math.max(query.productLimit ?? 5, 1), 20);
    const seasonCode = query.seasonCode?.trim()
      ? query.seasonCode.trim().toUpperCase()
      : undefined;

    if (seasonCode) {
      const code = await this.prisma.seasonCode.findUnique({
        where: { code: seasonCode },
      });
      if (!code || !code.isActive) {
        throw new BadRequestException('Inactive or unknown season code');
      }
    }

    let farmIds: string[];
    if (query.farmId) {
      await this.farms.assertFarmAccess(userId, query.farmId, false);
      const farm = await this.prisma.farm.findUnique({
        where: { id: query.farmId },
      });
      if (!farm) throw new NotFoundException('Farm not found');
      farmIds = [query.farmId];
    } else {
      const mine = await this.farms.listMine(userId);
      farmIds = (mine.data ?? mine).map((f: { id: string }) => f.id);
    }

    const farms = farmIds.length
      ? await this.prisma.farm.findMany({ where: { id: { in: farmIds } } })
      : [];

    const inventory = await this.buildInventory(farmIds, productLimit);
    const marketplace = await this.buildMarketplace(userId, farmIds, query.farmId);
    const productionBuilt = await this.buildProduction(
      userId,
      farmIds,
      seasonYear,
      seasonCode,
    );
    const alerts = this.buildAlerts(inventory, marketplace, productionBuilt);
    const { _cycleSummaries, ...production } = productionBuilt;
    void _cycleSummaries;

    return {
      asOf: new Date().toISOString(),
      scope: {
        farmId: query.farmId ?? null,
        seasonYear,
        seasonCode: seasonCode ?? null,
      },
      farm: {
        total: farms.length,
        active: farms.filter((f) => f.status === 'ACTIVE').length,
      },
      inventory,
      marketplace,
      production,
      alerts,
    };
  }

  private async buildInventory(farmIds: string[], productLimit: number) {
    if (farmIds.length === 0) {
      return { products: [], lotCount: 0, sitesWithStock: 0 };
    }

    const lots = await this.prisma.stockLot.findMany({
      where: {
        farmId: { in: farmIds },
        status: { in: [...LOT_STATUSES] },
      },
      include: { product: true },
    });

    const byProduct = new Map<
      string,
      {
        productId: string;
        productCode: string;
        productNameEn: string;
        unitCode: string;
        quantityOnHand: number;
        quantityReserved: number;
      }
    >();
    const sites = new Set<string>();

    for (const lot of lots) {
      const onHand = toNumber(lot.quantityOnHand);
      const reserved = toNumber(lot.quantityReserved);
      if (onHand <= 0 && reserved <= 0) continue;
      if (lot.storageSiteId) sites.add(lot.storageSiteId);

      const key = `${lot.productId}:${lot.unitCode}`;
      const row = byProduct.get(key) ?? {
        productId: lot.productId,
        productCode: lot.product.code,
        productNameEn: lot.product.nameEn,
        unitCode: lot.unitCode,
        quantityOnHand: 0,
        quantityReserved: 0,
      };
      row.quantityOnHand += onHand;
      row.quantityReserved += reserved;
      byProduct.set(key, row);
    }

    const products = [...byProduct.values()]
      .map((p) => ({
        ...p,
        quantityOnHand: round3(p.quantityOnHand),
        quantityReserved: round3(p.quantityReserved),
        quantityAvailable: round3(
          availableQty(p.quantityOnHand, p.quantityReserved),
        ),
      }))
      .sort((a, b) => b.quantityOnHand - a.quantityOnHand)
      .slice(0, productLimit);

    return {
      products,
      lotCount: lots.filter(
        (l) =>
          toNumber(l.quantityOnHand) > 0 || toNumber(l.quantityReserved) > 0,
      ).length,
      sitesWithStock: sites.size,
    };
  }

  private async buildMarketplace(
    userId: string,
    farmIds: string[],
    farmIdFilter?: string,
  ) {
    const profile = await this.prisma.farmerProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      return {
        activeListings: 0,
        offerOnlyListings: 0,
        stockBoundListings: 0,
        totalOfferQty: 0,
        totalReservedQty: 0,
        orders: {
          openAsSeller: 0,
          byStatus: {},
          openQuantity: 0,
          unitCode: 'KG',
        },
      };
    }

    const listingWhere: Record<string, unknown> = {
      farmerId: profile.id,
      status: 'ACTIVE',
    };
    if (farmIdFilter) {
      listingWhere.OR = [
        { farmId: farmIdFilter },
        { farmId: null, stockLot: { farmId: farmIdFilter } },
      ];
    }

    const listings = await this.prisma.listing.findMany({
      where: listingWhere,
      include: { stockLot: true },
    });

    let offerOnly = 0;
    let stockBound = 0;
    let totalOfferQty = 0;
    let totalReservedQty = 0;

    for (const listing of listings) {
      totalOfferQty += toNumber(listing.quantityKg);
      if (listing.stockLotId && listing.stockLot) {
        stockBound += 1;
        totalReservedQty += toNumber(listing.stockLot.quantityReserved);
      } else {
        offerOnly += 1;
      }
    }

    // Prefer lot reserved sum scoped to farms (avoids double-count across listings)
    if (farmIds.length > 0) {
      const lots = await this.prisma.stockLot.findMany({
        where: {
          farmId: { in: farmIds },
          status: { in: [...LOT_STATUSES] },
        },
        select: { quantityReserved: true },
      });
      totalReservedQty = lots.reduce(
        (s, l) => s + toNumber(l.quantityReserved),
        0,
      );
    }

    const orderWhere: Record<string, unknown> = {
      farmerId: profile.id,
      status: { in: [...OPEN_ORDER_STATUSES] },
    };
    if (farmIdFilter) {
      orderWhere.listing = {
        OR: [
          { farmId: farmIdFilter },
          { farmId: null, stockLot: { farmId: farmIdFilter } },
        ],
      };
    }

    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      select: { status: true, quantityKg: true },
    });

    const byStatus: Record<string, number> = {};
    let openQuantity = 0;
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      openQuantity += toNumber(o.quantityKg);
    }

    return {
      activeListings: listings.length,
      offerOnlyListings: offerOnly,
      stockBoundListings: stockBound,
      totalOfferQty: round3(totalOfferQty),
      totalReservedQty: round3(totalReservedQty),
      orders: {
        openAsSeller: orders.length,
        byStatus,
        openQuantity: round3(openQuantity),
        unitCode: 'KG',
      },
    };
  }

  private async buildProduction(
    userId: string,
    farmIds: string[],
    seasonYear: number,
    seasonCode?: string,
  ) {
    if (farmIds.length === 0) {
      return {
        activeCycles: 0,
        lines: [],
        emptyState: {
          code: 'NO_CURRENT_PLAN',
          messageEn: 'No production plan for this season yet.',
          messageAm: AM.noPlan,
        },
      };
    }

    const cycles = await this.prisma.croppingCycle.findMany({
      where: {
        farmId: { in: farmIds },
        seasonYear,
        ...(seasonCode ? { seasonCode } : {}),
        status: { in: [...PRODUCTION_STATUSES] },
      },
      include: {
        lines: { include: { product: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ endsOn: 'asc' }, { name: 'asc' }],
    });

    const lines: Array<Record<string, unknown>> = [];
    const cycleSummaries: Array<{
      cycleId: string;
      name: string;
      status: string;
      endsOn: Date;
      maxAttainment: number;
    }> = [];

    for (const cycle of cycles) {
      const perf = await this.cycles.performance(userId, cycle.id);
      let maxAttainment = 0;
      for (const line of perf.lines) {
        const pct = line.attainmentPct == null ? 0 : Number(line.attainmentPct);
        if (pct > maxAttainment) maxAttainment = pct;
        lines.push({
          cycleId: cycle.id,
          cycleName: cycle.name,
          seasonYear: cycle.seasonYear,
          seasonCode: cycle.seasonCode,
          status: cycle.status,
          endsOn: cycle.endsOn,
          productId: line.productId,
          productCode: line.productCode,
          plannedQty: line.plannedQty,
          actualQty: line.actualQty,
          attainmentPct: line.attainmentPct,
          unitCode: line.unitCode,
        });
      }
      if (perf.lines.length === 0) {
        cycleSummaries.push({
          cycleId: cycle.id,
          name: cycle.name,
          status: cycle.status,
          endsOn: cycle.endsOn,
          maxAttainment: 0,
        });
      } else {
        cycleSummaries.push({
          cycleId: cycle.id,
          name: cycle.name,
          status: cycle.status,
          endsOn: cycle.endsOn,
          maxAttainment,
        });
      }
    }

    const emptyState =
      cycles.length === 0
        ? {
            code: 'NO_CURRENT_PLAN',
            messageEn: 'No production plan for this season yet.',
            messageAm: AM.noPlan,
          }
        : null;

    return {
      activeCycles: cycles.length,
      lines,
      emptyState,
      _cycleSummaries: cycleSummaries,
    };
  }

  private buildAlerts(
    inventory: {
      products: Array<{
        productId: string;
        productCode: string;
        quantityOnHand: number;
        quantityReserved: number;
        quantityAvailable: number;
      }>;
    },
    marketplace: { orders: { openAsSeller: number } },
    production: {
      lines: Array<Record<string, unknown>>;
      _cycleSummaries?: Array<{
        cycleId: string;
        name: string;
        status: string;
        endsOn: Date;
        maxAttainment: number;
      }>;
    },
  ) {
    const alerts: Alert[] = [];
    const today = utcToday();

    for (const p of inventory.products) {
      const oh = p.quantityOnHand;
      const rs = p.quantityReserved;
      const avail = p.quantityAvailable;
      const low =
        (avail <= 0 && (oh > 0 || rs > 0)) || (oh > 0 && avail < oh * 0.1);
      if (!low) continue;
      alerts.push({
        code: 'LOW_INVENTORY',
        severity: 'WARNING',
        section: 'inventory',
        messageEn: `Low available stock for ${p.productCode}.`,
        messageAm: `${AM.lowA}${p.productCode}${AM.lowB}`,
        ref: { productId: p.productId, productCode: p.productCode },
      });
    }

    for (const c of production._cycleSummaries ?? []) {
      const days = daysUntilEnd(c.endsOn, today);
      if (
        (c.status === 'PLANNED' || c.status === 'IN_PROGRESS') &&
        days < 0 &&
        c.maxAttainment < 100
      ) {
        alerts.push({
          code: 'OVERDUE_PRODUCTION_PLAN',
          severity: 'ACTION',
          section: 'production',
          messageEn: `Production plan "${c.name}" is overdue.`,
          messageAm: `${AM.overdueA}${c.name}${AM.overdueB}`,
          ref: { cycleId: c.cycleId },
        });
      } else if (
        (c.status === 'PLANNED' || c.status === 'IN_PROGRESS') &&
        days >= 0 &&
        days <= 14
      ) {
        alerts.push({
          code: 'UPCOMING_HARVEST',
          severity: 'INFO',
          section: 'production',
          messageEn: `Harvest window for "${c.name}" is within 14 days.`,
          messageAm: `${AM.harvestA}${c.name}${AM.harvestB}`,
          ref: { cycleId: c.cycleId, daysUntilEnd: days },
        });
      }
    }

    if (marketplace.orders.openAsSeller > 0) {
      alerts.push({
        code: 'OPEN_ORDERS_AWAITING_ACTION',
        severity: 'ACTION',
        section: 'marketplace',
        messageEn: `You have ${marketplace.orders.openAsSeller} open order(s) awaiting action.`,
        messageAm: `${marketplace.orders.openAsSeller}${AM.ordersB}`,
        ref: { openAsSeller: marketplace.orders.openAsSeller },
      });
    }

    const severityRank = (s: Alert['severity']) =>
      s === 'ACTION' ? 0 : s === 'WARNING' ? 1 : 2;

    const capped = [...alerts]
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
      .slice(0, ALERT_CAP);

    // Strip internal cycle summaries from production response caller-side
    return capped;
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
