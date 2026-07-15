import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FarmsService } from './farms.service';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import { CreateFarmDto, QueryFarmsDto, UpdateFarmDto } from './dto/farm.dto';
import { CreatePlotDto, UpdatePlotDto } from './dto/plot.dto';
import { QueryDashboardDto } from './dto/dashboard.dto';

@Controller('farms')
export class FarmsController {
  constructor(
    private readonly farms: FarmsService,
    private readonly dashboard: DashboardService,
  ) {}

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  listMine(@CurrentUser() user: JwtPayload, @Query() query: QueryFarmsDto) {
    return this.farms.listMine(user.userId, query);
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  getDashboard(@CurrentUser() user: JwtPayload, @Query() query: QueryDashboardDto) {
    return this.dashboard.getDashboard(user.userId, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateFarmDto) {
    return this.farms.createFarm(user.userId, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.farms.getFarm(user.userId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateFarmDto,
  ) {
    return this.farms.updateFarm(user.userId, id, dto);
  }

  @Get(':farmId/plots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  listPlots(@CurrentUser() user: JwtPayload, @Param('farmId') farmId: string) {
    return this.farms.listPlots(user.userId, farmId);
  }

  @Post(':farmId/plots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  createPlot(
    @CurrentUser() user: JwtPayload,
    @Param('farmId') farmId: string,
    @Body() dto: CreatePlotDto,
  ) {
    return this.farms.createPlot(user.userId, farmId, dto);
  }
}

@Controller('plots')
export class PlotsController {
  constructor(private readonly farms: FarmsService) {}

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePlotDto,
  ) {
    return this.farms.updatePlot(user.userId, id, dto);
  }
}
