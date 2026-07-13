import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { QueryCategoriesDto } from './dto/query-categories.dto';

@Controller('categories')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  listCategories(@Query() query: QueryCategoriesDto) {
    return this.catalog.listCategories(query);
  }
}
