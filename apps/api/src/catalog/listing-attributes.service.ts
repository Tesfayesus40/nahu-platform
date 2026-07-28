import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttributeInputValue,
  AttributeValidationError,
  coffeeColumnsToAttributeInputs,
  coerceAttributePayload,
  validateAttributeInputs,
} from './attribute.rules';
import { shapePresentationAttribute } from './listing-schema.rules';

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ListingAttributesService {
  constructor(private readonly prisma: PrismaService) {}

  async listUnits() {
    const units = await this.prisma.unit.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return units.map((u) => ({
      code: u.code,
      nameEn: u.nameEn,
      nameAm: u.nameAm,
      dimension: u.dimension,
      sortOrder: u.sortOrder,
    }));
  }

  async listDefinitionsForCategory(categoryId: string) {
    const defs = await this.prisma.attributeDefinition.findMany({
      where: {
        isActive: true,
        OR: [
          { categoryId, scope: 'CATEGORY' },
          { product: { categoryId }, scope: 'PRODUCT' },
        ],
      },
      include: {
        enumSet: {
          include: {
            values: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        unit: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return defs.map((d) => this.shapeDefinition(d));
  }

  async listDefinitionsByCategoryCode(categoryCode: string) {
    const category = await this.prisma.category.findFirst({
      where: { code: categoryCode.toUpperCase() },
    });
    if (!category) return [];
    return this.listDefinitionsForCategory(category.id);
  }

  async loadValuesForListing(listingId: string) {
    const map = await this.loadValuesForListings([listingId]);
    return map.get(listingId) ?? [];
  }

  async loadValuesForListings(listingIds: string[]) {
    if (!listingIds.length) {
      return new Map<string, ReturnType<ListingAttributesService['shapeValue']>[]>();
    }
    const rows = await this.prisma.listingAttributeValue.findMany({
      where: { listingId: { in: listingIds } },
      include: {
        attributeDefinition: true,
        enumValue: true,
      },
      orderBy: { attributeDefinition: { sortOrder: 'asc' } },
    });
    const map = new Map<string, ReturnType<ListingAttributesService['shapeValue']>[]>();
    for (const r of rows) {
      const list = map.get(r.listingId) ?? [];
      list.push(this.shapeValue(r));
      map.set(r.listingId, list);
    }
    return map;
  }

  /**
   * Dual-write coffee (or any) listing columns into attribute values.
   * Merges optional client `attributes` array over column-derived values.
   */
  async syncListingAttributes(
    listingId: string,
    categoryId: string | null | undefined,
    listingColumns: {
      grade?: string | null;
      processMethod?: string | null;
      variety?: string | null;
      region?: string | null;
      washingStation?: string | null;
      altitudeM?: number | null;
      cupScore?: number | null;
      moisturePct?: number | null;
      screenSize?: string | null;
    },
    clientAttributes?: AttributeInputValue[],
    tx?: Tx,
  ) {
    if (!categoryId) return;
    const db = tx ?? this.prisma;

    const defs = await db.attributeDefinition.findMany({
      where: { categoryId, isActive: true, scope: 'CATEGORY' },
      include: {
        enumSet: {
          include: { values: { where: { isActive: true } } },
        },
      },
    });
    if (!defs.length) return;

    const fromColumns = coffeeColumnsToAttributeInputs(listingColumns);
    const merged = new Map<string, string | number | boolean | null>();
    for (const item of fromColumns) {
      merged.set(item.code.toLowerCase(), item.value ?? null);
    }
    for (const [k, v] of coerceAttributePayload(clientAttributes)) {
      merged.set(k, v);
    }

    const defLikes = defs.map((d) => ({
      code: d.code,
      dataType: d.dataType as
        | 'TEXT'
        | 'NUMBER'
        | 'DECIMAL'
        | 'BOOLEAN'
        | 'DATE'
        | 'ENUM',
      isRequired: d.isRequired,
      validationJson: (d.validationJson ?? {}) as Record<string, unknown>,
      enumCodes: d.enumSet?.values?.map((v) => v.code) ?? [],
    }));

    try {
      // Coffee RC1 still enforces required via column path; here validate only present attrs
      // plus required defs that have values from columns.
      validateAttributeInputs(defLikes, merged, { enforceRequired: false });
    } catch (err) {
      if (err instanceof AttributeValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    for (const def of defs) {
      const raw = merged.get(def.code.toLowerCase());
      if (raw === undefined || raw === null || raw === '') {
        continue;
      }

      const data = this.buildValueRow(def, raw);
      await db.listingAttributeValue.upsert({
        where: {
          listingId_attributeDefinitionId: {
            listingId,
            attributeDefinitionId: def.id,
          },
        },
        create: {
          listingId,
          attributeDefinitionId: def.id,
          ...data,
        },
        update: {
          ...data,
          updatedAt: new Date(),
        },
      });
    }
  }

  shapeDefinition(d: any) {
    return {
      code: d.code,
      nameEn: d.nameEn,
      nameAm: d.nameAm,
      dataType: d.dataType,
      scope: d.scope,
      isRequired: d.isRequired,
      isFilterable: d.isFilterable,
      isFacetable: d.isFacetable,
      isListedInCard: d.isListedInCard,
      isVisible: d.isVisible ?? true,
      isEditable: d.isEditable ?? true,
      isSortable: d.isSortable ?? false,
      searchFilterType: d.searchFilterType ?? 'NONE',
      controlType: d.controlType ?? 'text',
      helpTextEn: d.helpTextEn ?? null,
      helpTextAm: d.helpTextAm ?? null,
      placeholderEn: d.placeholderEn ?? null,
      placeholderAm: d.placeholderAm ?? null,
      sectionCode: d.sectionCode ?? null,
      sectionNameEn: d.sectionNameEn ?? null,
      sectionNameAm: d.sectionNameAm ?? null,
      unitCode: d.unitCode ?? d.unit?.code ?? null,
      unitDimension: d.unitDimension,
      validation: d.validationJson ?? {},
      legacyColumn: d.legacyColumn ?? null,
      sortOrder: d.sortOrder,
      enumSetCode: d.enumSet?.code ?? null,
      enumValues: (d.enumSet?.values ?? []).map((v: any) => ({
        code: v.code,
        nameEn: v.nameEn,
        nameAm: v.nameAm,
        sortOrder: v.sortOrder,
      })),
    };
  }

  shapeValue(r: any) {
    const def = r.attributeDefinition;
    let value: string | number | boolean | null = null;
    if (r.valueText != null) value = r.valueText;
    else if (r.valueNum != null) value = Number(r.valueNum);
    else if (r.valueBool != null) value = r.valueBool;
    else if (r.valueDate != null) {
      value = r.valueDate.toISOString?.()?.slice(0, 10) ?? String(r.valueDate);
    }

    const enumCode =
      r.enumValue?.code ?? (def.dataType === 'ENUM' ? r.valueText : null);

    return shapePresentationAttribute({
      code: def.code,
      nameEn: def.nameEn,
      nameAm: def.nameAm,
      dataType: def.dataType,
      value,
      enumCode,
      enumNameEn: r.enumValue?.nameEn ?? null,
      enumNameAm: r.enumValue?.nameAm ?? null,
      unitCode: def.unitCode ?? null,
      sectionCode: def.sectionCode ?? null,
      sectionNameEn: def.sectionNameEn ?? null,
      sortOrder: def.sortOrder ?? 0,
      isListedInCard: def.isListedInCard ?? false,
    });
  }

  private buildValueRow(def: any, raw: string | number | boolean) {
    const row: {
      valueText: string | null;
      valueNum: number | null;
      valueBool: boolean | null;
      valueDate: Date | null;
      enumValueId: string | null;
    } = {
      valueText: null,
      valueNum: null,
      valueBool: null,
      valueDate: null,
      enumValueId: null,
    };

    switch (def.dataType) {
      case 'ENUM': {
        const code = String(raw).toUpperCase();
        const ev = def.enumSet?.values?.find(
          (v: any) => v.code.toUpperCase() === code,
        );
        row.valueText = code;
        row.enumValueId = ev?.id ?? null;
        break;
      }
      case 'TEXT':
        row.valueText = String(raw);
        break;
      case 'NUMBER':
      case 'DECIMAL':
        row.valueNum = Number(raw);
        break;
      case 'BOOLEAN':
        row.valueBool =
          typeof raw === 'boolean' ? raw : String(raw).toLowerCase() === 'true';
        break;
      case 'DATE':
        row.valueDate = new Date(String(raw));
        break;
      default:
        row.valueText = String(raw);
    }

    return row;
  }
}
