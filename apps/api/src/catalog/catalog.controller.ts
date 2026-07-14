import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { QueryProductsDto } from './dto/query-products.dto';

@Controller('categories')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  listCategories(@Query() query: QueryCategoriesDto) {
    return this.catalog.listCategories(query);
  }
}

@Controller('products')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  listProducts(@Query() query: QueryProductsDto) {
    return this.catalog.listProducts(query);
  }

  @Get(':codeOrId')
  getProduct(@Param('codeOrId') codeOrId: string) {
    return this.catalog.getProductByCodeOrId(codeOrId);
  }
}
