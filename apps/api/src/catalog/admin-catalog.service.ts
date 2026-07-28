import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';
import { isListingKind } from './product-resolve.rules';

const ADMIN_WRITE_FLAG = 'catalog.admin.write.enabled';

@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async listVerticals() {
    return this.catalog.listVerticals();
  }

  async updateVertical(
    code: string,
    dto: {
      nameEn?: string;
      nameAm?: string | null;
      description?: string | null;
      defaultBrand?: string | null;
      complianceProfileCode?: string | null;
      isActive?: boolean;
      sortOrder?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.assertAdminWriteEnabled();
    const existing = await this.requireVertical(code);

    const updated = await this.prisma.marketplaceVertical.update({
      where: { id: existing.id },
      data: {
        nameEn: dto.nameEn ?? undefined,
        nameAm: dto.nameAm === undefined ? undefined : dto.nameAm,
        description: dto.description === undefined ? undefined : dto.description,
        defaultBrand: dto.defaultBrand === undefined ? undefined : dto.defaultBrand,
        complianceProfileCode:
          dto.complianceProfileCode === undefined
            ? undefined
            : dto.complianceProfileCode,
        isActive: dto.isActive ?? undefined,
        sortOrder: dto.sortOrder ?? undefined,
        metadata:
          dto.metadata === undefined
            ? undefined
            : (dto.metadata as Prisma.InputJsonValue),
        updatedAt: new Date(),
      },
    });

    return this.catalog.shapeVertical(updated);
  }

  async listCategories(opts: { verticalCode?: string } = {}) {
    const where: Prisma.CategoryWhereInput = opts.verticalCode
      ? { marketplaceVertical: { code: opts.verticalCode.toUpperCase() } }
      : {};

    const categories = await this.prisma.category.findMany({
      where,
      include: { marketplaceVertical: true },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });

    return categories.map((c) => this.catalog.shapeCategory(c));
  }

  async createCategory(dto: {
    code: string;
    verticalCode: string;
    nameEn: string;
    nameAm: string;
    descriptionEn?: string | null;
    descriptionAm?: string | null;
    listingKind?: string;
    sellEnabled?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    await this.assertAdminWriteEnabled();
    const vertical = await this.requireVertical(dto.verticalCode);
    const code = dto.code.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,48}$/.test(code)) {
      throw new BadRequestException(
        'code must be uppercase snake (letters, digits, underscore)',
      );
    }
    const listingKind = (dto.listingKind ?? 'GOODS').toUpperCase();
    if (!isListingKind(listingKind)) {
      throw new BadRequestException('listingKind must be GOODS, SUPPLIES, or SERVICE');
    }

    try {
      const created = await this.prisma.category.create({
        data: {
          code,
          marketplaceVerticalId: vertical.id,
          nameEn: dto.nameEn.trim(),
          nameAm: dto.nameAm.trim(),
          descriptionEn: dto.descriptionEn ?? null,
          descriptionAm: dto.descriptionAm ?? null,
          listingKind,
          sellEnabled: dto.sellEnabled ?? false,
          isActive: dto.isActive ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
        include: { marketplaceVertical: true },
      });
      return this.catalog.shapeCategory(created);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(`Category code already exists: ${code}`);
      }
      throw err;
    }
  }

  async updateCategory(
    code: string,
    dto: {
      verticalCode?: string;
      nameEn?: string;
      nameAm?: string;
      descriptionEn?: string | null;
      descriptionAm?: string | null;
      listingKind?: string;
      sellEnabled?: boolean;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    await this.assertAdminWriteEnabled();
    const existing = await this.requireCategory(code);

    let marketplaceVerticalId: string | undefined;
    if (dto.verticalCode) {
      const vertical = await this.requireVertical(dto.verticalCode);
      marketplaceVerticalId = vertical.id;
    }

    let listingKind: string | undefined;
    if (dto.listingKind !== undefined) {
      listingKind = dto.listingKind.toUpperCase();
      if (!isListingKind(listingKind)) {
        throw new BadRequestException(
          'listingKind must be GOODS, SUPPLIES, or SERVICE',
        );
      }
    }

    const updated = await this.prisma.category.update({
      where: { id: existing.id },
      data: {
        marketplaceVerticalId,
        nameEn: dto.nameEn?.trim(),
        nameAm: dto.nameAm?.trim(),
        descriptionEn:
          dto.descriptionEn === undefined ? undefined : dto.descriptionEn,
        descriptionAm:
          dto.descriptionAm === undefined ? undefined : dto.descriptionAm,
        listingKind,
        sellEnabled: dto.sellEnabled,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
        updatedAt: new Date(),
      },
      include: { marketplaceVertical: true },
    });

    return this.catalog.shapeCategory(updated);
  }

  async listProducts(opts: { categoryCode?: string } = {}) {
    const where: Prisma.ProductWhereInput = opts.categoryCode
      ? { category: { code: opts.categoryCode.toUpperCase() } }
      : {};

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: { include: { marketplaceVertical: true } },
        defaultUnit: true,
        varieties: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });

    return products.map((p) => ({
      id: p.id,
      code: p.code,
      productTypeCode: p.code,
      productCode: p.code,
      categoryCode: p.category.code,
      verticalCode: p.category.marketplaceVertical.code,
      nameEn: p.nameEn,
      nameAm: p.nameAm,
      descriptionEn: p.descriptionEn,
      descriptionAm: p.descriptionAm,
      defaultUnitCode: p.defaultUnitCode,
      status: p.status,
      isDefault: p.isDefault,
      sortOrder: p.sortOrder,
      varieties: p.varieties.map((v) => ({
        id: v.id,
        code: v.code,
        nameEn: v.nameEn,
        nameAm: v.nameAm,
        isActive: v.isActive,
        sortOrder: v.sortOrder,
      })),
    }));
  }

  async createProduct(dto: {
    code: string;
    categoryCode: string;
    nameEn: string;
    nameAm: string;
    descriptionEn?: string | null;
    descriptionAm?: string | null;
    defaultUnitCode?: string;
    status?: ProductStatus;
    isDefault?: boolean;
    sortOrder?: number;
  }) {
    await this.assertAdminWriteEnabled();
    const category = await this.requireCategory(dto.categoryCode);
    const code = dto.code.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,78}$/.test(code)) {
      throw new BadRequestException(
        'code must be uppercase snake (letters, digits, underscore)',
      );
    }

    const unitCode = (dto.defaultUnitCode ?? 'KG').toUpperCase();
    const unit = await this.prisma.unit.findUnique({ where: { code: unitCode } });
    if (!unit) {
      throw new BadRequestException(`Unknown defaultUnitCode: ${unitCode}`);
    }

    if (dto.isDefault) {
      await this.prisma.product.updateMany({
        where: { categoryId: category.id, isDefault: true },
        data: { isDefault: false, updatedAt: new Date() },
      });
    }

    try {
      const created = await this.prisma.product.create({
        data: {
          code,
          categoryId: category.id,
          nameEn: dto.nameEn.trim(),
          nameAm: dto.nameAm.trim(),
          descriptionEn: dto.descriptionEn ?? null,
          descriptionAm: dto.descriptionAm ?? null,
          defaultUnitCode: unitCode,
          status: dto.status ?? 'INACTIVE',
          isDefault: dto.isDefault ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      return this.getAdminProduct(created.code);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(`Product code already exists: ${code}`);
      }
      throw err;
    }
  }

  async updateProduct(
    code: string,
    dto: {
      categoryCode?: string;
      nameEn?: string;
      nameAm?: string;
      descriptionEn?: string | null;
      descriptionAm?: string | null;
      defaultUnitCode?: string;
      status?: ProductStatus;
      isDefault?: boolean;
      sortOrder?: number;
    },
  ) {
    await this.assertAdminWriteEnabled();
    const existing = await this.requireProduct(code);

    let categoryId: string | undefined;
    if (dto.categoryCode) {
      const category = await this.requireCategory(dto.categoryCode);
      categoryId = category.id;
    }

    if (dto.defaultUnitCode) {
      const unit = await this.prisma.unit.findUnique({
        where: { code: dto.defaultUnitCode.toUpperCase() },
      });
      if (!unit) {
        throw new BadRequestException(
          `Unknown defaultUnitCode: ${dto.defaultUnitCode}`,
        );
      }
    }

    const targetCategoryId = categoryId ?? existing.categoryId;
    if (dto.isDefault === true) {
      await this.prisma.product.updateMany({
        where: {
          categoryId: targetCategoryId,
          isDefault: true,
          NOT: { id: existing.id },
        },
        data: { isDefault: false, updatedAt: new Date() },
      });
    }

    await this.prisma.product.update({
      where: { id: existing.id },
      data: {
        categoryId,
        nameEn: dto.nameEn?.trim(),
        nameAm: dto.nameAm?.trim(),
        descriptionEn:
          dto.descriptionEn === undefined ? undefined : dto.descriptionEn,
        descriptionAm:
          dto.descriptionAm === undefined ? undefined : dto.descriptionAm,
        defaultUnitCode: dto.defaultUnitCode?.toUpperCase(),
        status: dto.status,
        isDefault: dto.isDefault,
        sortOrder: dto.sortOrder,
        updatedAt: new Date(),
      },
    });

    return this.getAdminProduct(existing.code);
  }

  async listVarieties(productCode: string) {
    const product = await this.requireProduct(productCode);
    const varieties = await this.prisma.productVariety.findMany({
      where: { productId: product.id },
      orderBy: { sortOrder: 'asc' },
    });
    return varieties.map((v) => ({
      id: v.id,
      productCode: product.code,
      code: v.code,
      nameEn: v.nameEn,
      nameAm: v.nameAm,
      isActive: v.isActive,
      sortOrder: v.sortOrder,
    }));
  }

  async createVariety(
    productCode: string,
    dto: {
      code: string;
      nameEn: string;
      nameAm: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    await this.assertAdminWriteEnabled();
    const product = await this.requireProduct(productCode);
    const code = dto.code.trim().toUpperCase();

    try {
      const created = await this.prisma.productVariety.create({
        data: {
          productId: product.id,
          code,
          nameEn: dto.nameEn.trim(),
          nameAm: dto.nameAm.trim(),
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      return {
        id: created.id,
        productCode: product.code,
        code: created.code,
        nameEn: created.nameEn,
        nameAm: created.nameAm,
        isActive: created.isActive,
        sortOrder: created.sortOrder,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Variety code already exists for this product: ${code}`,
        );
      }
      throw err;
    }
  }

  async updateVariety(
    productCode: string,
    varietyCode: string,
    dto: {
      nameEn?: string;
      nameAm?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    await this.assertAdminWriteEnabled();
    const product = await this.requireProduct(productCode);
    const variety = await this.prisma.productVariety.findFirst({
      where: {
        productId: product.id,
        code: varietyCode.toUpperCase(),
      },
    });
    if (!variety) {
      throw new NotFoundException('Variety not found');
    }

    const updated = await this.prisma.productVariety.update({
      where: { id: variety.id },
      data: {
        nameEn: dto.nameEn?.trim(),
        nameAm: dto.nameAm?.trim(),
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
        updatedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      productCode: product.code,
      code: updated.code,
      nameEn: updated.nameEn,
      nameAm: updated.nameAm,
      isActive: updated.isActive,
      sortOrder: updated.sortOrder,
    };
  }

  private async getAdminProduct(code: string) {
    const rows = await this.listProducts();
    const found = rows.find((p) => p.code === code.toUpperCase());
    if (!found) throw new NotFoundException('Product not found');
    return found;
  }

  private async requireVertical(code: string) {
    const vertical = await this.prisma.marketplaceVertical.findFirst({
      where: { code: code.toUpperCase() },
    });
    if (!vertical) {
      throw new NotFoundException(`Marketplace vertical not found: ${code}`);
    }
    return vertical;
  }

  private async requireCategory(code: string) {
    const category = await this.prisma.category.findFirst({
      where: { code: code.toUpperCase() },
      include: { marketplaceVertical: true },
    });
    if (!category) {
      throw new NotFoundException(`Category not found: ${code}`);
    }
    return category;
  }

  private async requireProduct(code: string) {
    const product = await this.prisma.product.findFirst({
      where: { code: code.toUpperCase() },
    });
    if (!product) {
      throw new NotFoundException(`Product not found: ${code}`);
    }
    return product;
  }

  private async assertAdminWriteEnabled() {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { code: ADMIN_WRITE_FLAG },
    });
    if (flag && !flag.enabled) {
      throw new ServiceUnavailableException(
        'Catalog admin writes are disabled (catalog.admin.write.enabled)',
      );
    }
  }
}
