import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CroppingCyclesService } from './cropping-cycles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import {
  CreateCroppingCycleDto,
  CreateCycleLineDto,
  QueryCroppingCyclesDto,
  UpdateCroppingCycleDto,
  UpdateCycleLineDto,
} from './dto/cropping-cycle.dto';

@Controller()
export class CroppingCyclesController {
  constructor(private readonly cycles: CroppingCyclesService) {}

  @Get('season-codes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  listSeasonCodes() {
    return this.cycles.listSeasonCodes();
  }

  @Get('farms/:farmId/cropping-cycles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  listForFarm(
    @CurrentUser() user: JwtPayload,
    @Param('farmId') farmId: string,
    @Query() query: QueryCroppingCyclesDto,
  ) {
    return this.cycles.listForFarm(user.userId, farmId, query);
  }

  @Post('farms/:farmId/cropping-cycles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('farmId') farmId: string,
    @Body() dto: CreateCroppingCycleDto,
  ) {
    return this.cycles.create(user.userId, farmId, dto);
  }

  @Get('farms/:farmId/production-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  productionHistory(
    @CurrentUser() user: JwtPayload,
    @Param('farmId') farmId: string,
  ) {
    return this.cycles.productionHistory(user.userId, farmId);
  }

  @Get('cropping-cycles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cycles.getOne(user.userId, id);
  }

  @Patch('cropping-cycles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCroppingCycleDto,
  ) {
    return this.cycles.update(user.userId, id, dto);
  }

  @Post('cropping-cycles/:id/plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  plan(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cycles.transition(user.userId, id, 'plan');
  }

  @Post('cropping-cycles/:id/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  start(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cycles.transition(user.userId, id, 'start');
  }

  @Post('cropping-cycles/:id/mark-harvested')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  markHarvested(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cycles.transition(user.userId, id, 'mark-harvested');
  }

  @Post('cropping-cycles/:id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  complete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cycles.transition(user.userId, id, 'complete');
  }

  @Post('cropping-cycles/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cycles.transition(user.userId, id, 'cancel');
  }

  @Post('cropping-cycles/:id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  archive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cycles.transition(user.userId, id, 'archive');
  }

  @Get('cropping-cycles/:id/performance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  performance(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cycles.performance(user.userId, id);
  }

  @Post('cropping-cycles/:id/lines')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  addLine(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateCycleLineDto,
  ) {
    return this.cycles.addLine(user.userId, id, dto);
  }

  @Patch('cropping-cycle-lines/:lineId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  updateLine(
    @CurrentUser() user: JwtPayload,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateCycleLineDto,
  ) {
    return this.cycles.updateLine(user.userId, lineId, dto);
  }

  @Delete('cropping-cycle-lines/:lineId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  deleteLine(
    @CurrentUser() user: JwtPayload,
    @Param('lineId') lineId: string,
  ) {
    return this.cycles.deleteLine(user.userId, lineId);
  }
}
