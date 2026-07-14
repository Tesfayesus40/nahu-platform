import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { QueryProductsDto } from './dto/query-products.dto';

const productInclude = {
  category: true,
  defaultUnit: true,
  varieties: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories({ activeOnly }: QueryCategoriesDto = {}) {
    const categories = await this.prisma.category.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: 'asc' },
    });

    return categories.map((category) => ({
      code: category.code,
      nameEn: category.nameEn,
      nameAm: category.nameAm,
      descriptionEn: category.descriptionEn,
      descriptionAm: category.descriptionAm,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    }));
  }

  async listProducts(query: QueryProductsDto = {}) {
    const { categoryCode, activeOnly = true, page = 1, limit = 20 } = query;

    const where: Prisma.ProductWhereInput = {
      ...(activeOnly ? { status: 'ACTIVE' } : {}),
      ...(categoryCode
        ? { category: { code: categoryCode.toUpperCase() } }
        : {}),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((product) => this.shapeProduct(product)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getProductByCodeOrId(codeOrId: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        codeOrId,
      );

    const product = await this.prisma.product.findFirst({
      where: isUuid
        ? { id: codeOrId, status: 'ACTIVE' }
        : { code: codeOrId.toUpperCase(), status: 'ACTIVE' },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.shapeProduct(product);
  }

  async findActiveCategoryByCode(code: string) {
    return this.prisma.category.findFirst({
      where: { code: code.toUpperCase(), isActive: true },
    });
  }

  async findCoffeeCategory() {
    return this.findActiveCategoryByCode('COFFEE');
  }

  async findActiveProductByCode(code: string) {
    return this.prisma.product.findFirst({
      where: { code: code.toUpperCase(), status: 'ACTIVE' },
      include: { category: true, defaultUnit: true },
    });
  }

  async findDefaultActiveProduct(categoryId: string) {
    return this.prisma.product.findFirst({
      where: {
        categoryId,
        isDefault: true,
        status: 'ACTIVE',
      },
      include: { category: true, defaultUnit: true },
    });
  }

  private shapeProduct(
    product: Prisma.ProductGetPayload<{ include: typeof productInclude }>,
  ) {
    return {
      id: product.id,
      code: product.code,
      categoryCode: product.category.code,
      categoryNameEn: product.category.nameEn,
      categoryNameAm: product.category.nameAm,
      nameEn: product.nameEn,
      nameAm: product.nameAm,
      descriptionEn: product.descriptionEn,
      descriptionAm: product.descriptionAm,
      defaultUnitCode: product.defaultUnit.code,
      defaultUnitNameEn: product.defaultUnit.nameEn,
      defaultUnitNameAm: product.defaultUnit.nameAm,
      dimension: product.defaultUnit.dimension,
      status: product.status,
      isDefault: product.isDefault,
      sortOrder: product.sortOrder,
      varieties: product.varieties.map((variety) => ({
        code: variety.code,
        nameEn: variety.nameEn,
        nameAm: variety.nameAm,
        isActive: variety.isActive,
      })),
    };
  }
}
