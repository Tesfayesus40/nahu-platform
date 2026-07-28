import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { DeliveryMethod } from './dto/create-order.dto';
import { ReservationsService } from '../inventory/reservations.service';
import {
  OrderContractError,
  resolveOrderQuantity,
} from './order-contract.rules';
import { buildCoffeeExtension } from '../marketplace/listing-contract.rules';
import { isPubliclyVisibleModeration } from '../marketplace/listing-moderation.rules';
import { BuyerConfirmService } from './buyer-confirm.service';
import { PricingService } from '../pricing/pricing.service';
import { buildOrderMoneySnapshot } from '../pricing/pricing.rules';
import { FulfillmentOrchestrationService } from '../delivery/fulfillment-orchestration.service';
import { PaymentOrchestrationService } from '../payments/payment-orchestration.service';

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly reservations: ReservationsService,
    private readonly buyerConfirm: BuyerConfirmService,
    private readonly pricing: PricingService,
    private readonly orchestration: FulfillmentOrchestrationService,
    private readonly paymentOrch: PaymentOrchestrationService,
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

    if (!isPubliclyVisibleModeration(listing.moderationStatus ?? 'APPROVED')) {
      throw new BadRequestException('Listing not found or no longer available');
    }

    const deliveryMethod = dto.deliveryMethod ?? DeliveryMethod.NAHU_COURIER;
    let deliveryAddressId: string | null = null;
    let deliveryAddress = dto.deliveryAddress?.trim() || '';

    if (dto.deliveryAddressId) {
      const saved = await this.prisma.buyerAddress.findFirst({
        where: {
          id: dto.deliveryAddressId,
          userId: buyerId,
          deletedAt: null,
        },
      });
      if (!saved) {
        throw new BadRequestException(
          'Delivery address not found or does not belong to this buyer',
        );
      }
      deliveryAddressId = saved.id;
      if (!deliveryAddress) {
        deliveryAddress = saved.addressText;
      }
    }

    if (deliveryMethod === DeliveryMethod.NAHU_COURIER) {
      if (!deliveryAddress || deliveryAddress.length < 10) {
        throw new BadRequestException(
          'deliveryAddress (or deliveryAddressId) is required for NAHU_COURIER',
        );
      }
    } else if (!deliveryAddress) {
      deliveryAddress =
        deliveryMethod === DeliveryMethod.CUSTOMER_PICKUP
          ? 'Customer pickup'
          : 'Seller delivery';
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

    const goodsSubtotalEtb = resolved.totalEtb;
    const market = await this.pricing.resolveMarketplaceSnapshot(goodsSubtotalEtb);

    let deliveryFeeEtb = 0;
    let deliveryCommissionEtb = 0;
    let courierPayoutEtb = 0;
    let deliveryQuoteId: string | null = null;
    let feeScheduleId: string | null = market.scheduleId || null;

    const dynamicDelivery = await this.pricing.isDynamicDeliveryEnabled();
    if (deliveryMethod === DeliveryMethod.NAHU_COURIER && dynamicDelivery) {
      if (!dto.deliveryQuoteId) {
        throw new BadRequestException(
          'deliveryQuoteId is required for NAHU_COURIER when dynamic delivery fees are enabled',
        );
      }
      // Bind quote after order id exists — validate expiry/ownership first.
      const quote = await this.prisma.deliveryQuote.findUnique({
        where: { id: dto.deliveryQuoteId },
      });
      if (!quote) {
        throw new BadRequestException('Delivery quote not found');
      }
      if (quote.buyerUserId && quote.buyerUserId !== buyerId) {
        throw new BadRequestException('Delivery quote does not belong to this buyer');
      }
      if (quote.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException('Delivery quote has expired; request a new quote');
      }
      if (quote.orderId) {
        throw new BadRequestException('Delivery quote already used');
      }
      deliveryFeeEtb = Number(quote.deliveryFeeEtb);
      deliveryCommissionEtb = Number(quote.deliveryCommissionEtb);
      courierPayoutEtb = Number(quote.courierPayoutEtb);
      deliveryQuoteId = quote.id;
      feeScheduleId = quote.feeScheduleId;
    }

    const snapshot = buildOrderMoneySnapshot({
      goodsSubtotalEtb,
      rates: {
        buyerFeePct: market.buyerFeePct,
        farmerFeePct: market.farmerFeePct,
      },
      deliveryFeeEtb,
      deliveryCommissionEtb,
      courierPayoutEtb,
    });

    const reference = `NBG-${Date.now().toString(16).toUpperCase().slice(-8)}`;
    const available = Number(listing.quantity ?? listing.quantityKg);
    const remaining = available - resolved.quantity;

    let sellerPartyId = listing.sellerPartyId ?? null;
    if (!sellerPartyId && listing.farmerId) {
      const farmer = await this.prisma.farmerProfile.findUnique({
        where: { id: listing.farmerId },
        select: { sellerPartyId: true },
      });
      sellerPartyId = farmer?.sellerPartyId ?? null;
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          listingId: listing.id,
          buyerId,
          farmerId: listing.farmerId,
          sellerPartyId,
          quantity: resolved.quantity,
          unitCode: resolved.unitCode,
          pricePerUnit: resolved.pricePerUnit,
          quantityKg: resolved.quantityKg,
          totalEtb: snapshot.totalEtb,
          commissionEtb: snapshot.commissionEtb,
          farmerPayoutEtb: snapshot.farmerPayoutEtb,
          goodsSubtotalEtb: snapshot.goodsSubtotalEtb,
          buyerFeeEtb: snapshot.buyerFeeEtb,
          farmerFeeEtb: snapshot.farmerFeeEtb,
          deliveryFeeEtb: snapshot.deliveryFeeEtb,
          deliveryCommissionEtb: snapshot.deliveryCommissionEtb,
          courierPayoutEtb: snapshot.courierPayoutEtb,
          buyerChargeEtb: snapshot.buyerChargeEtb,
          feeScheduleId,
          deliveryQuoteId,
          paymentMethod: dto.paymentMethod,
          paymentReference: reference,
          deliveryAddress,
          deliveryAddressId,
          deliveryMethod,
        },
      });

      if (deliveryQuoteId) {
        await tx.deliveryQuote.update({
          where: { id: deliveryQuoteId },
          data: { orderId: created.id },
        });
      }

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

    // G9 — create payment case (CREATED → PENDING)
    await this.paymentOrch
      .ensureFromOrder({ orderId: order.id, actorUserId: buyerId, initiate: true })
      .catch(() => undefined);

    return {
      order: this.shapeOrder(order, listing),
      payment: {
        method: dto.paymentMethod,
        amount: snapshot.buyerChargeEtb,
        reference,
        message: `In production this would redirect to the ${dto.paymentMethod} payment page`,
      },
      fees: {
        goodsSubtotalEtb: snapshot.goodsSubtotalEtb,
        buyerFeeEtb: snapshot.buyerFeeEtb,
        farmerFeeEtb: snapshot.farmerFeeEtb,
        deliveryFeeEtb: snapshot.deliveryFeeEtb,
        deliveryCommissionEtb: snapshot.deliveryCommissionEtb,
        courierPayoutEtb: snapshot.courierPayoutEtb,
        buyerChargeEtb: snapshot.buyerChargeEtb,
        farmerPayoutEtb: snapshot.farmerPayoutEtb,
        buyerFeePct: market.buyerFeePct,
        farmerFeePct: market.farmerFeePct,
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

    // G9 — provider stub + escrow hold (also records BUYER_CAPTURE intent)
    await this.paymentOrch.syncCaptureToEscrow({
      orderId,
      actorUserId: buyerId,
      externalReference: order.paymentReference,
    });

    // G8 — advance fulfilment orchestration PLACED → PAID
    await this.orchestration.syncPaid(orderId, buyerId).catch(() => undefined);

    return this.shapeOrder(updated);
  }

  /**
   * AD-1 buyer confirmation.
   * - Legacy: PAID_ESCROW with no open shipment → COMPLETED + certificate
   * - Delivery: active shipment DELIVERED → order COMPLETED + shipment
   *   DELIVERED → BUYER_CONFIRMED → COMPLETED (distinct transitions)
   */
  async confirmDelivery(orderId: string, buyerId: string) {
    const result = await this.buyerConfirm.confirmOrderDelivery({
      orderId,
      requireBuyerId: buyerId,
      actor: { userId: buyerId, kind: 'BUYER' },
    });
    return this.shapeOrder(result.order);
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

    await this.paymentOrch
      .cancelUnpaid(orderId, buyerId, 'BUYER_CANCELLATION')
      .catch(() => undefined);

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

    await this.paymentOrch
      .cancelUnpaid(orderId, userId, 'SELLER_REJECTION')
      .catch(() => undefined);

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

    const openedByRole = isBuyer ? 'BUYER' : 'FARMER';
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: { status: 'DISPUTED' },
      });

      const existingCase = await tx.disputeCase.findUnique({
        where: { orderId },
      });
      if (existingCase) {
        if (existingCase.status === 'CLOSED' || existingCase.status === 'RESOLVED') {
          await tx.disputeCase.update({
            where: { id: existingCase.id },
            data: {
              status: 'OPEN',
              openedByUserId: userId,
              openedByRole,
              resolvedAt: null,
              closedAt: null,
              updatedAt: new Date(),
            },
          });
          await tx.disputeEvent.create({
            data: {
              disputeId: existingCase.id,
              eventType: 'OPENED',
              fromStatus: existingCase.status,
              toStatus: 'OPEN',
              message: 'Dispute re-opened by party',
              actorUserId: userId,
            },
          });
        }
      } else {
        const created = await tx.disputeCase.create({
          data: {
            orderId,
            status: 'OPEN',
            openedByUserId: userId,
            openedByRole,
            summary: 'Raised by party from order',
          },
        });
        await tx.disputeEvent.create({
          data: {
            disputeId: created.id,
            eventType: 'OPENED',
            fromStatus: null,
            toStatus: 'OPEN',
            message: 'Dispute opened',
            actorUserId: userId,
          },
        });
      }

      return order;
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
      sellerPartyId: order.sellerPartyId ?? listing?.sellerPartyId ?? null,
      quantity,
      unitCode,
      pricePerUnit,
      quantityKg: toNumber(order.quantityKg),
      totalEtb: toNumber(order.totalEtb),
      commissionEtb: toNumber(order.commissionEtb),
      farmerPayoutEtb: toNumber(order.farmerPayoutEtb),
      goodsSubtotalEtb: toNumber(order.goodsSubtotalEtb) ?? toNumber(order.totalEtb),
      buyerFeeEtb: toNumber(order.buyerFeeEtb) ?? 0,
      farmerFeeEtb: toNumber(order.farmerFeeEtb) ?? toNumber(order.commissionEtb),
      deliveryFeeEtb: toNumber(order.deliveryFeeEtb) ?? 0,
      deliveryCommissionEtb: toNumber(order.deliveryCommissionEtb) ?? 0,
      courierPayoutEtb: toNumber(order.courierPayoutEtb) ?? 0,
      buyerChargeEtb:
        toNumber(order.buyerChargeEtb) ?? toNumber(order.totalEtb),
      feeScheduleId: order.feeScheduleId ?? null,
      deliveryQuoteId: order.deliveryQuoteId ?? null,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentReference: order.paymentReference,
      deliveryAddress: order.deliveryAddress,
      deliveryAddressId: order.deliveryAddressId ?? null,
      deliveryMethod: order.deliveryMethod ?? 'NAHU_COURIER',
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
