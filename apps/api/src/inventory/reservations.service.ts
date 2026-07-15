import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LotStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from '../farms/farms.service';

function toNumber(value: unknown): number {
  return Number(value);
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farms: FarmsService,
  ) {}

  async listForLot(userId: string, lotId: string) {
    const lot = await this.prisma.stockLot.findUnique({ where: { id: lotId } });
    if (!lot) throw new NotFoundException('Lot not found');
    await this.farms.assertFarmAccess(userId, lot.farmId, false);
    const rows = await this.prisma.reservation.findMany({
      where: { lotId },
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows.map((r) => this.shape(r)) };
  }

  async getByListing(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    const profile = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!profile || listing.farmerId !== profile.id) {
      throw new NotFoundException('Listing not found');
    }
    const row = await this.prisma.reservation.findFirst({
      where: { listingId, status: 'ACTIVE' },
    });
    return { data: row ? this.shape(row) : null };
  }

  async releaseById(userId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { lot: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    await this.farms.assertFarmAccess(userId, reservation.lot.farmId, true);
    if (reservation.status !== 'ACTIVE' && reservation.status !== 'ORDER_HELD') {
      throw new BadRequestException('Reservation is not releasable');
    }
    return this.prisma.$transaction((tx) =>
      this.releaseReservationTx(tx, reservation.id, userId, 'Released by farmer'),
    );
  }

  /** Bind listing qty to a lot (listing ACTIVE reservation). */
  async reserveForListingTx(
    tx: Tx,
    opts: {
      userId: string;
      lotId: string;
      listingId: string;
      qty: number;
      expectedProductId: string | null;
    },
  ) {
    const lot = await tx.stockLot.findUnique({
      where: { id: opts.lotId },
      include: { unit: true },
    });
    if (!lot) throw new BadRequestException('Stock lot not found');
    if (lot.status !== 'AVAILABLE') {
      throw new BadRequestException(`Cannot reserve lot in status ${lot.status}`);
    }
    if (opts.expectedProductId && lot.productId !== opts.expectedProductId) {
      throw new BadRequestException('Listing product does not match stock lot product');
    }

    const available = toNumber(lot.quantityOnHand) - toNumber(lot.quantityReserved);
    if (opts.qty > available + 1e-9) {
      throw new BadRequestException(
        `Insufficient available stock (${available} ${lot.unitCode})`,
      );
    }

    const existing = await tx.reservation.findFirst({
      where: { listingId: opts.listingId, status: 'ACTIVE' },
    });
    if (existing) {
      throw new BadRequestException('Listing already has an active stock reservation');
    }

    const reservation = await tx.reservation.create({
      data: {
        lotId: lot.id,
        listingId: opts.listingId,
        qty: opts.qty,
        unitCode: lot.unitCode,
        status: 'ACTIVE',
      },
    });

    await tx.stockMovement.create({
      data: {
        lotId: lot.id,
        movementType: 'RESERVE',
        qty: opts.qty,
        unitCode: lot.unitCode,
        qtyInLotUnit: opts.qty,
        reason: 'Listing stock reservation',
        actorUserId: opts.userId,
        listingId: opts.listingId,
      },
    });

    const nextReserved = toNumber(lot.quantityReserved) + opts.qty;
    const nextStatus: LotStatus =
      nextReserved >= toNumber(lot.quantityOnHand) && toNumber(lot.quantityOnHand) > 0
        ? 'RESERVED'
        : lot.status;

    await tx.stockLot.update({
      where: { id: lot.id },
      data: {
        quantityReserved: nextReserved,
        status: nextStatus,
        updatedAt: new Date(),
      },
    });

    return reservation;
  }

  async releaseActiveListingReservationTx(
    tx: Tx,
    listingId: string,
    userId: string | null,
    reason: string,
  ) {
    const reservation = await tx.reservation.findFirst({
      where: { listingId, status: 'ACTIVE' },
    });
    if (!reservation) return null;
    return this.releaseReservationTx(tx, reservation.id, userId, reason);
  }

  /**
   * Option B: move qty from listing ACTIVE reservation → ORDER_HELD reservation.
   * Net quantity_reserved unchanged.
   */
  async transferListingHoldToOrderTx(
    tx: Tx,
    opts: { listingId: string; orderId: string; qty: number; actorUserId?: string | null },
  ) {
    const listingHold = await tx.reservation.findFirst({
      where: { listingId: opts.listingId, status: 'ACTIVE' },
      include: { lot: true },
    });
    if (!listingHold) return null;

    const holdQty = toNumber(listingHold.qty);
    if (opts.qty > holdQty + 1e-9) {
      throw new BadRequestException('Order qty exceeds listing stock reservation');
    }

    const remaining = holdQty - opts.qty;

    await tx.stockMovement.create({
      data: {
        lotId: listingHold.lotId,
        movementType: 'RELEASE',
        qty: opts.qty,
        unitCode: listingHold.unitCode,
        qtyInLotUnit: opts.qty,
        reason: 'Release listing hold for order (Option B)',
        actorUserId: opts.actorUserId ?? undefined,
        listingId: opts.listingId,
        orderId: opts.orderId,
      },
    });

    if (remaining <= 1e-9) {
      await tx.reservation.update({
        where: { id: listingHold.id },
        data: { qty: 0, status: 'CONSUMED', updatedAt: new Date() },
      });
    } else {
      await tx.reservation.update({
        where: { id: listingHold.id },
        data: { qty: remaining, updatedAt: new Date() },
      });
    }

    const orderHold = await tx.reservation.create({
      data: {
        lotId: listingHold.lotId,
        listingId: opts.listingId,
        orderId: opts.orderId,
        qty: opts.qty,
        unitCode: listingHold.unitCode,
        status: 'ORDER_HELD',
      },
    });

    await tx.stockMovement.create({
      data: {
        lotId: listingHold.lotId,
        movementType: 'RESERVE',
        qty: opts.qty,
        unitCode: listingHold.unitCode,
        qtyInLotUnit: opts.qty,
        reason: 'Order stock hold (Option B)',
        actorUserId: opts.actorUserId ?? undefined,
        listingId: opts.listingId,
        orderId: opts.orderId,
      },
    });

    // Net reserved unchanged: -qty (release) +qty (order reserve)
    return orderHold;
  }

  /**
   * Cancel/decline: release ORDER_HELD and restore listing ACTIVE hold when listing is ACTIVE.
   */
  async restoreOrderHoldToListingTx(
    tx: Tx,
    opts: { orderId: string; listingId: string; qty: number; actorUserId?: string | null },
  ) {
    const orderHold = await tx.reservation.findFirst({
      where: { orderId: opts.orderId, status: 'ORDER_HELD' },
      include: { lot: true },
    });
    if (!orderHold) return null;

    const releaseQty = Math.min(opts.qty, toNumber(orderHold.qty));

    await this.releaseReservationTx(
      tx,
      orderHold.id,
      opts.actorUserId ?? null,
      'Release order hold on cancel/decline',
      releaseQty,
    );

    const listing = await tx.listing.findUnique({ where: { id: opts.listingId } });
    if (!listing || listing.status !== 'ACTIVE' || !listing.stockLotId) {
      return null;
    }

    // Re-create / grow listing ACTIVE reservation for restored offer qty
    const existing = await tx.reservation.findFirst({
      where: { listingId: opts.listingId, status: 'ACTIVE' },
    });

    if (existing) {
      const nextQty = toNumber(existing.qty) + releaseQty;
      await tx.reservation.update({
        where: { id: existing.id },
        data: { qty: nextQty, updatedAt: new Date() },
      });
      await tx.stockMovement.create({
        data: {
          lotId: existing.lotId,
          movementType: 'RESERVE',
          qty: releaseQty,
          unitCode: existing.unitCode,
          qtyInLotUnit: releaseQty,
          reason: 'Restore listing hold after order cancel',
          actorUserId: opts.actorUserId ?? undefined,
          listingId: opts.listingId,
          orderId: opts.orderId,
        },
      });
      const lot = await tx.stockLot.findUnique({ where: { id: existing.lotId } });
      if (lot) {
        const nextReserved = toNumber(lot.quantityReserved) + releaseQty;
        await tx.stockLot.update({
          where: { id: lot.id },
          data: {
            quantityReserved: nextReserved,
            status:
              nextReserved >= toNumber(lot.quantityOnHand) && toNumber(lot.quantityOnHand) > 0
                ? 'RESERVED'
                : lot.status === 'RESERVED'
                  ? 'AVAILABLE'
                  : lot.status,
            updatedAt: new Date(),
          },
        });
      }
      return existing;
    }

    return this.reserveForListingTx(tx, {
      userId: opts.actorUserId ?? '',
      lotId: listing.stockLotId,
      listingId: opts.listingId,
      qty: releaseQty,
      expectedProductId: listing.productId,
    });
  }

  /** Grow an existing ACTIVE listing reservation (same lot). */
  async growListingReservationTx(
    tx: Tx,
    opts: { listingId: string; extraQty: number; userId: string },
  ) {
    const hold = await tx.reservation.findFirst({
      where: { listingId: opts.listingId, status: 'ACTIVE' },
      include: { lot: true },
    });
    if (!hold) throw new BadRequestException('Missing listing reservation');
    const available = toNumber(hold.lot.quantityOnHand) - toNumber(hold.lot.quantityReserved);
    if (opts.extraQty > available + 1e-9) {
      throw new BadRequestException('Insufficient available stock');
    }
    await tx.reservation.update({
      where: { id: hold.id },
      data: { qty: toNumber(hold.qty) + opts.extraQty, updatedAt: new Date() },
    });
    await tx.stockMovement.create({
      data: {
        lotId: hold.lotId,
        movementType: 'RESERVE',
        qty: opts.extraQty,
        unitCode: hold.unitCode,
        qtyInLotUnit: opts.extraQty,
        reason: 'Increase listing reservation',
        actorUserId: opts.userId,
        listingId: opts.listingId,
      },
    });
    const nextReserved = toNumber(hold.lot.quantityReserved) + opts.extraQty;
    await tx.stockLot.update({
      where: { id: hold.lotId },
      data: {
        quantityReserved: nextReserved,
        status:
          nextReserved >= toNumber(hold.lot.quantityOnHand) && toNumber(hold.lot.quantityOnHand) > 0
            ? 'RESERVED'
            : hold.lot.status,
        updatedAt: new Date(),
      },
    });
    return hold;
  }

  async releaseReservationTx(
    tx: Tx,
    reservationId: string,
    userId: string | null,
    reason: string,
    qtyOverride?: number,
  ) {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { lot: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.status !== 'ACTIVE' && reservation.status !== 'ORDER_HELD') {
      throw new BadRequestException('Reservation is not releasable');
    }

    const releaseQty = qtyOverride ?? toNumber(reservation.qty);
    if (releaseQty <= 0) {
      throw new BadRequestException('Nothing to release');
    }
    if (releaseQty > toNumber(reservation.qty) + 1e-9) {
      throw new BadRequestException('Release qty exceeds reservation');
    }

    await tx.stockMovement.create({
      data: {
        lotId: reservation.lotId,
        movementType: 'RELEASE',
        qty: releaseQty,
        unitCode: reservation.unitCode,
        qtyInLotUnit: releaseQty,
        reason,
        actorUserId: userId ?? undefined,
        listingId: reservation.listingId ?? undefined,
        orderId: reservation.orderId ?? undefined,
      },
    });

    const remaining = toNumber(reservation.qty) - releaseQty;
    const updated = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        qty: Math.max(0, remaining),
        status: remaining <= 1e-9 ? 'RELEASED' : reservation.status,
        updatedAt: new Date(),
      },
    });

    const nextReserved = Math.max(0, toNumber(reservation.lot.quantityReserved) - releaseQty);
    const nextStatus: LotStatus =
      reservation.lot.status === 'RESERVED' && nextReserved < toNumber(reservation.lot.quantityOnHand)
        ? 'AVAILABLE'
        : reservation.lot.status;

    await tx.stockLot.update({
      where: { id: reservation.lotId },
      data: {
        quantityReserved: nextReserved,
        status: nextStatus,
        updatedAt: new Date(),
      },
    });

    return this.shape(updated);
  }

  private shape(r: {
    id: string;
    lotId: string;
    listingId: string | null;
    orderId: string | null;
    qty: unknown;
    unitCode: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: r.id,
      lotId: r.lotId,
      listingId: r.listingId,
      orderId: r.orderId,
      qty: toNumber(r.qty),
      unitCode: r.unitCode,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
