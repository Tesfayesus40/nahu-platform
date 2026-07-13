import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryCategoriesDto } from './dto/query-categories.dto';

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

  async findActiveCategoryByCode(code: string) {
    return this.prisma.category.findFirst({
      where: { code: code.toUpperCase(), isActive: true },
    });
  }

  async findCoffeeCategory() {
    return this.findActiveCategoryByCode('COFFEE');
  }
}
