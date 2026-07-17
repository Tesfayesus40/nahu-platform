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
import { FarmActivitiesService } from './farm-activities.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import {
  CreateFarmActivityDto,
  QueryFarmActivitiesDto,
  UpdateFarmActivityDto,
} from './dto/farm-activity.dto';

@Controller()
export class FarmActivitiesController {
  constructor(private readonly activities: FarmActivitiesService) {}

  @Get('activity-types')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  listTypes() {
    return this.activities.listTypes();
  }

  @Get('farms/:farmId/activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  listForFarm(
    @CurrentUser() user: JwtPayload,
    @Param('farmId') farmId: string,
    @Query() query: QueryFarmActivitiesDto,
  ) {
    return this.activities.listForFarm(user.userId, farmId, query);
  }

  @Post('farms/:farmId/activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('farmId') farmId: string,
    @Body() dto: CreateFarmActivityDto,
  ) {
    return this.activities.create(user.userId, farmId, dto);
  }

  @Get('farms/:farmId/activity-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  history(
    @CurrentUser() user: JwtPayload,
    @Param('farmId') farmId: string,
  ) {
    return this.activities.history(user.userId, farmId);
  }

  @Get('cropping-cycles/:id/activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  listForCycle(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.activities.listForCycle(user.userId, id);
  }

  @Get('farm-activities/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.activities.getOne(user.userId, id);
  }

  @Patch('farm-activities/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateFarmActivityDto,
  ) {
    return this.activities.update(user.userId, id, dto);
  }

  @Post('farm-activities/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.activities.cancel(user.userId, id);
  }

  @Delete('farm-activities/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.activities.remove(user.userId, id);
  }
}
