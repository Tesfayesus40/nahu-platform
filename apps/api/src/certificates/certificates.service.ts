import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function generateCertNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `NBG-${year}-${random}`;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issues a certificate for a completed order, or returns the existing one
   * if it was already issued. Idempotent by design — safe to call from
   * OrdersService.confirmDelivery() and from a direct GET request.
   *
   * This is the single consolidated implementation. The original app had
   * two separate code paths (one in orders.service.js auto-generating on
   * delivery, one in certificates.service.js generating on-demand) with two
   * different column sets — the auto-generate path would have failed
   * silently at runtime. See migration 003_orders_origin_certificates.sql.
   */
  async issueCertificateForOrder(orderId: string) {
    const existing = await this.prisma.originCertificate.findUnique({ where: { orderId } });
    if (existing) {
      return this.shapeCertificate(existing);
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: true,
        farmer: { include: { user: true, cooperative: true } },
      },
    });

    if (!order || order.status !== 'COMPLETED') {
      throw new NotFoundException('Order not found or not yet completed');
    }

    const farmLocation = [
      order.farmer.woreda,
      order.farmer.zone,
      order.listing.region,
      'Ethiopia',
    ]
      .filter(Boolean)
      .join(', ');

    const farmerUser = order.farmer.user;
    const farmerName =
      [farmerUser?.firstName, farmerUser?.lastName].filter(Boolean).join(' ') ||
      'Ethiopian Farmer';

    const created = await this.prisma.originCertificate.create({
      data: {
        orderId: order.id,
        certNumber: generateCertNumber(),
        farmerName,
        farmLocation,
        cooperative: order.farmer.cooperative?.name ?? null,
        region: order.listing.region,
        grade: order.listing.grade,
        processMethod: order.listing.processMethod,
        harvestDate: order.listing.harvestDate,
        altitudeM: order.listing.altitudeM ?? order.farmer.altitudeM,
        quantityKg: order.quantityKg,
      },
    });

    return this.shapeCertificate(created);
  }

  /** Called from GET /certificates/order/:orderId — requester must be the buyer or the farmer on that order. */
  async getCertificateForRequester(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { farmer: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found or not yet completed');
    }

    const isBuyer = order.buyerId === userId;
    const isFarmer = order.farmer.userId === userId;
    if (!isBuyer && !isFarmer) {
      throw new ForbiddenException('You do not have access to this certificate');
    }

    return this.issueCertificateForOrder(orderId);
  }

  async verifyCertificate(certNumber: string) {
    const cert = await this.prisma.originCertificate.findUnique({ where: { certNumber } });
    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    return {
      valid: true,
      certificate: this.shapeCertificate(cert),
      verifiedBy: 'ናሁ ቡና ገበያ',
      verifiedAt: new Date().toISOString(),
    };
  }

  private shapeCertificate(cert: any) {
    return {
      id: cert.id,
      orderId: cert.orderId,
      certNumber: cert.certNumber,
      farmerName: cert.farmerName,
      farmLocation: cert.farmLocation,
      cooperative: cert.cooperative,
      region: cert.region,
      grade: cert.grade,
      processMethod: cert.processMethod,
      harvestDate: cert.harvestDate,
      altitudeM: toNumber(cert.altitudeM),
      quantityKg: toNumber(cert.quantityKg),
      createdAt: cert.createdAt,
    };
  }
}
