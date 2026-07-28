import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { ListingAttributesService } from '../catalog/listing-attributes.service';
import { FarmsService } from '../farms/farms.service';
import { ReservationsService } from '../inventory/reservations.service';
import {
  isProductSellable,
  productCategoryConflicts,
} from '../catalog/product-resolve.rules';
import {
  assertCoffeeExtensionRequirements,
  buildCoffeeExtension,
  ListingContractError,
  resolveListingQuantity,
} from './listing-contract.rules';
import { CreateFarmerProfileDto } from './dto/create-farmer-profile.dto';
import { UpdateFarmerProfileDto } from './dto/update-farmer-profile.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { CreatePickupLocationDto } from './dto/create-pickup-location.dto';
import { UpdatePickupLocationDto } from './dto/update-pickup-location.dto';
import { CreateBuyerAddressDto } from './dto/create-buyer-address.dto';
import { UpdateBuyerAddressDto } from './dto/update-buyer-address.dto';
import { CoffeeGrade, ProcessMethod } from './dto/create-listing.dto';
import {
  buildListingKeywordOr,
  sellerProfileExtensions,
  shapePublicCertificateSummary,
  shapePublicFarmSummary,
} from './listing-search.rules';
import { SellerPartyService } from './seller-party.service';

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
    private readonly listingAttributes: ListingAttributesService,
    private readonly farms: FarmsService,
    private readonly reservations: ReservationsService,
    private readonly sellerParties: SellerPartyService,
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
    await this.sellerParties.ensureForFarmerProfile(profile);
    const withParty = await this.prisma.farmerProfile.findUnique({
      where: { id: profile.id },
      include: { user: true, cooperative: true, sellerParty: true },
    });
    return this.shapeProfile(withParty, { includePhone: true });
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
      include: { user: true, cooperative: true, sellerParty: true },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    if (!profile.sellerPartyId) {
      await this.sellerParties.ensureForFarmerProfile(profile);
      const refreshed = await this.prisma.farmerProfile.findUnique({
        where: { userId },
        include: { user: true, cooperative: true, sellerParty: true },
      });
      return this.shapeProfile(refreshed, { includePhone: true });
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

    const [parties, certificates, activeListingsCount] = await Promise.all([
      this.prisma.farmParty.findMany({
        where: {
          farmerProfileId: profile.id,
          status: 'ACTIVE',
        },
        include: { farm: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.originCertificate.findMany({
        where: { order: { farmerId: profile.id } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.listing.count({
        where: { farmerId: profile.id, status: 'ACTIVE' },
      }),
    ]);

    const farms = parties
      .map((p) => shapePublicFarmSummary(p.farm))
      .filter(Boolean)
      .filter((farm, index, all) => all.findIndex((f) => f!.id === farm!.id) === index);

    const base = this.shapeProfile(profile, { includePhone: false });

    return {
      ...base,
      location: {
        region: profile.region ?? null,
        zone: profile.zone ?? null,
        woreda: profile.woreda ?? null,
      },
      farms,
      certificates: certificates.map((c) => shapePublicCertificateSummary(c)),
      activeListingsCount,
      extensions: sellerProfileExtensions(Boolean(profile.verified)),
    };
  }

  async getCooperatives() {
    return this.prisma.cooperative.findMany({ orderBy: { name: 'asc' } });
  }

  // ---------------------------------------------------------------------
  // Farmer pickup locations (saved address book)
  // ---------------------------------------------------------------------

  async listPickupLocations(userId: string) {
    const farmer = await this.requireFarmerProfile(userId);
    const rows = await this.prisma.pickupLocation.findMany({
      where: { farmerProfileId: farmer.id, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return { data: rows.map((r) => this.shapePickupLocation(r)) };
  }

  async createPickupLocation(userId: string, dto: CreatePickupLocationDto) {
    const farmer = await this.requireFarmerProfile(userId);
    const makeDefault = dto.isDefault === true;

    const row = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.pickupLocation.updateMany({
          where: { farmerProfileId: farmer.id, deletedAt: null, isDefault: true },
          data: { isDefault: false, updatedAt: new Date() },
        });
      }

      return tx.pickupLocation.create({
        data: {
          farmerProfileId: farmer.id,
          name: dto.name.trim(),
          contactName: dto.contactName?.trim() || null,
          contactPhone: dto.contactPhone?.trim() || null,
          addressText: dto.addressText.trim(),
          lat: dto.lat ?? null,
          lng: dto.lng ?? null,
          landmark: dto.landmark?.trim() || null,
          instructions: dto.instructions?.trim() || null,
          isDefault: makeDefault,
          locationKind: dto.locationKind ?? 'FARM',
          googlePlaceId: dto.googlePlaceId?.trim() || null,
          formattedAddress:
            dto.formattedAddress?.trim() || dto.addressText.trim(),
        },
      });
    });

    return this.shapePickupLocation(row);
  }

  async updatePickupLocation(
    userId: string,
    id: string,
    dto: UpdatePickupLocationDto,
  ) {
    const farmer = await this.requireFarmerProfile(userId);
    const existing = await this.prisma.pickupLocation.findFirst({
      where: { id, farmerProfileId: farmer.id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Pickup location not found');

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.pickupLocation.updateMany({
          where: {
            farmerProfileId: farmer.id,
            deletedAt: null,
            isDefault: true,
            NOT: { id },
          },
          data: { isDefault: false, updatedAt: new Date() },
        });
      }

      return tx.pickupLocation.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.contactName !== undefined
            ? { contactName: dto.contactName?.trim() || null }
            : {}),
          ...(dto.contactPhone !== undefined
            ? { contactPhone: dto.contactPhone?.trim() || null }
            : {}),
          ...(dto.addressText !== undefined
            ? { addressText: dto.addressText.trim() }
            : {}),
          ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
          ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
          ...(dto.landmark !== undefined
            ? { landmark: dto.landmark?.trim() || null }
            : {}),
          ...(dto.instructions !== undefined
            ? { instructions: dto.instructions?.trim() || null }
            : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.locationKind !== undefined
            ? { locationKind: dto.locationKind }
            : {}),
          ...(dto.googlePlaceId !== undefined
            ? { googlePlaceId: dto.googlePlaceId?.trim() || null }
            : {}),
          ...(dto.formattedAddress !== undefined
            ? { formattedAddress: dto.formattedAddress?.trim() || null }
            : {}),
          updatedAt: new Date(),
        },
      });
    });

    return this.shapePickupLocation(row);
  }

  async deletePickupLocation(userId: string, id: string) {
    const farmer = await this.requireFarmerProfile(userId);
    const existing = await this.prisma.pickupLocation.findFirst({
      where: { id, farmerProfileId: farmer.id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Pickup location not found');

    await this.prisma.pickupLocation.update({
      where: { id },
      data: { deletedAt: new Date(), isDefault: false, updatedAt: new Date() },
    });

    return { success: true };
  }

  async setDefaultPickupLocation(userId: string, id: string) {
    const farmer = await this.requireFarmerProfile(userId);
    const existing = await this.prisma.pickupLocation.findFirst({
      where: { id, farmerProfileId: farmer.id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Pickup location not found');

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.pickupLocation.updateMany({
        where: {
          farmerProfileId: farmer.id,
          deletedAt: null,
          isDefault: true,
          NOT: { id },
        },
        data: { isDefault: false, updatedAt: new Date() },
      });
      return tx.pickupLocation.update({
        where: { id },
        data: { isDefault: true, updatedAt: new Date() },
      });
    });

    return this.shapePickupLocation(row);
  }

  // ---------------------------------------------------------------------
  // Buyer saved addresses
  // ---------------------------------------------------------------------

  async listBuyerAddresses(userId: string) {
    const rows = await this.prisma.buyerAddress.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return { data: rows.map((r) => this.shapeBuyerAddress(r)) };
  }

  async createBuyerAddress(userId: string, dto: CreateBuyerAddressDto) {
    const makeDefault = dto.isDefault === true;

    const row = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.buyerAddress.updateMany({
          where: { userId, deletedAt: null, isDefault: true },
          data: { isDefault: false, updatedAt: new Date() },
        });
      }

      return tx.buyerAddress.create({
        data: {
          userId,
          name: dto.name?.trim() || null,
          recipientName: dto.recipientName?.trim() || null,
          recipientPhone: dto.recipientPhone?.trim() || null,
          addressText: dto.addressText.trim(),
          lat: dto.lat ?? null,
          lng: dto.lng ?? null,
          instructions: dto.instructions?.trim() || null,
          isDefault: makeDefault,
          addressKind: dto.addressKind ?? 'HOME',
          googlePlaceId: dto.googlePlaceId?.trim() || null,
          formattedAddress:
            dto.formattedAddress?.trim() || dto.addressText.trim(),
        },
      });
    });

    return this.shapeBuyerAddress(row);
  }

  async updateBuyerAddress(userId: string, id: string, dto: UpdateBuyerAddressDto) {
    const existing = await this.prisma.buyerAddress.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Address not found');

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.buyerAddress.updateMany({
          where: { userId, deletedAt: null, isDefault: true, NOT: { id } },
          data: { isDefault: false, updatedAt: new Date() },
        });
      }

      return tx.buyerAddress.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name?.trim() || null } : {}),
          ...(dto.recipientName !== undefined
            ? { recipientName: dto.recipientName?.trim() || null }
            : {}),
          ...(dto.recipientPhone !== undefined
            ? { recipientPhone: dto.recipientPhone?.trim() || null }
            : {}),
          ...(dto.addressText !== undefined
            ? { addressText: dto.addressText.trim() }
            : {}),
          ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
          ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
          ...(dto.instructions !== undefined
            ? { instructions: dto.instructions?.trim() || null }
            : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.addressKind !== undefined
            ? { addressKind: dto.addressKind }
            : {}),
          ...(dto.googlePlaceId !== undefined
            ? { googlePlaceId: dto.googlePlaceId?.trim() || null }
            : {}),
          ...(dto.formattedAddress !== undefined
            ? { formattedAddress: dto.formattedAddress?.trim() || null }
            : {}),
          updatedAt: new Date(),
        },
      });
    });

    return this.shapeBuyerAddress(row);
  }

  async deleteBuyerAddress(userId: string, id: string) {
    const existing = await this.prisma.buyerAddress.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Address not found');

    await this.prisma.buyerAddress.update({
      where: { id },
      data: { deletedAt: new Date(), isDefault: false, updatedAt: new Date() },
    });

    return { success: true };
  }

  async setDefaultBuyerAddress(userId: string, id: string) {
    const existing = await this.prisma.buyerAddress.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Address not found');

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.buyerAddress.updateMany({
        where: { userId, deletedAt: null, isDefault: true, NOT: { id } },
        data: { isDefault: false, updatedAt: new Date() },
      });
      return tx.buyerAddress.update({
        where: { id },
        data: { isDefault: true, updatedAt: new Date() },
      });
    });

    return this.shapeBuyerAddress(row);
  }

  private async requireFarmerProfile(userId: string) {
    const farmer = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!farmer) throw new NotFoundException('Farmer profile not found');
    return farmer;
  }

  private shapePickupLocation(row: any) {
    return {
      id: row.id,
      farmerProfileId: row.farmerProfileId,
      name: row.name,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      addressText: row.addressText,
      lat: toNumber(row.lat),
      lng: toNumber(row.lng),
      landmark: row.landmark,
      instructions: row.instructions,
      isDefault: row.isDefault,
      locationKind: row.locationKind,
      googlePlaceId: row.googlePlaceId ?? null,
      formattedAddress: row.formattedAddress ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private shapeBuyerAddress(row: any) {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      recipientName: row.recipientName,
      recipientPhone: row.recipientPhone,
      addressText: row.addressText,
      lat: toNumber(row.lat),
      lng: toNumber(row.lng),
      instructions: row.instructions,
      isDefault: row.isDefault,
      addressKind: row.addressKind,
      googlePlaceId: row.googlePlaceId ?? null,
      formattedAddress: row.formattedAddress ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private shapeProfile(profile: any, { includePhone }: { includePhone: boolean }) {
    return {
      id: profile.id,
      sellerPartyId: profile.sellerPartyId ?? profile.sellerParty?.id ?? null,
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

    const sellerParty = await this.sellerParties.ensureForFarmerProfile(farmer);

    let pickupLocationId: string | null = null;
    if (dto.pickupLocationId) {
      const pickup = await this.prisma.pickupLocation.findFirst({
        where: {
          id: dto.pickupLocationId,
          farmerProfileId: farmer.id,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!pickup) {
        throw new BadRequestException(
          'Pickup location not found or does not belong to this farmer',
        );
      }
      pickupLocationId = pickup.id;
    }

    const product = await this.resolveListingProduct(dto.productCode, dto.categoryCode);
    const categoryCode = product.category.code.toUpperCase();
    const listingFields = await this.buildListingWriteFields(dto, categoryCode);

    if (dto.stockLotId) {
      const lot = await this.prisma.stockLot.findUnique({ where: { id: dto.stockLotId } });
      if (!lot) throw new BadRequestException('Stock lot not found');
      await this.farms.assertFarmAccess(userId, lot.farmId, true);

      const listing = await this.prisma.$transaction(async (tx) => {
        const created = await tx.listing.create({
          data: {
            ...listingFields,
            farmerId: farmer.id,
            sellerPartyId: sellerParty.id,
            categoryId: product.categoryId,
            productId: product.id,
            stockLotId: lot.id,
            farmId: lot.farmId,
            pickupLocationId,
            harvestDate: new Date(dto.harvestDate),
            photoUrls: dto.photoUrls ?? [],
            moderationStatus: 'PENDING',
          },
          include: { category: { include: { marketplaceVertical: true } }, product: { include: { defaultUnit: true } }, sellerParty: true },
        });

        await this.reservations.reserveForListingTx(tx, {
          userId,
          lotId: lot.id,
          listingId: created.id,
          qty: listingFields.quantityKg,
          expectedProductId: product.id,
        });

        return created;
      });

      await this.listingAttributes.syncListingAttributes(
        listing.id,
        product.categoryId,
        {
          grade: listingFields.grade,
          processMethod: listingFields.processMethod,
          variety: listingFields.variety,
          region: listingFields.region,
          washingStation: listingFields.washingStation,
          altitudeM: listingFields.altitudeM,
          cupScore: listingFields.cupScore,
        },
        dto.attributes,
      );

      return this.shapeListingWithReservation(listing);
    }

    const listing = await this.prisma.listing.create({
      data: {
        ...listingFields,
        farmerId: farmer.id,
        sellerPartyId: sellerParty.id,
        categoryId: product.categoryId,
        productId: product.id,
        pickupLocationId,
        harvestDate: new Date(dto.harvestDate),
        photoUrls: dto.photoUrls ?? [],
        moderationStatus: 'PENDING',
      },
      include: {
        category: { include: { marketplaceVertical: true } },
        product: { include: { defaultUnit: true } },
        sellerParty: true,
      },
    });

    await this.listingAttributes.syncListingAttributes(
      listing.id,
      product.categoryId,
      {
        grade: listingFields.grade,
        processMethod: listingFields.processMethod,
        variety: listingFields.variety,
        region: listingFields.region,
        washingStation: listingFields.washingStation,
        altitudeM: listingFields.altitudeM,
        cupScore: listingFields.cupScore,
      },
      dto.attributes,
    );

    return this.enrichWithAttributes(this.shapeListing(listing));
  }

  async getMyListings(userId: string) {
    const farmer = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    if (!farmer) {
      throw new NotFoundException('Farmer profile not found');
    }

    const listings = await this.prisma.listing.findMany({
      where: { farmerId: farmer.id },
      include: { category: { include: { marketplaceVertical: true } }, product: { include: { defaultUnit: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: await this.enrichManyWithAttributes(
        listings.map((l: any) => this.shapeListing(l)),
      ),
    };
  }

  async getListings(query: QueryListingsDto) {
    const {
      categoryCode,
      productCode,
      farmerId,
      q,
      variety,
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

    const keywordOr = buildListingKeywordOr(q);

    const where = {
      status: 'ACTIVE' as const,
      moderationStatus: 'APPROVED',
      ...(farmerId ? { farmerId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(productId ? { productId } : {}),
      ...(variety ? { variety: { contains: variety, mode: 'insensitive' as const } } : {}),
      ...(regionList?.length ? { region: { in: regionList } } : {}),
      ...(gradeList?.length ? { grade: { in: gradeList as any } } : {}),
      ...(processMethod ? { processMethod } : {}),
      ...(minKg ? { quantityKg: { gte: minKg } } : {}),
      ...(maxPrice ? { pricePerKg: { lte: maxPrice } } : {}),
      ...(keywordOr ? { OR: keywordOr } : {}),
    };

    const orderBy =
      sort === 'price_asc'
        ? { pricePerKg: 'asc' as const }
        : sort === 'price_desc'
          ? { pricePerKg: 'desc' as const }
          : { createdAt: 'desc' as const };

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where: where as any,
        include: {
          farmer: { include: { user: true, cooperative: true } },
          category: { include: { marketplaceVertical: true } },
          product: { include: { defaultUnit: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where: where as any }),
    ]);

    return {
      data: await this.enrichManyWithAttributes(
        listings.map((l: any) => this.shapeListing(l, { includeFarmerSummary: true })),
      ),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getListingById(id: string, viewerUserId?: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        farmer: { include: { user: true, cooperative: true } },
        category: { include: { marketplaceVertical: true } },
        product: { include: { defaultUnit: true } },
      },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const isOwner =
      Boolean(viewerUserId) && listing.farmer?.userId === viewerUserId;

    if (isOwner) {
      // Owners may inspect their own listings regardless of moderation.
      return this.enrichWithAttributes(
        this.shapeListing(listing, { includeFarmerDetail: true }),
      );
    }

    if (
      listing.status !== 'ACTIVE' ||
      listing.moderationStatus !== 'APPROVED'
    ) {
      throw new NotFoundException('Listing not found');
    }
    return this.enrichWithAttributes(
      this.shapeListing(listing, { includeFarmerDetail: true }),
    );
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

    const {
      harvestDate,
      categoryCode,
      productCode,
      stockLotId: _ignoreLot,
      quantityKg,
      pricePerKg,
      quantity,
      unitCode,
      pricePerUnit,
      packagingLabel,
      packagingQuantity,
      qualityGrade,
      grade,
      processMethod,
      pickupLocationId: pickupLocationIdDto,
      attributes: _attributes,
      ...rest
    } = dto;

    let pickupLocationUpdate: { pickupLocationId: string | null } | undefined;
    if (pickupLocationIdDto !== undefined) {
      if (pickupLocationIdDto === null || pickupLocationIdDto === '') {
        pickupLocationUpdate = { pickupLocationId: null };
      } else {
        const pickup = await this.prisma.pickupLocation.findFirst({
          where: {
            id: pickupLocationIdDto,
            farmerProfileId: farmer.id,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!pickup) {
          throw new BadRequestException(
            'Pickup location not found or does not belong to this farmer',
          );
        }
        pickupLocationUpdate = { pickupLocationId: pickup.id };
      }
    }

    let productUpdate: { categoryId: string; productId: string } | undefined;
    let categoryCodeForRules =
      (listing as any).category?.code?.toUpperCase?.() ?? 'COFFEE';
    if (categoryCode !== undefined || productCode !== undefined) {
      const product = await this.resolveListingProduct(productCode, categoryCode);
      productUpdate = { categoryId: product.categoryId, productId: product.id };
      categoryCodeForRules = product.category.code.toUpperCase();
    } else if (listing.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: listing.categoryId } });
      if (cat) categoryCodeForRules = cat.code.toUpperCase();
    }

    let quantityUpdate: Record<string, unknown> = {};
    const touchesQuantity =
      quantityKg !== undefined ||
      pricePerKg !== undefined ||
      quantity !== undefined ||
      unitCode !== undefined ||
      pricePerUnit !== undefined;
    if (touchesQuantity) {
      try {
        const usingModern =
          quantity !== undefined || unitCode !== undefined || pricePerUnit !== undefined;
        const resolved = usingModern
          ? resolveListingQuantity({
              quantity: quantity ?? Number(listing.quantity ?? listing.quantityKg),
              unitCode: unitCode ?? listing.unitCode ?? 'KG',
              pricePerUnit: pricePerUnit ?? Number(listing.pricePerUnit ?? listing.pricePerKg),
            })
          : resolveListingQuantity({
              quantityKg: quantityKg ?? Number(listing.quantityKg),
              pricePerKg: pricePerKg ?? Number(listing.pricePerKg),
            });
        await this.assertUnitExists(resolved.unitCode);
        quantityUpdate = {
          quantity: resolved.quantity,
          unitCode: resolved.unitCode,
          pricePerUnit: resolved.pricePerUnit,
          quantityKg: resolved.quantityKg,
          pricePerKg: resolved.pricePerKg,
        };
      } catch (err) {
        if (err instanceof ListingContractError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
    }

    if (packagingLabel !== undefined) quantityUpdate.packagingLabel = packagingLabel || null;
    if (packagingQuantity !== undefined) {
      quantityUpdate.packagingQuantity = packagingQuantity ?? null;
    }

    let gradeUpdate: Record<string, unknown> = {};
    if (qualityGrade !== undefined || grade !== undefined || processMethod !== undefined) {
      if (categoryCodeForRules === 'COFFEE') {
        try {
          const coffee = assertCoffeeExtensionRequirements({
            qualityGrade: qualityGrade ?? grade ?? listing.grade ?? undefined,
            processMethod: processMethod ?? listing.processMethod ?? undefined,
          });
          gradeUpdate = {
            grade: coffee.grade as CoffeeGrade,
            processMethod: coffee.processMethod as ProcessMethod,
          };
        } catch (err) {
          if (err instanceof ListingContractError) {
            throw new BadRequestException(err.message);
          }
          throw err;
        }
      } else {
        if (qualityGrade !== undefined || grade !== undefined) {
          gradeUpdate.grade = (qualityGrade ?? grade) as CoffeeGrade;
        }
        if (processMethod !== undefined) gradeUpdate.processMethod = processMethod;
      }
    }

    const nextQuantityKg =
      quantityUpdate.quantityKg !== undefined
        ? Number(quantityUpdate.quantityKg)
        : Number(listing.quantityKg);

    if (touchesQuantity && listing.stockLotId) {
      const currentQty = Number(listing.quantityKg);
      const delta = nextQuantityKg - currentQty;
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
              ...quantityUpdate,
              ...gradeUpdate,
              ...(pickupLocationUpdate ?? {}),
              ...(harvestDate ? { harvestDate: new Date(harvestDate) } : {}),
              ...(productUpdate ?? {}),
              updatedAt: new Date(),
            },
          });
        });

        const updatedBound = await this.prisma.listing.findUnique({
          where: { id: listingId },
          include: { category: { include: { marketplaceVertical: true } }, product: { include: { defaultUnit: true } } },
        });
        await this.syncAttributesFromListing(updatedBound, dto.attributes);
        return this.shapeListingWithReservation(updatedBound);
      }
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        ...rest,
        ...quantityUpdate,
        ...gradeUpdate,
        ...(pickupLocationUpdate ?? {}),
        ...(harvestDate ? { harvestDate: new Date(harvestDate) } : {}),
        ...(productUpdate ?? {}),
        updatedAt: new Date(),
      },
      include: { category: { include: { marketplaceVertical: true } }, product: { include: { defaultUnit: true } } },
    });

    await this.syncAttributesFromListing(updated, dto.attributes);
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
        include: { category: { include: { marketplaceVertical: true } }, product: { include: { defaultUnit: true } } },
      });
    });

    return this.shapeListing(updated);
  }

  private async resolveListingProduct(productCode?: string, categoryCode?: string) {
    if (productCode) {
      const product = await this.catalog.findActiveProductByCode(productCode);
      if (
        !product ||
        !isProductSellable(
          product.category.isActive,
          product.status,
          product.category.sellEnabled ?? true,
        )
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
    if (
      !product ||
      !isProductSellable(category.isActive, product.status, category.sellEnabled ?? true)
    ) {
      throw new BadRequestException('This product category is not available yet');
    }

    return product;
  }

  private async assertUnitExists(unitCode: string) {
    const unit = await this.prisma.unit.findUnique({ where: { code: unitCode } });
    if (!unit) {
      throw new BadRequestException(`Unknown unitCode: ${unitCode}`);
    }
  }

  private async buildListingWriteFields(dto: CreateListingDto, categoryCode: string) {
    let resolved;
    try {
      resolved = resolveListingQuantity({
        quantity: dto.quantity,
        unitCode: dto.unitCode,
        pricePerUnit: dto.pricePerUnit,
        quantityKg: dto.quantityKg,
        pricePerKg: dto.pricePerKg,
      });
    } catch (err) {
      if (err instanceof ListingContractError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    await this.assertUnitExists(resolved.unitCode);

    let grade = dto.qualityGrade ?? dto.grade;
    let processMethod = dto.processMethod;

    if (categoryCode === 'COFFEE') {
      try {
        const coffee = assertCoffeeExtensionRequirements({
          qualityGrade: grade,
          processMethod,
        });
        grade = coffee.grade as CoffeeGrade;
        processMethod = coffee.processMethod as ProcessMethod;
      } catch (err) {
        if (err instanceof ListingContractError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
    }

    if (!grade || !processMethod) {
      // Legacy DB columns remain NOT NULL — coffee is the only sellable path in G1.
      throw new BadRequestException(
        'grade/qualityGrade and processMethod are required while coffee columns remain mandatory',
      );
    }

    return {
      region: dto.region,
      regionEn: dto.regionEn,
      woreda: dto.woreda,
      washingStation: dto.washingStation,
      cooperative: dto.cooperative,
      variety: dto.variety,
      altitudeM: dto.altitudeM,
      cupScore: dto.cupScore,
      grade,
      processMethod,
      quantity: resolved.quantity,
      unitCode: resolved.unitCode,
      pricePerUnit: resolved.pricePerUnit,
      quantityKg: resolved.quantityKg,
      pricePerKg: resolved.pricePerKg,
      packagingLabel: dto.packagingLabel,
      packagingQuantity: dto.packagingQuantity,
    };
  }

  private shapeCategoryFields(listing: any) {
    return {
      verticalCode: listing.category?.marketplaceVertical?.code ?? null,
      categoryCode: listing.category?.code ?? null,
      categoryNameEn: listing.category?.nameEn ?? null,
      categoryNameAm: listing.category?.nameAm ?? null,
      listingKind: listing.category?.listingKind ?? null,
    };
  }

  private shapeProductFields(listing: any) {
    const productCode = listing.product?.code ?? null;
    return {
      productId: listing.product?.id ?? listing.productId ?? null,
      productCode,
      productTypeCode: productCode,
      productNameEn: listing.product?.nameEn ?? null,
      productNameAm: listing.product?.nameAm ?? null,
      defaultUnitCode: listing.product?.defaultUnit?.code ?? null,
    };
  }

  private shapeListing(
    listing: any,
    opts: { includeFarmerSummary?: boolean; includeFarmerDetail?: boolean } = {},
  ) {
    const quantity = toNumber(listing.quantity) ?? toNumber(listing.quantityKg);
    const pricePerUnit = toNumber(listing.pricePerUnit) ?? toNumber(listing.pricePerKg);
    const unitCode = listing.unitCode ?? 'KG';
    const qualityGrade = listing.grade ?? null;

    const base = {
      id: listing.id,
      farmerId: listing.farmerId ?? listing.farmer?.id ?? null,
      sellerPartyId:
        listing.sellerPartyId ??
        listing.sellerParty?.id ??
        listing.farmer?.sellerPartyId ??
        null,
      sellerType:
        listing.sellerParty?.sellerTypeCode ??
        (listing.farmerId || listing.farmer ? 'FARMER' : null),
      ...this.shapeCategoryFields(listing),
      ...this.shapeProductFields(listing),
      stockLotId: listing.stockLotId ?? null,
      farmId: listing.farmId ?? null,
      pickupLocationId: listing.pickupLocationId ?? null,
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
      qualityGrade,
      variety: listing.variety,
      quantity,
      unitCode,
      pricePerUnit,
      packagingLabel: listing.packagingLabel ?? null,
      packagingQuantity: toNumber(listing.packagingQuantity),
      quantityKg: toNumber(listing.quantityKg),
      pricePerKg: toNumber(listing.pricePerKg),
      harvestDate: listing.harvestDate,
      altitudeM: toNumber(listing.altitudeM),
      cupScore: toNumber(listing.cupScore),
      photoUrls: listing.photoUrls,
      status: listing.status,
      moderationStatus: listing.moderationStatus ?? 'APPROVED',
      moderationNotes: listing.moderationNotes ?? null,
      moderatedAt: listing.moderatedAt ?? null,
      createdAt: listing.createdAt,
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
    };

    if (opts.includeFarmerSummary && listing.farmer) {
      return {
        ...base,
        farmerFirstName: listing.farmer.user?.firstName ?? null,
        farmerLastName: listing.farmer.user?.lastName ?? null,
        farmAltitude: toNumber(listing.farmer.altitudeM),
        farmerVerified: listing.farmer.verified,
        cooperativeName: listing.farmer.cooperative?.name ?? null,
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
    const withReservation = {
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
    return this.enrichWithAttributes(withReservation);
  }

  private async enrichWithAttributes<T extends { id?: string; attributes?: unknown }>(
    shaped: T,
  ): Promise<T & { attributes: unknown[] }> {
    if (!shaped?.id) {
      return { ...shaped, attributes: [] as unknown[] };
    }
    const attributes = await this.listingAttributes.loadValuesForListing(shaped.id);
    return { ...shaped, attributes };
  }

  private async enrichManyWithAttributes<T extends { id?: string }>(
    shaped: T[],
  ): Promise<Array<T & { attributes: unknown[] }>> {
    const map = await this.listingAttributes.loadValuesForListings(
      shaped.map((s) => s.id).filter(Boolean) as string[],
    );
    return shaped.map((s) => ({
      ...s,
      attributes: (s.id && map.get(s.id)) || [],
    }));
  }

  private async syncAttributesFromListing(
    listing: any,
    clientAttributes?: { code: string; value?: string | number | boolean | null }[],
  ) {
    if (!listing?.id) return;
    await this.listingAttributes.syncListingAttributes(
      listing.id,
      listing.categoryId,
      {
        grade: listing.grade,
        processMethod: listing.processMethod,
        variety: listing.variety,
        region: listing.region,
        washingStation: listing.washingStation,
        altitudeM: toNumber(listing.altitudeM),
        cupScore: toNumber(listing.cupScore),
        moisturePct: toNumber(listing.moisturePct),
        screenSize: listing.screenSize,
      },
      clientAttributes,
    );
  }
}
