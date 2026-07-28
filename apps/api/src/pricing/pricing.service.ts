import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildOrderMoneySnapshot,
  computeDeliveryCommission,
  computeDeliveryFee,
  type OrderMoneySnapshot,
} from './pricing.rules';

export const PRICING_FLAGS = {
  v1: 'pricing.v1.enabled',
  dynamicDelivery: 'delivery.dynamic_fee.enabled',
} as const;

const QUOTE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async isPricingEnabled(): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { code: PRICING_FLAGS.v1 },
    });
    return flag?.enabled ?? true;
  }

  async isDynamicDeliveryEnabled(): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { code: PRICING_FLAGS.dynamicDelivery },
    });
    // Default OFF until routing + vehicle selection + real distance ship.
    return flag?.enabled ?? false;
  }

  async getActiveSchedule() {
    const schedule = await this.prisma.feeSchedule.findFirst({
      where: {
        isActive: true,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      include: {
        platformFees: true,
        deliveryCommissions: true,
        deliveryTariffs: { where: { isActive: true } },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    });
    if (!schedule) {
      throw new NotFoundException('No active fee schedule configured');
    }
    return schedule;
  }

  async resolveMarketplaceSnapshot(goodsSubtotalEtb: number): Promise<{
    scheduleId: string;
    snapshot: OrderMoneySnapshot;
    buyerFeePct: number;
    farmerFeePct: number;
  }> {
    const enabled = await this.isPricingEnabled();
    if (!enabled) {
      const legacy = buildOrderMoneySnapshot({
        goodsSubtotalEtb,
        rates: { buyerFeePct: 0, farmerFeePct: 2 },
      });
      return {
        scheduleId: '',
        snapshot: legacy,
        buyerFeePct: 0,
        farmerFeePct: 2,
      };
    }

    const schedule = await this.getActiveSchedule();
    const buyerFeePct = Number(schedule.platformFees?.buyerFeePct ?? 0);
    const farmerFeePct = Number(schedule.platformFees?.farmerFeePct ?? 0);
    const snapshot = buildOrderMoneySnapshot({
      goodsSubtotalEtb,
      rates: { buyerFeePct, farmerFeePct },
    });
    return {
      scheduleId: schedule.id,
      snapshot,
      buyerFeePct,
      farmerFeePct,
    };
  }

  async createDeliveryQuote(input: {
    buyerUserId: string;
    vehicleType: string;
    distanceKm: number;
    weightKg: number;
    volumeM3?: number;
  }) {
    if (!(await this.isDynamicDeliveryEnabled())) {
      throw new BadRequestException('Dynamic delivery fees are disabled');
    }
    const vehicleType = (input.vehicleType || 'MOTORBIKE').toUpperCase();
    const schedule = await this.getActiveSchedule();
    const tariff = schedule.deliveryTariffs.find((t) => t.vehicleType === vehicleType);
    if (!tariff) {
      throw new BadRequestException(`No delivery tariff for vehicle type ${vehicleType}`);
    }

    const deliveryFeeEtb = computeDeliveryFee(
      {
        baseFareEtb: Number(tariff.baseFareEtb),
        perKmEtb: Number(tariff.perKmEtb),
        perKgEtb: Number(tariff.perKgEtb),
        perM3Etb: Number(tariff.perM3Etb),
        minFareEtb: Number(tariff.minFareEtb),
        maxFareEtb: tariff.maxFareEtb != null ? Number(tariff.maxFareEtb) : null,
      },
      {
        distanceKm: input.distanceKm,
        weightKg: input.weightKg,
        volumeM3: input.volumeM3 ?? 0,
      },
    );

    const commission = schedule.deliveryCommissions;
    const split = computeDeliveryCommission(deliveryFeeEtb, {
      commissionType: commission?.commissionType ?? 'PERCENT',
      commissionValue: Number(commission?.commissionValue ?? 0),
    });

    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);
    const row = await this.prisma.deliveryQuote.create({
      data: {
        feeScheduleId: schedule.id,
        buyerUserId: input.buyerUserId,
        vehicleType,
        distanceKm: input.distanceKm,
        weightKg: input.weightKg,
        volumeM3: input.volumeM3 ?? 0,
        deliveryFeeEtb,
        deliveryCommissionEtb: split.deliveryCommissionEtb,
        courierPayoutEtb: split.courierPayoutEtb,
        expiresAt,
        metadataJson: {
          tariffId: tariff.id,
          commissionType: commission?.commissionType ?? 'PERCENT',
          commissionValue: Number(commission?.commissionValue ?? 0),
        },
      },
    });

    return this.shapeQuote(row);
  }

  async consumeQuoteForOrder(input: {
    quoteId: string;
    buyerUserId: string;
    orderId: string;
  }) {
    const quote = await this.prisma.deliveryQuote.findUnique({
      where: { id: input.quoteId },
    });
    if (!quote) {
      throw new BadRequestException('Delivery quote not found');
    }
    if (quote.buyerUserId && quote.buyerUserId !== input.buyerUserId) {
      throw new BadRequestException('Delivery quote does not belong to this buyer');
    }
    if (quote.orderId && quote.orderId !== input.orderId) {
      throw new BadRequestException('Delivery quote already bound to another order');
    }
    if (quote.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Delivery quote has expired; request a new quote');
    }

    if (!quote.orderId) {
      await this.prisma.deliveryQuote.update({
        where: { id: quote.id },
        data: { orderId: input.orderId },
      });
    }

    return {
      deliveryFeeEtb: Number(quote.deliveryFeeEtb),
      deliveryCommissionEtb: Number(quote.deliveryCommissionEtb),
      courierPayoutEtb: Number(quote.courierPayoutEtb),
      feeScheduleId: quote.feeScheduleId,
      quoteId: quote.id,
    };
  }

  async listSchedules() {
    const rows = await this.prisma.feeSchedule.findMany({
      include: {
        platformFees: true,
        deliveryCommissions: true,
        deliveryTariffs: { orderBy: { vehicleType: 'asc' } },
      },
      orderBy: [{ isActive: 'desc' }, { version: 'desc' }],
    });
    return rows.map((s) => this.shapeSchedule(s));
  }

  async updateActivePlatformFees(input: {
    buyerFeePct: number;
    farmerFeePct: number;
  }) {
    if (input.buyerFeePct < 0 || input.buyerFeePct > 100) {
      throw new BadRequestException('buyerFeePct must be between 0 and 100');
    }
    if (input.farmerFeePct < 0 || input.farmerFeePct > 100) {
      throw new BadRequestException('farmerFeePct must be between 0 and 100');
    }
    const schedule = await this.getActiveSchedule();
    await this.prisma.platformFee.upsert({
      where: { feeScheduleId: schedule.id },
      create: {
        feeScheduleId: schedule.id,
        buyerFeePct: input.buyerFeePct,
        farmerFeePct: input.farmerFeePct,
      },
      update: {
        buyerFeePct: input.buyerFeePct,
        farmerFeePct: input.farmerFeePct,
        updatedAt: new Date(),
      },
    });
    return this.listSchedules();
  }

  async updateDeliveryCommission(input: {
    commissionType: 'PERCENT' | 'FIXED';
    commissionValue: number;
  }) {
    if (input.commissionValue < 0) {
      throw new BadRequestException('commissionValue must be >= 0');
    }
    const schedule = await this.getActiveSchedule();
    await this.prisma.deliveryCommission.upsert({
      where: { feeScheduleId: schedule.id },
      create: {
        feeScheduleId: schedule.id,
        commissionType: input.commissionType,
        commissionValue: input.commissionValue,
      },
      update: {
        commissionType: input.commissionType,
        commissionValue: input.commissionValue,
        updatedAt: new Date(),
      },
    });
    return this.listSchedules();
  }

  async upsertDeliveryTariff(input: {
    vehicleType: string;
    baseFareEtb: number;
    perKmEtb: number;
    perKgEtb: number;
    perM3Etb?: number;
    minFareEtb: number;
    maxFareEtb?: number | null;
    isActive?: boolean;
  }) {
    const vehicleType = input.vehicleType.toUpperCase();
    const schedule = await this.getActiveSchedule();
    await this.prisma.deliveryTariff.upsert({
      where: {
        feeScheduleId_vehicleType: {
          feeScheduleId: schedule.id,
          vehicleType,
        },
      },
      create: {
        feeScheduleId: schedule.id,
        vehicleType,
        baseFareEtb: input.baseFareEtb,
        perKmEtb: input.perKmEtb,
        perKgEtb: input.perKgEtb,
        perM3Etb: input.perM3Etb ?? 0,
        minFareEtb: input.minFareEtb,
        maxFareEtb: input.maxFareEtb ?? null,
        isActive: input.isActive ?? true,
      },
      update: {
        baseFareEtb: input.baseFareEtb,
        perKmEtb: input.perKmEtb,
        perKgEtb: input.perKgEtb,
        perM3Etb: input.perM3Etb ?? 0,
        minFareEtb: input.minFareEtb,
        maxFareEtb: input.maxFareEtb ?? null,
        isActive: input.isActive ?? true,
        updatedAt: new Date(),
      },
    });
    return this.listSchedules();
  }

  private shapeQuote(row: any) {
    return {
      id: row.id,
      feeScheduleId: row.feeScheduleId,
      vehicleType: row.vehicleType,
      distanceKm: Number(row.distanceKm),
      weightKg: Number(row.weightKg),
      volumeM3: Number(row.volumeM3),
      deliveryFeeEtb: Number(row.deliveryFeeEtb),
      deliveryCommissionEtb: Number(row.deliveryCommissionEtb),
      courierPayoutEtb: Number(row.courierPayoutEtb),
      currency: row.currency,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  private shapeSchedule(s: any) {
    return {
      id: s.id,
      code: s.code,
      displayName: s.displayName,
      version: s.version,
      isActive: s.isActive,
      effectiveFrom: s.effectiveFrom,
      effectiveTo: s.effectiveTo,
      platformFees: s.platformFees
        ? {
            buyerFeePct: Number(s.platformFees.buyerFeePct),
            farmerFeePct: Number(s.platformFees.farmerFeePct),
          }
        : null,
      deliveryCommission: s.deliveryCommissions
        ? {
            commissionType: s.deliveryCommissions.commissionType,
            commissionValue: Number(s.deliveryCommissions.commissionValue),
          }
        : null,
      deliveryTariffs: (s.deliveryTariffs || []).map((t: any) => ({
        id: t.id,
        vehicleType: t.vehicleType,
        baseFareEtb: Number(t.baseFareEtb),
        perKmEtb: Number(t.perKmEtb),
        perKgEtb: Number(t.perKgEtb),
        perM3Etb: Number(t.perM3Etb),
        minFareEtb: Number(t.minFareEtb),
        maxFareEtb: t.maxFareEtb != null ? Number(t.maxFareEtb) : null,
        isActive: t.isActive,
      })),
    };
  }
}
