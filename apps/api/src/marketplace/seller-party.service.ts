import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildFarmerAddressText,
  buildFarmerDisplayName,
} from './seller-party.rules';

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SellerPartyService {
  constructor(private readonly prisma: PrismaService) {}

  async listTypes(activeOnly = true) {
    const rows = await this.prisma.sellerType.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r) => ({
      code: r.code,
      nameEn: r.nameEn,
      nameAm: r.nameAm,
      description: r.description,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
    }));
  }

  async getById(id: string) {
    const party = await this.prisma.sellerParty.findUnique({
      where: { id },
      include: {
        sellerType: true,
        farmerProfile: true,
        ownerUser: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });
    if (!party) throw new NotFoundException('Seller party not found');
    return this.shapeParty(party);
  }

  async getMine(userId: string) {
    const party = await this.prisma.sellerParty.findFirst({
      where: { ownerUserId: userId, status: 'ACTIVE' },
      include: {
        sellerType: true,
        farmerProfile: true,
        ownerUser: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!party) throw new NotFoundException('Seller party not found');
    return this.shapeParty(party, { includePrivate: true });
  }

  async updateMine(
    userId: string,
    dto: {
      displayName?: string;
      legalName?: string | null;
      description?: string | null;
      logoUrl?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      addressText?: string | null;
    },
  ) {
    const existing = await this.prisma.sellerParty.findFirst({
      where: { ownerUserId: userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (!existing) throw new NotFoundException('Seller party not found');

    const updated = await this.prisma.sellerParty.update({
      where: { id: existing.id },
      data: {
        ...(dto.displayName !== undefined
          ? { displayName: dto.displayName.trim() }
          : {}),
        ...(dto.legalName !== undefined ? { legalName: dto.legalName } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.contactEmail !== undefined
          ? { contactEmail: dto.contactEmail }
          : {}),
        ...(dto.contactPhone !== undefined
          ? { contactPhone: dto.contactPhone }
          : {}),
        ...(dto.addressText !== undefined
          ? { addressText: dto.addressText }
          : {}),
        updatedAt: new Date(),
      },
      include: {
        sellerType: true,
        farmerProfile: true,
        ownerUser: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });
    return this.shapeParty(updated, { includePrivate: true });
  }

  /**
   * Ensure a FARMER seller party exists for this farmer profile (idempotent).
   * Used on farmer profile create and lazily before listing write.
   */
  async ensureForFarmerProfile(
    farmer: {
      id: string;
      userId: string;
      sellerPartyId?: string | null;
      region?: string | null;
      zone?: string | null;
      woreda?: string | null;
      verified?: boolean;
      verificationStatus?: string | null;
      verificationNotes?: string | null;
    },
    tx?: Tx,
  ) {
    const db = tx ?? this.prisma;
    if (farmer.sellerPartyId) {
      const existing = await db.sellerParty.findUnique({
        where: { id: farmer.sellerPartyId },
      });
      if (existing) return existing;
    }

    const linked = await db.farmerProfile.findUnique({
      where: { id: farmer.id },
      include: {
        user: true,
        sellerParty: true,
      },
    });
    if (!linked) {
      throw new BadRequestException('Farmer profile not found');
    }
    if (linked.sellerPartyId && linked.sellerParty) {
      return linked.sellerParty;
    }

    const displayName = buildFarmerDisplayName({
      firstName: linked.user?.firstName,
      middleName: linked.user?.middleName,
      lastName: linked.user?.lastName,
      region: linked.region,
    });
    const addressText = buildFarmerAddressText({
      woreda: linked.woreda,
      zone: linked.zone,
      region: linked.region,
    });

    const party = await db.sellerParty.create({
      data: {
        ownerUserId: linked.userId,
        sellerTypeCode: 'FARMER',
        displayName,
        contactPhone: linked.user?.phone ?? null,
        addressText,
        verified: linked.verified,
        verificationStatus: linked.verificationStatus || 'PENDING',
        verificationNotes: linked.verificationNotes,
        metadata: {
          source: 'g7_ensure_farmer',
          farmerProfileId: linked.id,
        },
      },
    });

    await db.farmerProfile.update({
      where: { id: linked.id },
      data: { sellerPartyId: party.id, updatedAt: new Date() },
    });

    return party;
  }

  shapeParty(party: any, opts: { includePrivate?: boolean } = {}) {
    return {
      id: party.id,
      sellerPartyId: party.id,
      sellerType: party.sellerTypeCode || party.sellerType?.code || null,
      sellerTypeNameEn: party.sellerType?.nameEn ?? null,
      sellerTypeNameAm: party.sellerType?.nameAm ?? null,
      displayName: party.displayName,
      legalName: party.legalName ?? null,
      description: party.description ?? null,
      logoUrl: party.logoUrl ?? null,
      contactEmail: opts.includePrivate ? party.contactEmail ?? null : null,
      contactPhone: opts.includePrivate
        ? party.contactPhone ?? party.ownerUser?.phone ?? null
        : null,
      addressText: party.addressText ?? null,
      status: party.status,
      verified: party.verified,
      verificationStatus: party.verificationStatus,
      farmerProfileId: party.farmerProfile?.id ?? null,
      ownerUserId: opts.includePrivate ? party.ownerUserId : undefined,
      createdAt: party.createdAt,
      updatedAt: party.updatedAt,
    };
  }
}
