import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import {
  CreateOnFarmSiteDto,
  QueryStorageSitesDto,
  UpdateStorageSiteDto,
} from './dto/warehouse.dto';

@Controller('warehouse')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FARMER')
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}

  @Get('sites')
  listMine(@CurrentUser() user: JwtPayload, @Query() query: QueryStorageSitesDto) {
    return this.warehouse.listMine(user.userId, query);
  }

  @Post('sites/on-farm')
  createOnFarm(@CurrentUser() user: JwtPayload, @Body() dto: CreateOnFarmSiteDto) {
    return this.warehouse.createOnFarm(user.userId, dto);
  }

  @Get('sites/:id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.warehouse.getSite(user.userId, id);
  }

  @Patch('sites/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStorageSiteDto,
  ) {
    return this.warehouse.updateSite(user.userId, id, dto);
  }
}
