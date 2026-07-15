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
import { HarvestService } from './harvest.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import {
  CreateHarvestSessionDto,
  HarvestLineInputDto,
  QueryHarvestSessionsDto,
  UpdateHarvestSessionDto,
} from './dto/harvest.dto';

@Controller()
export class HarvestController {
  constructor(private readonly harvest: HarvestService) {}

  @Get('farms/:farmId/harvest-sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  listForFarm(
    @CurrentUser() user: JwtPayload,
    @Param('farmId') farmId: string,
    @Query() query: QueryHarvestSessionsDto,
  ) {
    return this.harvest.listForFarm(user.userId, farmId, query);
  }

  @Post('farms/:farmId/harvest-sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('farmId') farmId: string,
    @Body() dto: CreateHarvestSessionDto,
  ) {
    return this.harvest.create(user.userId, farmId, dto);
  }

  @Get('farms/:farmId/harvest-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  history(
    @CurrentUser() user: JwtPayload,
    @Param('farmId') farmId: string,
  ) {
    return this.harvest.harvestHistory(user.userId, farmId);
  }

  @Get('harvest-sessions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.harvest.getOne(user.userId, id);
  }

  @Patch('harvest-sessions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateHarvestSessionDto,
  ) {
    return this.harvest.update(user.userId, id, dto);
  }

  @Delete('harvest-sessions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.harvest.deleteSession(user.userId, id);
  }

  @Post('harvest-sessions/:id/lines')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  addLine(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: HarvestLineInputDto,
  ) {
    return this.harvest.addLine(user.userId, id, dto);
  }

  @Post('harvest-sessions/:id/post')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  post(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.harvest.post(user.userId, id);
  }

  @Patch('harvest-lines/:lineId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  updateLine(
    @CurrentUser() user: JwtPayload,
    @Param('lineId') lineId: string,
    @Body() dto: HarvestLineInputDto,
  ) {
    return this.harvest.updateLine(user.userId, lineId, dto);
  }

  @Delete('harvest-lines/:lineId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  deleteLine(
    @CurrentUser() user: JwtPayload,
    @Param('lineId') lineId: string,
  ) {
    return this.harvest.deleteLine(user.userId, lineId);
  }
}
