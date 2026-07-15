import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LotStatus, MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from '../farms/farms.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import {
  CreateMovementDto,
  QueryBalancesDto,
  QueryLotsDto,
  ReceiveStockDto,
} from './dto/inventory.dto';

function toNumber(value: unknown): number {
  return Number(value);
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farms: FarmsService,
    private readonly warehouse: WarehouseService,
  ) {}

  async listLots(userId: string, query: QueryLotsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const accessibleFarmIds = await this.accessibleFarmIds(userId);
    if (accessibleFarmIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
    }

    let productId: string | undefined;
    if (query.productCode) {
      const product = await this.prisma.product.findFirst({
        where: { code: query.productCode.toUpperCase(), status: 'ACTIVE' },
      });
      if (!product) {
        return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
      }
      productId = product.id;
    }

    if (query.farmId && !accessibleFarmIds.includes(query.farmId)) {
      throw new NotFoundException('Farm not found');
    }

    const where: Prisma.StockLotWhereInput = {
      farmId: query.farmId ? query.farmId : { in: accessibleFarmIds },
      ...(productId ? { productId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.storageSiteId ? { storageSiteId: query.storageSiteId } : {}),
    };

    const [lots, total] = await Promise.all([
      this.prisma.stockLot.findMany({
        where,
        include: { product: true, unit: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockLot.count({ where }),
    ]);

    return {
      data: lots.map((lot) => this.shapeLot(lot)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getLot(userId: string, lotId: string) {
    const lot = await this.prisma.stockLot.findUnique({
      where: { id: lotId },
      include: { product: true, unit: true },
    });
    if (!lot) throw new NotFoundException('Lot not found');
    await this.farms.assertFarmAccess(userId, lot.farmId, false);

    const movements = await this.prisma.stockMovement.findMany({
      where: { lotId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      ...this.shapeLot(lot),
      movements: movements.map((m) => this.shapeMovement(m)),
    };
  }

  async listMovements(userId: string, lotId: string) {
    const lot = await this.requireLotAccess(userId, lotId, false);
    const movements = await this.prisma.stockMovement.findMany({
      where: { lotId: lot.id },
      orderBy: { createdAt: 'asc' },
    });
    return { data: movements.map((m) => this.shapeMovement(m)) };
  }

  async balances(userId: string, query: QueryBalancesDto) {
    const accessibleFarmIds = await this.accessibleFarmIds(userId);
    if (accessibleFarmIds.length === 0) return { data: [] };

    if (query.farmId && !accessibleFarmIds.includes(query.farmId)) {
      throw new NotFoundException('Farm not found');
    }

    let productId: string | undefined;
    if (query.productCode) {
      const product = await this.prisma.product.findFirst({
        where: { code: query.productCode.toUpperCase(), status: 'ACTIVE' },
      });
      if (!product) return { data: [] };
      productId = product.id;
    }

    const lots = await this.prisma.stockLot.findMany({
      where: {
        farmId: query.farmId ? query.farmId : { in: accessibleFarmIds },
        ...(productId ? { productId } : {}),
        ...(query.storageSiteId ? { storageSiteId: query.storageSiteId } : {}),
        status: { in: ['AVAILABLE', 'RESERVED', 'QUARANTINE'] },
      },
      include: { product: true, unit: true },
    });

    const map = new Map<
      string,
      {
        farmId: string;
        storageSiteId: string | null;
        productCode: string;
        productNameEn: string;
        unitCode: string;
        quantityOnHand: number;
        quantityReserved: number;
      }
    >();

    for (const lot of lots) {
      const key = `${lot.farmId}:${lot.storageSiteId ?? '_'}:${lot.productId}:${lot.unitCode}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantityOnHand += toNumber(lot.quantityOnHand);
        existing.quantityReserved += toNumber(lot.quantityReserved);
      } else {
        map.set(key, {
          farmId: lot.farmId,
          storageSiteId: lot.storageSiteId,
          productCode: lot.product.code,
          productNameEn: lot.product.nameEn,
          unitCode: lot.unitCode,
          quantityOnHand: toNumber(lot.quantityOnHand),
          quantityReserved: toNumber(lot.quantityReserved),
        });
      }
    }

    return { data: [...map.values()] };
  }

  async receive(userId: string, dto: ReceiveStockDto) {
    await this.farms.assertFarmAccess(userId, dto.farmId, true);

    if (dto.plotId) {
      const plot = await this.prisma.plot.findFirst({
        where: { id: dto.plotId, farmId: dto.farmId },
      });
      if (!plot) throw new BadRequestException('Plot not found on this farm');
    }

    if (dto.storageSiteId) {
      const site = await this.warehouse.assertSiteUsable(userId, dto.storageSiteId, true);
      if (site.siteType === 'ON_FARM' && site.farmId && site.farmId !== dto.farmId) {
        throw new BadRequestException('Storage site does not belong to this farm');
      }
    }

    const product = await this.prisma.product.findFirst({
      where: { code: dto.productCode.toUpperCase(), status: 'ACTIVE' },
      include: { defaultUnit: true },
    });
    if (!product) {
      throw new BadRequestException('This product is not available yet');
    }

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
    const qtyInLotUnit = await this.convertQty(
      dto.qty,
      unitCode,
      product.defaultUnitCode,
      product.defaultUnit.dimension,
    );
    const lotUnit = product.defaultUnitCode;

    const lotCode =
      dto.lotCode?.trim() ||
      `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

    const status: LotStatus = dto.quarantine ? 'QUARANTINE' : 'AVAILABLE';

    const lot = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stockLot.create({
        data: {
          lotCode,
          productId: product.id,
          productVarietyId: varietyId,
          farmId: dto.farmId,
          plotId: dto.plotId,
          unitCode: lotUnit,
          quantityOnHand: qtyInLotUnit,
          status,
          sourceType: dto.sourceType ?? 'HARVEST',
          harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : undefined,
          expiresOn: dto.expiresOn ? new Date(dto.expiresOn) : undefined,
          qualityNote: dto.qualityNote,
          storageLabel: dto.storageLabel,
          storageSiteId: dto.storageSiteId,
          externalRef: dto.externalRef,
        },
        include: { product: true, unit: true },
      });

      await tx.stockMovement.create({
        data: {
          lotId: created.id,
          movementType: 'RECEIVE',
          qty: dto.qty,
          unitCode,
          qtyInLotUnit,
          reason: 'Stock receive',
          actorUserId: userId,
          toStorageSiteId: dto.storageSiteId,
        },
      });

      return created;
    });

    return this.shapeLot(lot);
  }

  async createMovement(userId: string, dto: CreateMovementDto) {
    const allowed: MovementType[] = [
      'ADJUST_IN',
      'ADJUST_OUT',
      'LOSS',
      'TRANSFER_OUT',
      'RELOCATE',
    ];
    if (!allowed.includes(dto.type)) {
      throw new BadRequestException(
        'Unsupported movement type. Use RECEIVE via /inventory/receive.',
      );
    }

    const lot = await this.requireLotAccess(userId, dto.lotId, true);
    if (!['AVAILABLE', 'QUARANTINE'].includes(lot.status) && dto.type !== 'ADJUST_IN') {
      throw new BadRequestException(`Cannot apply ${dto.type} to lot in status ${lot.status}`);
    }

    if (dto.type === 'RELOCATE') {
      return this.relocate(userId, lot, dto);
    }

    if (dto.qty === undefined || dto.qty < 0.001) {
      throw new BadRequestException('qty must be at least 0.001 for this movement type');
    }
    const qty = dto.qty;

    const unitCode = (dto.unitCode ?? lot.unitCode).toUpperCase();
    const qtyInLotUnit = await this.convertQty(
      qty,
      unitCode,
      lot.unitCode,
      lot.unit.dimension,
    );

    if (dto.type === 'TRANSFER_OUT') {
      return this.transferOut(userId, lot, dto, qty, qtyInLotUnit, unitCode);
    }

    const signed =
      dto.type === 'ADJUST_IN' ? qtyInLotUnit : -qtyInLotUnit;

    if (toNumber(lot.quantityOnHand) + signed < 0) {
      throw new BadRequestException('Insufficient quantity on hand');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextQty = toNumber(lot.quantityOnHand) + signed;
      const nextStatus =
        nextQty === 0 && dto.type !== 'ADJUST_IN'
          ? dto.type === 'LOSS'
            ? 'DAMAGED'
            : 'DEPLETED'
          : lot.status;

      const movement = await tx.stockMovement.create({
        data: {
          lotId: lot.id,
          movementType: dto.type,
          qty,
          unitCode,
          qtyInLotUnit: signed,
          reason: dto.reason,
          actorUserId: userId,
        },
      });

      const saved = await tx.stockLot.update({
        where: { id: lot.id },
        data: {
          quantityOnHand: nextQty,
          status: nextStatus as LotStatus,
          updatedAt: new Date(),
        },
        include: { product: true, unit: true },
      });

      return { saved, movement };
    });

    return {
      lot: this.shapeLot(updated.saved),
      movement: this.shapeMovement(updated.movement),
    };
  }

  private async relocate(
    userId: string,
    lot: Prisma.StockLotGetPayload<{ include: { product: true; unit: true } }>,
    dto: CreateMovementDto,
  ) {
    if (!dto.toStorageSiteId) {
      throw new BadRequestException('toStorageSiteId is required for RELOCATE');
    }
    if (lot.storageSiteId === dto.toStorageSiteId) {
      throw new BadRequestException('Lot is already at this storage site');
    }

    const toSite = await this.warehouse.assertSiteUsable(userId, dto.toStorageSiteId, true);
    if (toSite.siteType === 'ON_FARM' && toSite.farmId && toSite.farmId !== lot.farmId) {
      throw new BadRequestException(
        'ON_FARM destination must belong to the lot farm; use TRANSFER_OUT for farm change',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          lotId: lot.id,
          movementType: 'RELOCATE',
          qty: 0,
          unitCode: lot.unitCode,
          qtyInLotUnit: 0,
          reason: dto.reason ?? 'Relocate storage site',
          actorUserId: userId,
          fromStorageSiteId: lot.storageSiteId,
          toStorageSiteId: dto.toStorageSiteId,
        },
      });

      const saved = await tx.stockLot.update({
        where: { id: lot.id },
        data: {
          storageSiteId: dto.toStorageSiteId,
          updatedAt: new Date(),
        },
        include: { product: true, unit: true },
      });

      return { saved, movement };
    });

    return {
      lot: this.shapeLot(result.saved),
      movement: this.shapeMovement(result.movement),
    };
  }

  private async transferOut(
    userId: string,
    sourceLot: Prisma.StockLotGetPayload<{ include: { product: true; unit: true } }>,
    dto: CreateMovementDto,
    qty: number,
    qtyInLotUnit: number,
    unitCode: string,
  ) {
    if (!dto.toFarmId) {
      throw new BadRequestException('toFarmId is required for TRANSFER_OUT');
    }
    await this.farms.assertFarmAccess(userId, dto.toFarmId, true);

    if (dto.toPlotId) {
      const plot = await this.prisma.plot.findFirst({
        where: { id: dto.toPlotId, farmId: dto.toFarmId },
      });
      if (!plot) throw new BadRequestException('Destination plot not found on farm');
    }

    if (toNumber(sourceLot.quantityOnHand) < qtyInLotUnit) {
      throw new BadRequestException('Insufficient quantity on hand');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const outMovement = await tx.stockMovement.create({
        data: {
          lotId: sourceLot.id,
          movementType: 'TRANSFER_OUT',
          qty,
          unitCode,
          qtyInLotUnit: -qtyInLotUnit,
          reason: dto.reason ?? 'Transfer out',
          actorUserId: userId,
        },
      });

      const sourceNext = toNumber(sourceLot.quantityOnHand) - qtyInLotUnit;
      const sourceUpdated = await tx.stockLot.update({
        where: { id: sourceLot.id },
        data: {
          quantityOnHand: sourceNext,
          status: sourceNext === 0 ? 'DEPLETED' : sourceLot.status,
          updatedAt: new Date(),
        },
        include: { product: true, unit: true },
      });

      const destLotCode = `LOT-XFER-${Date.now().toString(36).toUpperCase()}`;
      const destLot = await tx.stockLot.create({
        data: {
          lotCode: destLotCode,
          productId: sourceLot.productId,
          productVarietyId: sourceLot.productVarietyId,
          farmId: dto.toFarmId!,
          plotId: dto.toPlotId,
          unitCode: sourceLot.unitCode,
          quantityOnHand: qtyInLotUnit,
          status: 'AVAILABLE',
          sourceType: 'TRANSFER_IN',
          qualityNote: sourceLot.qualityNote,
          storageLabel: undefined,
        },
        include: { product: true, unit: true },
      });

      const inMovement = await tx.stockMovement.create({
        data: {
          lotId: destLot.id,
          movementType: 'TRANSFER_IN',
          qty,
          unitCode,
          qtyInLotUnit,
          reason: dto.reason ?? 'Transfer in',
          actorUserId: userId,
          counterpartMovementId: outMovement.id,
        },
      });

      await tx.stockMovement.update({
        where: { id: outMovement.id },
        data: { counterpartMovementId: inMovement.id },
      });

      return { sourceUpdated, destLot, outMovement, inMovement };
    });

    return {
      sourceLot: this.shapeLot(result.sourceUpdated),
      destinationLot: this.shapeLot(result.destLot),
      movements: [
        this.shapeMovement(result.outMovement),
        this.shapeMovement({
          ...result.inMovement,
          counterpartMovementId: result.outMovement.id,
        }),
      ],
    };
  }

  private async accessibleFarmIds(userId: string): Promise<string[]> {
    const profile = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!profile) return [];
    const parties = await this.prisma.farmParty.findMany({
      where: { farmerProfileId: profile.id, status: 'ACTIVE' },
      select: { farmId: true },
    });
    return [...new Set(parties.map((p) => p.farmId))];
  }

  private async requireLotAccess(userId: string, lotId: string, requireWrite: boolean) {
    const lot = await this.prisma.stockLot.findUnique({
      where: { id: lotId },
      include: { product: true, unit: true },
    });
    if (!lot) throw new NotFoundException('Lot not found');
    await this.farms.assertFarmAccess(userId, lot.farmId, requireWrite);
    return lot;
  }

  /** Convert qty from `fromUnit` into `toUnit` (same dimension via identity or conversion). */
  private async convertQty(
    qty: number,
    fromUnit: string,
    toUnit: string,
    expectedDimension: string,
  ): Promise<number> {
    const from = fromUnit.toUpperCase();
    const to = toUnit.toUpperCase();

    const fromRow = await this.prisma.unit.findUnique({ where: { code: from } });
    const toRow = await this.prisma.unit.findUnique({ where: { code: to } });
    if (!fromRow || !toRow) {
      throw new BadRequestException('Unknown unit code');
    }
    if (fromRow.dimension !== toRow.dimension || fromRow.dimension !== expectedDimension) {
      throw new BadRequestException(
        'Unit dimension does not match product default unit dimension',
      );
    }
    if (from === to) return qty;

    const direct = await this.prisma.unitConversion.findUnique({
      where: {
        fromUnitCode_toUnitCode: { fromUnitCode: from, toUnitCode: to },
      },
    });
    if (direct) return qty * toNumber(direct.factor);

    const inverse = await this.prisma.unitConversion.findUnique({
      where: {
        fromUnitCode_toUnitCode: { fromUnitCode: to, toUnitCode: from },
      },
    });
    if (inverse) return qty / toNumber(inverse.factor);

    throw new BadRequestException(
      `No conversion defined between ${from} and ${to}`,
    );
  }

  private shapeLot(
    lot: Prisma.StockLotGetPayload<{ include: { product: true; unit: true } }>,
  ) {
    return {
      id: lot.id,
      lotCode: lot.lotCode,
      productId: lot.productId,
      productCode: lot.product.code,
      productNameEn: lot.product.nameEn,
      productNameAm: lot.product.nameAm,
      farmId: lot.farmId,
      plotId: lot.plotId,
      storageSiteId: lot.storageSiteId,
      storageLabel: lot.storageLabel,
      unitCode: lot.unitCode,
      unitNameEn: lot.unit.nameEn,
      quantityOnHand: toNumber(lot.quantityOnHand),
      quantityReserved: toNumber(lot.quantityReserved),
      status: lot.status,
      sourceType: lot.sourceType,
      harvestDate: lot.harvestDate,
      receivedAt: lot.receivedAt,
      expiresOn: lot.expiresOn,
      qualityNote: lot.qualityNote,
      externalRef: lot.externalRef,
      createdAt: lot.createdAt,
    };
  }

  private shapeMovement(m: {
    id: string;
    lotId: string;
    movementType: string;
    qty: unknown;
    unitCode: string;
    qtyInLotUnit: unknown;
    reason: string | null;
    actorUserId: string | null;
    listingId: string | null;
    orderId: string | null;
    counterpartMovementId: string | null;
    fromStorageSiteId?: string | null;
    toStorageSiteId?: string | null;
    createdAt: Date;
  }) {
    return {
      id: m.id,
      lotId: m.lotId,
      movementType: m.movementType,
      qty: toNumber(m.qty),
      unitCode: m.unitCode,
      qtyInLotUnit: toNumber(m.qtyInLotUnit),
      reason: m.reason,
      actorUserId: m.actorUserId,
      listingId: m.listingId,
      orderId: m.orderId,
      counterpartMovementId: m.counterpartMovementId,
      fromStorageSiteId: m.fromStorageSiteId ?? null,
      toStorageSiteId: m.toStorageSiteId ?? null,
      createdAt: m.createdAt,
    };
  }
}
