import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CertificatesService } from '../certificates/certificates.service';
import { ReservationsService } from '../inventory/reservations.service';
import {
  OrderContractError,
  resolveOrderQuantity,
} from './order-contract.rules';
import { buildCoffeeExtension } from '../marketplace/listing-contract.rules';

const COMMISSION_RATE = 0.02; // 2% — matches the existing Nahu Buna Gebaya commission model

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificates: CertificatesService,
    private readonly payments: PaymentsService,
    private readonly reservations: ReservationsService,
  ) {}

  async createOrder(buyerId: string, dto: CreateOrderDto) {
    if (!this.payments.isActive(dto.paymentMethod)) {
      throw new BadRequestException(
        'This payment method is not available yet. Please choose Telebirr or CBE Birr.',
      );
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      include: { category: true, product: { include: { defaultUnit: true } } },
    });

    if (!listing || listing.status !== 'ACTIVE') {
      throw new BadRequestException('Listing not found or no longer available');
    }

    let resolved;
    try {
      resolved = resolveOrderQuantity(
        {
          quantity: dto.quantity,
          unitCode: dto.unitCode,
          quantityKg: dto.quantityKg,
        },
        {
          quantity: listing.quantity != null ? Number(listing.quantity) : null,
          unitCode: listing.unitCode,
          quantityKg: Number(listing.quantityKg),
          pricePerUnit: listing.pricePerUnit != null ? Number(listing.pricePerUnit) : null,
          pricePerKg: Number(listing.pricePerKg),
        },
      );
    } catch (err) {
      if (err instanceof OrderContractError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const totalEtb = resolved.totalEtb;
    const commissionEtb = totalEtb * COMMISSION_RATE;
    const farmerPayoutEtb = totalEtb - commissionEtb;
    const reference = `NBG-${Date.now().toString(16).toUpperCase().slice(-8)}`;

    const available = Number(listing.quantity ?? listing.quantityKg);
    const remaining = available - resolved.quantity;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          listingId: listing.id,
          buyerId,
          farmerId: listing.farmerId,
          quantity: resolved.quantity,
          unitCode: resolved.unitCode,
          pricePerUnit: resolved.pricePerUnit,
          quantityKg: resolved.quantityKg,
          totalEtb,
          commissionEtb,
          farmerPayoutEtb,
          paymentMethod: dto.paymentMethod,
          paymentReference: reference,
          deliveryAddress: dto.deliveryAddress,
        },
      });

      await tx.listing.update({
        where: { id: listing.id },
        data:
          remaining > 0
            ? {
                quantity: remaining,
                quantityKg: remaining,
                status: 'ACTIVE',
              }
            : {
                quantity: 0,
                quantityKg: 0,
                status: 'RESERVED',
              },
      });

      await this.reservations.transferListingHoldToOrderTx(tx, {
        listingId: listing.id,
        orderId: created.id,
        qty: resolved.quantity,
        actorUserId: buyerId,
      });

      return created;
    });

    return {
      order: this.shapeOrder(order, listing),
      payment: {
        method: dto.paymentMethod,
        amount: totalEtb,
        reference,
        message: `In production this would redirect to the ${dto.paymentMethod} payment page`,
      },
    };
  }

  /** Simulates a Telebirr/CBE Birr payment callback confirming funds are held in escrow. */
  async confirmPayment(orderId: string, buyerId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        `Cannot confirm payment on an order with status ${order.status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAID_ESCROW', paidAt: new Date() },
    });

    return this.shapeOrder(updated);
  }

  async confirmDelivery(orderId: string, buyerId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId, status: 'PAID_ESCROW' },
    });
    if (!order) {
      throw new NotFoundException('Order not found or not in escrow');
    }

    const now = new Date();
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED', completedAt: now, deliveredAt: now },
    });

    // Auto-issue the origin certificate. Consolidated into
    // CertificatesService so there's exactly one code path that creates a
    // certificate (the original app had two, with mismatched columns —
    // see migration 003_orders_origin_certificates.sql).
    await this.certificates.issueCertificateForOrder(orderId);

    return this.shapeOrder(updated);
  }

  async cancelOrder(orderId: string, buyerId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, buyerId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Only unpaid orders can be cancelled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.restoreListingStock(tx, order.listingId, Number(order.quantity ?? order.quantityKg));
      await this.reservations.restoreOrderHoldToListingTx(tx, {
        orderId,
        listingId: order.listingId,
        qty: Number(order.quantity ?? order.quantityKg),
        actorUserId: buyerId,
      });
      return tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    });

    return this.shapeOrder(updated);
  }

  /**
   * Lets a farmer decline a sale before the buyer has paid. Mirrors
   * cancelOrder's rules exactly (only PENDING_PAYMENT, reverts the listing
   * to ACTIVE) -- once money is in escrow, neither side can unilaterally
   * back out with a single tap; see raiseDispute() for that case instead.
   */
  async declineOrder(orderId: string, userId: string) {
    const farmerProfile = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!farmerProfile) {
      throw new NotFoundException('Farmer profile not found');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, farmerId: farmerProfile.id },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        'Only unpaid orders can be declined -- once payment is in escrow, raise a dispute instead',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.restoreListingStock(tx, order.listingId, Number(order.quantity ?? order.quantityKg));
      await this.reservations.restoreOrderHoldToListingTx(tx, {
        orderId,
        listingId: order.listingId,
        qty: Number(order.quantity ?? order.quantityKg),
        actorUserId: userId,
      });
      return tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    });

    return this.shapeOrder(updated);
  }

  /**
   * Either party (buyer or farmer) can raise a dispute once payment is
   * already in escrow -- this is deliberately NOT an automatic refund.
   * It just flags the order for manual/support follow-up, since real
   * money movement deserves a human decision, not a single tap.
   */
  async raiseDispute(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { farmer: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isBuyer = order.buyerId === userId;
    const isFarmer = order.farmer.userId === userId;
    if (!isBuyer && !isFarmer) {
      throw new ForbiddenException('You do not have access to this order');
    }

    if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
      throw new BadRequestException(
        `Cannot raise a dispute on an order with status ${order.status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'DISPUTED' },
    });

    return this.shapeOrder(updated);
  }

  async updateAddress(orderId: string, buyerId: string, deliveryAddress: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, buyerId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ForbiddenException('Cannot edit address on completed or cancelled orders');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { deliveryAddress: deliveryAddress.trim() },
    });

    return this.shapeOrder(updated);
  }

  /**
   * Fixes the original app's bug: it filtered `orders.farmer_id = req.user.userId`
   * directly, but farmer_id is a farmer_profiles.id, not a users.id. Here we
   * resolve the requesting user's farmer profile first, then match on that.
   */
  async getMyOrders(userId: string, role: string) {
    if (role === 'FARMER') {
      const profile = await this.prisma.farmerProfile.findUnique({ where: { userId } });
      if (!profile) return [];
      const orders = await this.prisma.order.findMany({
        where: { farmerId: profile.id },
        include: { listing: { include: { category: true, product: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return orders.map((o: any) => this.shapeOrder(o, o.listing));
    }

    const orders = await this.prisma.order.findMany({
      where: { buyerId: userId },
      include: { listing: { include: { category: true, product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o: any) => this.shapeOrder(o, o.listing));
  }

  async getOrderById(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { include: { category: true, product: true } },
        farmer: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (role === 'FARMER') {
      if (order.farmer.userId !== userId) {
        throw new ForbiddenException('You do not have access to this order');
      }
    } else if (order.buyerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return this.shapeOrder(order, order.listing);
  }

  private async restoreListingStock(
    tx: { listing: PrismaService['listing'] },
    listingId: string,
    quantity: number,
  ) {
    const listing = await tx.listing.findUnique({ where: { id: listingId } });
    if (!listing) return;

    const nextQty = Number(listing.quantity ?? listing.quantityKg) + quantity;
    await tx.listing.update({
      where: { id: listingId },
      data: {
        quantity: nextQty,
        quantityKg: nextQty,
        status: 'ACTIVE',
      },
    });
  }

  private shapeOrder(order: any, listing?: any) {
    const quantity = toNumber(order.quantity) ?? toNumber(order.quantityKg);
    const unitCode = order.unitCode ?? 'KG';
    const pricePerUnit =
      toNumber(order.pricePerUnit) ??
      (quantity && toNumber(order.totalEtb) != null
        ? Number(order.totalEtb) / quantity
        : null);

    return {
      id: order.id,
      listingId: order.listingId,
      buyerId: order.buyerId,
      farmerId: order.farmerId,
      quantity,
      unitCode,
      pricePerUnit,
      quantityKg: toNumber(order.quantityKg),
      totalEtb: toNumber(order.totalEtb),
      commissionEtb: toNumber(order.commissionEtb),
      farmerPayoutEtb: toNumber(order.farmerPayoutEtb),
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentReference: order.paymentReference,
      deliveryAddress: order.deliveryAddress,
      paidAt: order.paidAt,
      deliveredAt: order.deliveredAt,
      completedAt: order.completedAt,
      createdAt: order.createdAt,
      ...(listing
        ? {
            region: listing.region,
            grade: listing.grade,
            qualityGrade: listing.grade ?? null,
            processMethod: listing.processMethod,
            categoryCode: listing.category?.code ?? null,
            productCode: listing.product?.code ?? null,
            productNameEn: listing.product?.nameEn ?? null,
            productNameAm: listing.product?.nameAm ?? null,
            extensions: {
              coffee: buildCoffeeExtension({
                processMethod: listing.processMethod,
                cupScore: toNumber(listing.cupScore),
                washingStation: listing.washingStation,
                cooperative: listing.cooperative,
                altitudeM: toNumber(listing.altitudeM),
                variety: listing.variety,
              }),
            },
          }
        : {}),
    };
  }
}
