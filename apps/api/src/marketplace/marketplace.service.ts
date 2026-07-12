import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFarmerProfileDto } from './dto/create-farmer-profile.dto';
import { UpdateFarmerProfileDto } from './dto/update-farmer-profile.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';

/** Prisma returns NUMERIC/DECIMAL columns as Decimal objects — flatten to plain numbers for JSON responses. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Farmer profiles — ported from farmers.service.js
  // ---------------------------------------------------------------------

  async createFarmerProfile(userId: string, dto: CreateFarmerProfileDto) {
    const existing = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new BadRequestException('Profile already exists');
    }

    const { firstName, fathersName, ...profileData } = dto;
    await this.syncUserNames(userId, firstName, fathersName);

    const profile = await this.prisma.farmerProfile.create({
      data: { ...profileData, userId },
      include: { user: true, cooperative: true },
    });
    return this.shapeProfile(profile, { includePhone: true });
  }

  async updateFarmerProfile(userId: string, dto: UpdateFarmerProfileDto) {
    const existing = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Profile not found');
    }

    const { firstName, fathersName, ...profileData } = dto;
    await this.syncUserNames(userId, firstName, fathersName);

    const profile = await this.prisma.farmerProfile.update({
      where: { userId },
      data: profileData,
      include: { user: true, cooperative: true },
    });
    return this.shapeProfile(profile, { includePhone: true });
  }

  private async syncUserNames(
    userId: string,
    firstName?: string,
    fathersName?: string,
  ) {
    if (firstName === undefined && fathersName === undefined) return;

    const data: { firstName?: string | null; middleName?: string | null } = {};
    if (firstName !== undefined) {
      data.firstName = firstName.trim() || null;
    }
    if (fathersName !== undefined) {
      data.middleName = fathersName.trim() || null;
    }

    await this.prisma.user.update({ where: { id: userId }, data });
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.farmerProfile.findUnique({
      where: { userId },
      include: { user: true, cooperative: true },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return this.shapeProfile(profile, { includePhone: true });
  }

  async getPublicProfile(farmerProfileId: string) {
    const profile = await this.prisma.farmerProfile.findUnique({
      where: { id: farmerProfileId },
      include: { user: true, cooperative: true },
    });
    if (!profile) {
      throw new NotFoundException('Farmer not found');
    }
    return this.shapeProfile(profile, { includePhone: false });
  }

  async getCooperatives() {
    return this.prisma.cooperative.findMany({ orderBy: { name: 'asc' } });
  }

  private shapeProfile(profile: any, { includePhone }: { includePhone: boolean }) {
    return {
      id: profile.id,
      region: profile.region,
      zone: profile.zone,
      woreda: profile.woreda,
      primaryLanguage: profile.primaryLanguage,
      altitudeM: toNumber(profile.altitudeM),
      farmSizeHa: toNumber(profile.farmSizeHa),
      verified: profile.verified,
      firstName: profile.user?.firstName ?? null,
      fathersName: profile.user?.middleName ?? null,
      lastName: profile.user?.lastName ?? null,
      ...(includePhone ? { phone: profile.user?.phone } : {}),
      cooperativeName: profile.cooperative?.name ?? null,
      cooperativeUnion: profile.cooperative?.unionName ?? null,
    };
  }

  // ---------------------------------------------------------------------
  // Listings — ported from listings.service.js
  // ---------------------------------------------------------------------

  async createListing(userId: string, dto: CreateListingDto) {
    const farmer = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!farmer) {
      throw new BadRequestException(
        'Farmer profile not found. Please complete your profile first.',
      );
    }

    const listing = await this.prisma.listing.create({
      data: {
        farmerId: farmer.id,
        region: dto.region,
        regionEn: dto.regionEn,
        woreda: dto.woreda,
        washingStation: dto.washingStation,
        cooperative: dto.cooperative,
        processMethod: dto.processMethod,
        grade: dto.grade,
        variety: dto.variety,
        quantityKg: dto.quantityKg,
        pricePerKg: dto.pricePerKg,
        harvestDate: new Date(dto.harvestDate),
        altitudeM: dto.altitudeM,
        cupScore: dto.cupScore,
        photoUrls: dto.photoUrls ?? [],
      },
    });

    return this.shapeListing(listing);
  }

  async getMyListings(userId: string) {
    const farmer = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!farmer) {
      throw new NotFoundException('Farmer profile not found');
    }

    const listings = await this.prisma.listing.findMany({
      where: { farmerId: farmer.id },
      orderBy: { createdAt: 'desc' },
    });

    return { data: listings.map((l: any) => this.shapeListing(l)) };
  }

  async getListings(query: QueryListingsDto) {
    const { region, regions, grade, grades, processMethod, minKg, maxPrice, sort = 'newest', page = 1, limit = 20 } = query;

    const regionList = regions
      ? regions.split(',').map(r => r.trim()).filter(Boolean)
      : region
        ? [region]
        : undefined;

    const gradeList = grades
      ? grades.split(',').map(g => g.trim()).filter(Boolean)
      : grade
        ? [grade]
        : undefined;

    const where = {
      status: 'ACTIVE' as const,
      ...(regionList?.length ? { region: { in: regionList } } : {}),
      ...(gradeList?.length ? { grade: { in: gradeList as any } } : {}),
      ...(processMethod ? { processMethod } : {}),
      ...(minKg ? { quantityKg: { gte: minKg } } : {}),
      ...(maxPrice ? { pricePerKg: { lte: maxPrice } } : {}),
    };

    const orderBy =
      sort === 'price_asc'
        ? { pricePerKg: 'asc' as const }
        : sort === 'price_desc'
          ? { pricePerKg: 'desc' as const }
          : { createdAt: 'desc' as const };

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: { farmer: { include: { user: true } } },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      data: listings.map((l: any) => this.shapeListing(l, { includeFarmerSummary: true })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getListingById(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { farmer: { include: { user: true, cooperative: true } } },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return this.shapeListing(listing, { includeFarmerDetail: true });
  }

  async updateListing(userId: string, listingId: string, dto: UpdateListingDto) {
    const farmer = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!farmer) {
      throw new NotFoundException('Farmer profile not found');
    }

    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, farmerId: farmer.id },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.status !== 'ACTIVE') {
      throw new BadRequestException('Only active listings can be edited');
    }

    const { harvestDate, ...rest } = dto;
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        ...rest,
        ...(harvestDate ? { harvestDate: new Date(harvestDate) } : {}),
      },
    });

    return this.shapeListing(updated);
  }

  async withdrawListing(userId: string, listingId: string) {
    const farmer = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!farmer) {
      throw new NotFoundException('Farmer profile not found');
    }

    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, farmerId: farmer.id },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.status !== 'ACTIVE') {
      throw new BadRequestException('Only active listings can be withdrawn');
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'CANCELLED' },
    });

    return this.shapeListing(updated);
  }

  private shapeListing(
    listing: any,
    opts: { includeFarmerSummary?: boolean; includeFarmerDetail?: boolean } = {},
  ) {
    const base = {
      id: listing.id,
      region: listing.region,
      regionEn: listing.regionEn,
      woreda: listing.woreda,
      washingStation: listing.washingStation,
      // Free-text cooperative name entered on this specific listing --
      // distinct from farmer.cooperative (the FK'd Cooperative relation,
      // surfaced separately below as cooperativeName/cooperativeUnion).
      cooperative: listing.cooperative,
      processMethod: listing.processMethod,
      grade: listing.grade,
      variety: listing.variety,
      quantityKg: toNumber(listing.quantityKg),
      pricePerKg: toNumber(listing.pricePerKg),
      harvestDate: listing.harvestDate,
      altitudeM: toNumber(listing.altitudeM),
      cupScore: toNumber(listing.cupScore),
      photoUrls: listing.photoUrls,
      status: listing.status,
      createdAt: listing.createdAt,
    };

    if (opts.includeFarmerSummary && listing.farmer) {
      return {
        ...base,
        farmerFirstName: listing.farmer.user?.firstName ?? null,
        farmerLastName: listing.farmer.user?.lastName ?? null,
        farmAltitude: toNumber(listing.farmer.altitudeM),
        farmerVerified: listing.farmer.verified,
      };
    }

    if (opts.includeFarmerDetail && listing.farmer) {
      return {
        ...base,
        farmerFirstName: listing.farmer.user?.firstName ?? null,
        farmerLastName: listing.farmer.user?.lastName ?? null,
        farmerRegion: listing.farmer.region,
        farmerZone: listing.farmer.zone,
        farmerWoreda: listing.farmer.woreda,
        farmAltitude: toNumber(listing.farmer.altitudeM),
        farmerVerified: listing.farmer.verified,
        farmSizeHa: toNumber(listing.farmer.farmSizeHa),
        cooperativeName: listing.farmer.cooperative?.name ?? null,
        cooperativeUnion: listing.farmer.cooperative?.unionName ?? null,
      };
    }

    return base;
  }
}
