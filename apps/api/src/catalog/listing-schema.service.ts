import { Injectable } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ListingAttributesService } from './listing-attributes.service';
import {
  buildListingSchemaResponse,
  buildSearchMetadata,
} from './listing-schema.rules';

@Injectable()
export class ListingSchemaService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly listingAttributes: ListingAttributesService,
  ) {}

  async getListingSchema(opts: {
    categoryCode: string;
    schemaId?: string;
  }) {
    const category = await this.catalog.getCategoryByCode(opts.categoryCode);
    const [attributes, units] = await Promise.all([
      this.listingAttributes.listDefinitionsByCategoryCode(category.code),
      this.listingAttributes.listUnits(),
    ]);

    return buildListingSchemaResponse({
      schemaId: opts.schemaId || 'listing.create',
      category: {
        code: category.code,
        nameEn: category.nameEn,
        nameAm: category.nameAm,
        verticalCode: category.verticalCode,
        listingKind: category.listingKind,
        sellEnabled: category.sellEnabled,
      },
      attributes,
      units,
      version: '1.0.0',
    });
  }

  async getSearchMetadata(categoryCode: string) {
    const category = await this.catalog.getCategoryByCode(categoryCode);
    const attributes = await this.listingAttributes.listDefinitionsByCategoryCode(
      category.code,
    );
    return {
      categoryCode: category.code,
      verticalCode: category.verticalCode,
      ...buildSearchMetadata(attributes),
    };
  }
}
