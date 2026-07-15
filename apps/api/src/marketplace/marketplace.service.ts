import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { FarmsService } from '../farms/farms.service';
import { ReservationsService } from '../inventory/reservations.service';
import {
  isProductSellable,
  productCategoryConflicts,
} from '../catalog/product-resolve.rules';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly farms: FarmsService,
    private readonly reservations: ReservationsService,
  ) {}

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

    const product = await this.resolveListingProduct(dto.productCode, dto.categoryCode);
    const { categoryCode: _c, productCode: _p, stockLotId, ...listingData } = dto;

    if (stockLotId) {
      const lot = await this.prisma.stockLot.findUnique({ where: { id: stockLotId } });
      if (!lot) throw new BadRequestException('Stock lot not found');
      await this.farms.assertFarmAccess(userId, lot.farmId, true);

      const listing = await this.prisma.$transaction(async (tx) => {
        const created = await tx.listing.create({
          data: {
            ...listingData,
            farmerId: farmer.id,
            categoryId: product.categoryId,
            productId: product.id,
            stockLotId: lot.id,
            farmId: lot.farmId,
            harvestDate: new Date(dto.harvestDate),
            photoUrls: dto.photoUrls ?? [],
          },
          include: { category: true, product: { include: { defaultUnit: true } } },
        });

        await this.reservations.reserveForListingTx(tx, {
          userId,
          lotId: lot.id,
          listingId: created.id,
          qty: dto.quantityKg,
          expectedProductId: product.id,
        });

        return created;
      });

      return this.shapeListingWithReservation(listing);
    }

    const listing = await this.prisma.listing.create({
      data: {
        ...listingData,
        farmerId: farmer.id,
        categoryId: product.categoryId,
        productId: product.id,
        harvestDate: new Date(dto.harvestDate),
        photoUrls: dto.photoUrls ?? [],
      },
      include: { category: true, product: { include: { defaultUnit: true } } },
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
      include: { category: true, product: { include: { defaultUnit: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return { data: listings.map((l: any) => this.shapeListing(l)) };
  }

  async getListings(query: QueryListingsDto) {
    const {
      categoryCode,
      productCode,
      region,
      regions,
      grade,
      grades,
      processMethod,
      minKg,
      maxPrice,
      sort = 'newest',
      page = 1,
      limit = 20,
    } = query;

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

    let categoryId: string | undefined;
    if (categoryCode) {
      const category = await this.catalog.findActiveCategoryByCode(categoryCode);
      if (!category) {
        return {
          data: [],
          pagination: { page, limit, total: 0, pages: 0 },
        };
      }
      categoryId = category.id;
    }

    let productId: string | undefined;
    if (productCode) {
      const product = await this.catalog.findActiveProductByCode(productCode);
      if (!product) {
        return {
          data: [],
          pagination: { page, limit, total: 0, pages: 0 },
        };
      }
      productId = product.id;
    }

    const where = {
      status: 'ACTIVE' as const,
      ...(categoryId ? { categoryId } : {}),
      ...(productId ? { productId } : {}),
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
        include: {
          farmer: { include: { user: true } },
          category: true,
          product: { include: { defaultUnit: true } },
        },
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
      include: {
        farmer: { include: { user: true, cooperative: true } },
        category: true,
        product: { include: { defaultUnit: true } },
      },
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

    if (dto.stockLotId !== undefined && dto.stockLotId !== listing.stockLotId) {
      throw new BadRequestException(
        'Cannot change stock lot on an existing listing. Withdraw and create a new listing.',
      );
    }
    if (dto.productCode !== undefined || dto.categoryCode !== undefined) {
      const activeHold = await this.prisma.reservation.findFirst({
        where: { listingId, status: 'ACTIVE' },
      });
      if (activeHold) {
        throw new BadRequestException(
          'Cannot change product on a stock-bound listing. Withdraw and create a new listing.',
        );
      }
    }

    const { harvestDate, categoryCode, productCode, stockLotId: _ignoreLot, quantityKg, ...rest } =
      dto;
    let productUpdate: { categoryId: string; productId: string } | undefined;
    if (categoryCode !== undefined || productCode !== undefined) {
      const product = await this.resolveListingProduct(productCode, categoryCode);
      productUpdate = { categoryId: product.categoryId, productId: product.id };
    }

    if (quantityKg !== undefined && listing.stockLotId) {
      const currentQty = Number(listing.quantityKg);
      const delta = quantityKg - currentQty;
      if (Math.abs(delta) > 1e-9) {
        await this.prisma.$transaction(async (tx) => {
          if (delta > 0) {
            await this.reservations.growListingReservationTx(tx, {
              listingId,
              extraQty: delta,
              userId,
            });
          } else {
            const hold = await tx.reservation.findFirst({
              where: { listingId, status: 'ACTIVE' },
            });
            if (!hold) throw new BadRequestException('Missing listing reservation');
            await this.reservations.releaseReservationTx(
              tx,
              hold.id,
              userId,
              'Decrease listing reservation',
              Math.abs(delta),
            );
          }
          await tx.listing.update({
            where: { id: listingId },
            data: {
              ...rest,
              ...(harvestDate ? { harvestDate: new Date(harvestDate) } : {}),
              ...(productUpdate ?? {}),
              quantityKg,
              updatedAt: new Date(),
            },
          });
        });

        const updatedBound = await this.prisma.listing.findUnique({
          where: { id: listingId },
          include: { category: true, product: { include: { defaultUnit: true } } },
        });
        return this.shapeListingWithReservation(updatedBound);
      }
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        ...rest,
        ...(harvestDate ? { harvestDate: new Date(harvestDate) } : {}),
        ...(productUpdate ?? {}),
        ...(quantityKg !== undefined ? { quantityKg } : {}),
        updatedAt: new Date(),
      },
      include: { category: true, product: { include: { defaultUnit: true } } },
    });

    return this.shapeListingWithReservation(updated);
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

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.reservations.releaseActiveListingReservationTx(
        tx,
        listingId,
        userId,
        'Listing withdrawn',
      );
      return tx.listing.update({
        where: { id: listingId },
        data: { status: 'CANCELLED' },
        include: { category: true, product: { include: { defaultUnit: true } } },
      });
    });

    return this.shapeListing(updated);
  }

  private async resolveListingProduct(productCode?: string, categoryCode?: string) {
    if (productCode) {
      const product = await this.catalog.findActiveProductByCode(productCode);
      if (
        !product ||
        !isProductSellable(product.category.isActive, product.status)
      ) {
        throw new BadRequestException('This product is not available yet');
      }
      if (productCategoryConflicts(product.category.code, categoryCode)) {
        throw new BadRequestException(
          'productCode does not belong to the specified categoryCode',
        );
      }
      return product;
    }

    const category = categoryCode
      ? await this.catalog.findActiveCategoryByCode(categoryCode)
      : await this.catalog.findCoffeeCategory();

    if (!category) {
      throw new BadRequestException('This product category is not available yet');
    }

    const product = await this.catalog.findDefaultActiveProduct(category.id);
    if (!product || !isProductSellable(category.isActive, product.status)) {
      throw new BadRequestException('This product category is not available yet');
    }

    return product;
  }

  private shapeCategoryFields(listing: any) {
    return {
      categoryCode: listing.category?.code ?? null,
      categoryNameEn: listing.category?.nameEn ?? null,
      categoryNameAm: listing.category?.nameAm ?? null,
    };
  }

  private shapeProductFields(listing: any) {
    return {
      productId: listing.product?.id ?? listing.productId ?? null,
      productCode: listing.product?.code ?? null,
      productNameEn: listing.product?.nameEn ?? null,
      productNameAm: listing.product?.nameAm ?? null,
      defaultUnitCode: listing.product?.defaultUnit?.code ?? null,
    };
  }

  private shapeListing(
    listing: any,
    opts: { includeFarmerSummary?: boolean; includeFarmerDetail?: boolean } = {},
  ) {
    const base = {
      id: listing.id,
      ...this.shapeCategoryFields(listing),
      ...this.shapeProductFields(listing),
      stockLotId: listing.stockLotId ?? null,
      farmId: listing.farmId ?? null,
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

  private async shapeListingWithReservation(listing: any, opts: Parameters<MarketplaceService['shapeListing']>[1] = {}) {
    const shaped = this.shapeListing(listing, opts);
    if (!listing?.id) return shaped;
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        listingId: listing.id,
        status: { in: ['ACTIVE', 'ORDER_HELD'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      ...shaped,
      reservation: reservation
        ? {
            id: reservation.id,
            status: reservation.status,
            qty: toNumber(reservation.qty),
            unitCode: reservation.unitCode,
            lotId: reservation.lotId,
            orderId: reservation.orderId,
          }
        : null,
    };
  }
}
